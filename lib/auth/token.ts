import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "daftar_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
  /**
   * Session version from `Setting.sessionVersion`. Tokens issued before this
   * field existed are treated as version 1, which keeps existing sessions
   * valid until the PIN is changed.
   */
  sv?: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production.");
    }

    return "daftar-local-development-secret";
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

/** Creates a signed, stateless session token bound to a setting version. */
export function createSessionToken(version = 1, now = Date.now()) {
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
    sv: version,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verifies the signature and expiry without touching the database.
 * When `expectedVersion` is provided, the token must belong to that
 * `Setting.sessionVersion`; changing the PIN increments it and revokes
 * sessions on every other device.
 */
export function verifySessionToken(
  token: string | undefined | null,
  expectedVersion?: number,
) {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const encoded = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  const expectedSignature = sign(encoded);

  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) return false;
  if (!timingSafeEqual(provided, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    const versionMatches =
      expectedVersion === undefined || (payload.sv ?? 1) === expectedVersion;

    return (
      payload.v === 1 &&
      typeof payload.exp === "number" &&
      payload.exp > Date.now() &&
      versionMatches
    );
  } catch {
    return false;
  }
}
