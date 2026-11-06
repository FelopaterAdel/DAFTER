import "server-only";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const DEFAULT_KEY = "owner";

type Attempt = {
  failures: number;
  lockedUntil: number;
};

const globalForAttempts = globalThis as unknown as {
  daftarLoginAttempts?: Map<string, Attempt>;
};

const attempts =
  globalForAttempts.daftarLoginAttempts ?? new Map<string, Attempt>();

globalForAttempts.daftarLoginAttempts = attempts;

function getAttempt(key: string): Attempt {
  const attempt = attempts.get(key);

  if (!attempt) return { failures: 0, lockedUntil: 0 };

  // The lockout has expired: give the owner a fresh set of attempts.
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= Date.now()) {
    const fresh: Attempt = { failures: 0, lockedUntil: 0 };
    attempts.set(key, fresh);
    return fresh;
  }

  return attempt;
}

/** Returns remaining lockout seconds, or 0 when not locked. */
export function lockoutRemainingSeconds(key = DEFAULT_KEY) {
  const attempt = getAttempt(key);
  const remaining = attempt.lockedUntil - Date.now();

  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function recordFailedAttempt(key = DEFAULT_KEY) {
  const attempt = getAttempt(key);
  const failures = attempt.failures + 1;

  const next: Attempt = {
    failures,
    lockedUntil: failures >= MAX_FAILURES ? Date.now() + LOCKOUT_MS : 0,
  };

  attempts.set(key, next);
  return next;
}

export function clearFailedAttempts(key = DEFAULT_KEY) {
  attempts.delete(key);
}

export function remainingAttempts(key = DEFAULT_KEY) {
  return Math.max(0, MAX_FAILURES - getAttempt(key).failures);
}

export { MAX_FAILURES };
