// TEST HELPERS ONLY (RFC 6238 TOTP: HMAC-SHA1, 30 s step, 6 digits, as authenticator apps use). Never import in app code.
import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Decode(input: string): Buffer {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
export function totp(secretBase32: string, nowMs = Date.now(), stepSeconds = 30, digits = 6): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / stepSeconds)));
  const h = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const o = h[h.length - 1]! & 0x0f;
  const code = (((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!) % 10 ** digits;
  return String(code).padStart(digits, "0");
}
export const secretFromOtpauthUri = (uri: string): string => {
  const s = new URL(uri).searchParams.get("secret"); if (!s) throw new Error("no secret in otpauth URI"); return s;
};
