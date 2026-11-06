import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const PREFIX = "scrypt";

export function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export function verifyPin(pin: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  try {
    const [, n, r, p, salt, expectedHash] = parts;
    const saltBuffer = Buffer.from(salt, "base64url");
    const expectedBuffer = Buffer.from(expectedHash, "base64url");

    const actual = scryptSync(pin, saltBuffer, expectedBuffer.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    if (actual.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}
