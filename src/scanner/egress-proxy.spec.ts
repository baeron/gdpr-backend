import * as http from 'http';
import * as net from 'net';
import type { AddressInfo } from 'net';
import { EgressProxy } from './egress-proxy';
import { checkPublicHost } from '../common/net/public-address';

/**
 * These tests run a real HTTP server on 127.0.0.1 as the "internal service"
 * and talk to the proxy the same way Chromium does.
 */
describe('EgressProxy', () => {
  let target: http.Server;
  let targetPort: number;
  let proxy: EgressProxy;
  let proxyPort: number;

  const allowLoopbackForTest: typeof checkPublicHost = (host) =>
    Promise.resolve(
      host === 'allowed.test'
        ? { ok: true as const, addresses: ['127.0.0.1'] }
        : { ok: false as const, reason: 'non-public' as const },
    );

  async function startProxy(check?: typeof checkPublicHost) {
    proxy = new EgressProxy(check);
    proxyPort = Number(new URL(await proxy.start()).port);
  }

  beforeEach(async () => {
    target = http.createServer((req, res) => {
      res.setHeader('Set-Cookie', ['a=1', 'b=2']);
      res.end(`internal:${req.headers.host}${req.url}`);
    });
    await new Promise<void>((r) => target.listen(0, '127.0.0.1', () => r()));
    targetPort = (target.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await proxy?.stop();
    await new Promise<void>((r) => target.close(() => r()));
  });

  function proxiedGet(url: string): Promise<{
    status: number;
    body: string;
    headers: http.IncomingHttpHeaders;
  }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: proxyPort,
          method: 'GET',
          path: url,
          headers: { host: new URL(url).host },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body,
              headers: res.headers,
            }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  function connect(authority: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const s = net.connect(proxyPort, '127.0.0.1', () => {
        s.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
      });
      let data = '';
      s.on('data', (c) => {
        data += c.toString();
        if (data.includes('\r\n\r\n')) {
          s.destroy();
          resolve(data.split('\r\n')[0]);
        }
      });
      s.on('error', reject);
    });
  }

  describe('with the real public-address check', () => {
    beforeEach(() => startProxy());

    it('blocks plain HTTP to a loopback IP', async () => {
      const res = await proxiedGet(`http://127.0.0.1:${targetPort}/secret`);
      expect(res.status).toBe(403);
      expect(res.body).not.toContain('internal');
    });

    it('blocks plain HTTP to localhost', async () => {
      const res = await proxiedGet(`http://localhost:${targetPort}/secret`);
      expect(res.status).toBe(403);
    });

    it('blocks CONNECT to the metadata endpoint and loopback', async () => {
      expect(await connect('169.254.169.254:80')).toContain('403');
      expect(await connect(`127.0.0.1:${targetPort}`)).toContain('403');
      expect(await connect(`[::1]:${targetPort}`)).toContain('403');
    });

    it('rejects malformed CONNECT targets', async () => {
      expect(await connect('no-port-here')).toContain('403');
    });
  });

  describe('when the host is vetted as public', () => {
    beforeEach(() => startProxy(allowLoopbackForTest));

    it('forwards plain HTTP preserving Host header and multiple Set-Cookie', async () => {
      const res = await proxiedGet(
        `http://allowed.test:${targetPort}/page?q=1`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe(`internal:allowed.test:${targetPort}/page?q=1`);
      expect(res.headers['set-cookie']).toEqual(['a=1', 'b=2']);
    });

    it('opens a CONNECT tunnel', async () => {
      expect(await connect(`allowed.test:${targetPort}`)).toBe(
        'HTTP/1.1 200 Connection Established',
      );
    });

    it('still blocks hosts the check rejects', async () => {
      expect(await connect(`blocked.test:${targetPort}`)).toContain('403');
    });
  });
});
