import { Logger } from '@nestjs/common';
import * as http from 'http';
import * as net from 'net';
import type { AddressInfo } from 'net';
import { checkPublicHost } from '../common/net/public-address';

/**
 * Minimal forward proxy that every scanner browser connection goes through.
 *
 * Why a proxy and not `context.route()`:
 *   - Playwright route handlers are NOT invoked for redirect hops, so a
 *     public page answering `302 Location: http://169.254.169.254/` would
 *     slip past them;
 *   - service workers, WebSockets and prefetches bypass routing too;
 *   - routing checks DNS and then lets the browser resolve again (DNS
 *     rebinding). Here the proxy resolves, vets EVERY address, and opens
 *     the socket to the vetted IP itself.
 *
 * HTTPS / WSS use CONNECT tunnels (TLS stays end-to-end between the browser
 * and the site — no interception). Plain HTTP is forwarded with the
 * original Host header to the vetted IP.
 *
 * Listens on 127.0.0.1 only. Chromium is started with
 * `--proxy-bypass-list=<-loopback>` so even localhost goes through here.
 */
export class EgressProxy {
  private readonly logger = new Logger(EgressProxy.name);
  private server: http.Server | null = null;
  private readonly sockets = new Set<net.Socket>();

  constructor(
    private readonly check: typeof checkPublicHost = checkPublicHost,
    private readonly idleTimeoutMs = 60_000,
  ) {}

  /** Starts the proxy (idempotent) and returns its URL. */
  async start(): Promise<string> {
    if (!this.server) {
      const server = http.createServer(
        (req, res) => void this.onRequest(req, res),
      );
      server.on(
        'connect',
        (req: http.IncomingMessage, socket: net.Socket, head: Buffer) =>
          void this.onConnect(req, socket, head),
      );
      server.on('connection', (s: net.Socket) => {
        this.sockets.add(s);
        s.on('close', () => this.sockets.delete(s));
      });
      server.on('clientError', (_err, socket) => socket.destroy());
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
      this.server = server;
    }
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async vet(host: string): Promise<string | null> {
    const result = await this.check(host, { allowIpLiteral: true });
    if (!result.ok) {
      this.logger.warn(`Blocked scanner egress to ${host} (${result.reason})`);
      return null;
    }
    return result.addresses[0];
  }

  /** CONNECT host:port — used for https://, wss:// (and ws:// by Chromium). */
  private async onConnect(
    req: http.IncomingMessage,
    client: net.Socket,
    head: Buffer,
  ): Promise<void> {
    client.on('error', () => client.destroy());
    const target = parseAuthority(req.url ?? '');
    const ip = target && (await this.vet(target.host));
    if (!target || !ip) {
      client.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
      return;
    }

    const upstream = net.connect(target.port, ip);
    this.sockets.add(upstream);
    upstream.setTimeout(this.idleTimeoutMs, () => upstream.destroy());
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => {
      if (!client.destroyed) {
        client.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n');
      }
    });
    upstream.on('close', () => {
      this.sockets.delete(upstream);
      client.destroy();
    });
    client.on('close', () => upstream.destroy());
  }

  /** Absolute-form request — plain http:// through the proxy. */
  private async onRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    let url: URL;
    try {
      url = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (url.protocol !== 'http:') {
      res.writeHead(400).end();
      return;
    }

    const ip = await this.vet(url.hostname);
    if (!ip) {
      res.writeHead(403).end();
      return;
    }

    const headers = { ...req.headers };
    delete headers['proxy-connection'];
    delete headers['proxy-authorization'];
    headers.host = url.host;

    const upstream = http.request(
      {
        host: ip,
        port: url.port ? Number(url.port) : 80,
        method: req.method,
        path: `${url.pathname}${url.search}`,
        headers,
        setHost: false,
        timeout: this.idleTimeoutMs,
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.statusMessage, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  }
}

function parseAuthority(
  authority: string,
): { host: string; port: number } | null {
  // "example.com:443" or "[2001:db8::1]:443"
  const m = /^(\[[^\]]+\]|[^:]+):(\d{1,5})$/.exec(authority);
  if (!m) return null;
  const port = Number(m[2]);
  if (port < 1 || port > 65535) return null;
  return { host: m[1].replace(/^\[|\]$/g, ''), port };
}
