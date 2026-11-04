// SSRF guard: only allow http(s) URLs on standard ports whose host resolves to public IPs.
import dns from 'node:dns/promises';
import net from 'node:net';

const blocked = new net.BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(ip, prefix, 'ipv4');
for (const [ip, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64],
  ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]) blocked.addSubnet(ip, prefix, 'ipv6');

export function isPublicIp(ip) {
  const type = net.isIP(ip);
  if (!type) return false;
  // Block every IPv4-mapped IPv6 address (::ffff:a.b.c.d / ::ffff:7f00:1). Handled here because
  // BlockList would match an ::ffff:0:0/96 rule against plain IPv4 too.
  if (type === 6 && /^(0{0,4}:){0,5}:?ffff:/i.test(ip.replace(/^::/, ''))) return false;
  if (type === 6 && /^::ffff:/i.test(ip)) return false;
  return !blocked.check(ip, type === 4 ? 'ipv4' : 'ipv6');
}

async function hostIsPublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return isPublicIp(host);
  if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i.test(host)) return false;
  try {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((a) => isPublicIp(a.address));
  } catch {
    return false;
  }
}

/** Returns a normalized URL string, or null if unsafe/invalid. */
export async function safeUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  if (u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  if (!(await hostIsPublic(u.hostname))) return null;
  return u.toString();
}

/** fetch() that re-validates every redirect hop against the SSRF guard. */
export async function safeFetch(url, init = {}, maxRedirects = 5) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    if (!(await safeUrl(current))) throw new Error('Blocked unsafe media URL');
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}
