// Password hashing for user accounts (Node runtime only — not imported by middleware).
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEY_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyUserPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, salt, expected.length, { N: Number(nStr), r: SCRYPT_R, p: SCRYPT_P });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
