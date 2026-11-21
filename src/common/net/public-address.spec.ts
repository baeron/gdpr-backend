import {
  checkPublicHost,
  isNonPublicIp,
  publicOnlyLookup,
} from './public-address';

describe('isNonPublicIp', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '[::1]',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isNonPublicIp(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '93.184.216.34',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (ip) => {
    expect(isNonPublicIp(ip)).toBe(false);
  });
});

describe('checkPublicHost', () => {
  const resolverFor = (map: Record<string, string[]>) => (host: string) =>
    map[host]
      ? Promise.resolve(map[host])
      : Promise.reject(new Error('ENOTFOUND'));

  it('accepts a hostname with only public addresses', async () => {
    const res = await checkPublicHost('example.com', {
      resolver: resolverFor({
        'example.com': ['93.184.216.34', '2606:2800:220:1::1'],
      }),
    });
    expect(res).toEqual({
      ok: true,
      addresses: ['93.184.216.34', '2606:2800:220:1::1'],
    });
  });

  it('rejects a hostname that resolves to loopback (nip.io-style)', async () => {
    const res = await checkPublicHost('127.0.0.1.nip.io', {
      resolver: resolverFor({ '127.0.0.1.nip.io': ['127.0.0.1'] }),
    });
    expect(res).toEqual({ ok: false, reason: 'non-public' });
  });

  it('rejects when ANY of several records is private', async () => {
    const res = await checkPublicHost('mixed.example', {
      resolver: resolverFor({ 'mixed.example': ['93.184.216.34', '10.0.0.5'] }),
    });
    expect(res).toEqual({ ok: false, reason: 'non-public' });
  });

  it('rejects localhost without resolving', async () => {
    const resolver = jest.fn();
    expect(await checkPublicHost('localhost', { resolver })).toEqual({
      ok: false,
      reason: 'non-public',
    });
    expect(await checkPublicHost('api.localhost', { resolver })).toEqual({
      ok: false,
      reason: 'non-public',
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('reports unresolvable hosts', async () => {
    const res = await checkPublicHost('nope.invalid', {
      resolver: resolverFor({}),
    });
    expect(res).toEqual({ ok: false, reason: 'unresolvable' });
  });

  it('rejects IP literals unless explicitly allowed', async () => {
    expect(await checkPublicHost('8.8.8.8')).toEqual({
      ok: false,
      reason: 'ip-literal',
    });
    expect(await checkPublicHost('8.8.8.8', { allowIpLiteral: true })).toEqual({
      ok: true,
      addresses: ['8.8.8.8'],
    });
    expect(
      await checkPublicHost('169.254.169.254', { allowIpLiteral: true }),
    ).toEqual({
      ok: false,
      reason: 'non-public',
    });
    expect(await checkPublicHost('[::1]', { allowIpLiteral: true })).toEqual({
      ok: false,
      reason: 'non-public',
    });
  });
});

describe('publicOnlyLookup', () => {
  it('refuses loopback with ENOTPUBLIC', (done) => {
    publicOnlyLookup('localhost', {}, (err) => {
      expect(err?.code).toBe('ENOTPUBLIC');
      done();
    });
  });
});
