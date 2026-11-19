import { BlockList, isIP } from 'net';
import { lookup } from 'dns/promises';

/**
 * SSRF protection helpers.
 *
 * The scanner drives a real browser to user-supplied URLs from inside our
 * infrastructure (docker network with Postgres/Redis, the API itself, the
 * cloud metadata endpoint). Every hostname we navigate to — and every
 * sub-request the page makes — must resolve to a public unicast address.
 */

const blocked = new BlockList();

// IPv4 special-purpose ranges (RFC 6890 and friends).
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private (docker default bridge lives here)
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}

// IPv6 special-purpose ranges.
for (const [net, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (embeds IPv4)
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard-only
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (embeds IPv4)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // deprecated site-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** True when `ip` is a literal IP that is NOT safe to connect to. */
export function isNonPublicIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '').split('%')[0];
  const family = isIP(bare);
  if (family === 0) return true; // not an IP at all — treat as unsafe

  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) → judge by the embedded IPv4 address.
    const mapped = IPV4_MAPPED.exec(bare);
    if (mapped) return blocked.check(mapped[1], 'ipv4');
    // Other IPv4-compatible/translated forms are rare and suspicious.
    if (/^::(\d+\.){3}\d+$/.test(bare)) return true;
    return blocked.check(bare, 'ipv6');
  }
  return blocked.check(bare, 'ipv4');
}

export type HostCheck =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: 'ip-literal' | 'unresolvable' | 'non-public' };

type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Resolve `hostname` the same way the browser will (getaddrinfo, honours
 * /etc/hosts) and require EVERY returned address to be public. A single
 * private record is enough to reject — otherwise an attacker can publish
 * both a public and a private A record and win the race.
 *
 * @param allowIpLiteral when false (user-supplied scan targets) a raw IP
 *   is rejected outright; when true (sub-requests made by a page) a public
 *   IP literal is accepted.
 */
export async function checkPublicHost(
  hostname: string,
  { allowIpLiteral = false, resolver = defaultResolver } = {},
): Promise<HostCheck> {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (isIP(host)) {
    if (!allowIpLiteral) return { ok: false, reason: 'ip-literal' };
    return isNonPublicIp(host)
      ? { ok: false, reason: 'non-public' }
      : { ok: true, addresses: [host] };
  }

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: false, reason: 'non-public' };
  }

  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    return { ok: false, reason: 'unresolvable' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'unresolvable' };
  if (addresses.some(isNonPublicIp)) return { ok: false, reason: 'non-public' };
  return { ok: true, addresses };
}

/** Schemes the browser may fetch over the network and that we must vet. */
export const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

/**
 * Drop-in `lookup` for `net`/`http`/`https` request options. Resolves like
 * `dns.lookup` but fails with ENOTPUBLIC if any address is non-public, so
 * the socket is never opened. Because the check happens on the exact
 * addresses the socket will use, it is not vulnerable to DNS rebinding.
 */
export function publicOnlyLookup(
  hostname: string,
  options: { all?: boolean } | number | LookupCallback,
  maybeCallback?: LookupCallback,
): void {
  const callback = (
    typeof options === 'function' ? options : maybeCallback
  ) as LookupCallback;
  const wantAll =
    typeof options === 'object' && options !== null && options.all;

  lookup(hostname, { all: true, verbatim: true })
    .then((records) => {
      if (
        records.length === 0 ||
        records.some((r) => isNonPublicIp(r.address))
      ) {
        const err: NodeJS.ErrnoException = new Error(
          `Refusing to connect to non-public address for ${hostname}`,
        );
        err.code = 'ENOTPUBLIC';
        callback(err, '', 0);
        return;
      }
      if (wantAll) callback(null, records);
      else callback(null, records[0].address, records[0].family);
    })
    .catch((err: NodeJS.ErrnoException) => callback(err, '', 0));
}
