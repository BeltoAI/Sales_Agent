import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guards against SSRF: the server connects to hosts that users type in (SMTP/IMAP servers,
 * company websites). Those must resolve to public internet addresses only, never to
 * localhost, private networks or cloud metadata endpoints.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) {
    const v6 = ip.toLowerCase();
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    return (
      v6 === "::" ||
      v6 === "::1" ||
      v6.startsWith("fc") ||
      v6.startsWith("fd") || // unique local fc00::/7
      /^fe[89ab]/.test(v6) || // link-local fe80::/10
      v6.startsWith("ff") || // multicast
      v6.startsWith("64:ff9b:") || // NAT64
      v6.startsWith("2001:db8:") // documentation
    );
  }
  return true; // not an IP at all: treat as unsafe
}

export class UnsafeHostError extends Error {
  constructor(host: string) {
    super(`"${host}" is not a public internet host.`);
    this.name = "UnsafeHostError";
  }
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Throws UnsafeHostError unless every address the host resolves to is public. */
export async function assertPublicHost(host: string): Promise<void> {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (isIP(h)) {
    if (isPrivateIp(h)) throw new UnsafeHostError(host);
    return;
  }
  if (!HOSTNAME_RE.test(h) || h === "localhost" || /\.(local|localhost|internal|lan|home|corp)$/.test(h)) {
    throw new UnsafeHostError(host);
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(h, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not find the server "${host}". Check the spelling.`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeHostError(host);
  }
}
