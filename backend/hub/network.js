'use strict';

function clientIp(req) {
  const raw = req.ip || (req.connection && req.connection.remoteAddress) || '';
  return String(raw).replace(/^::ffff:/, '');
}

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) + o;
  }
  return n >>> 0;
}

function ipv4InCidr(ip, base, bits) {
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

const PRIVATE_V4 = [
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['169.254.0.0', 16],
];

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

function isPrivateAddress(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip === 'localhost') return true;
  if (ip.includes(':') && !ip.includes('.')) return isPrivateIPv6(ip);
  return PRIVATE_V4.some(([base, bits]) => ipv4InCidr(ip, base, bits));
}

function isPrivateClient(req) {
  return isPrivateAddress(clientIp(req));
}

module.exports = { clientIp, isPrivateAddress, isPrivateClient };
