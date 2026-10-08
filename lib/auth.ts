import "server-only";

import { cookies } from "next/headers";

const COOKIE_NAME = "mvp_mafia_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 10 * 60 * 1_000;
const LOGIN_ATTEMPTS = 5;

type SessionPayload = {
  v: 1;
  role: "admin";
  iat: number;
  exp: number;
  nonce: string;
};

type AttemptState = {
  count: number;
  resetAt: number;
};

const attemptScope = globalThis as typeof globalThis & {
  __mvpMafiaLoginAttempts?: Map<string, AttemptState>;
};
attemptScope.__mvpMafiaLoginAttempts ??= new Map<string, AttemptState>();
const loginAttempts = attemptScope.__mvpMafiaLoginAttempts;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const max = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function sessionSecret(): string | null {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") {
    return "mvp-mafia-local-session-secret-change-before-production";
  }
  return null;
}

async function hmac(message: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function verifyPbkdf2(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, expectedText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 2_000_000 ||
    !saltText ||
    !expectedText
  ) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const expected = base64UrlToBytes(expectedText);
    const actual = new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: base64UrlToBytes(saltText) as BufferSource,
          iterations,
        },
        key,
        expected.length * 8,
      ),
    );
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function productionAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD_HASH &&
      process.env.ADMIN_SESSION_SECRET,
  );
}

export function developmentCredentialsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedUsername =
    process.env.ADMIN_USERNAME ??
    (developmentCredentialsEnabled() ? "admin" : "");
  const usernameMatches = constantTimeEqual(
    new TextEncoder().encode(username.trim()),
    new TextEncoder().encode(expectedUsername),
  );

  let passwordMatches = false;
  if (process.env.ADMIN_PASSWORD_HASH) {
    passwordMatches = await verifyPbkdf2(password, process.env.ADMIN_PASSWORD_HASH);
  } else if (developmentCredentialsEnabled()) {
    passwordMatches = constantTimeEqual(
      new TextEncoder().encode(password),
      new TextEncoder().encode("MafiaDemo!2026"),
    );
  }

  return usernameMatches && passwordMatches;
}

export async function createAdminSession(): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Brak konfiguracji sesji administratora.");
  const now = Math.floor(Date.now() / 1_000);
  const payload: SessionPayload = {
    v: 1,
    role: "admin",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = bytesToBase64Url(await hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = sessionSecret();
  if (!secret) return false;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const expected = await hmac(encodedPayload, secret);
    const received = base64UrlToBytes(encodedSignature);
    if (!constantTimeEqual(expected, received)) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1_000);
    return (
      payload.v === 1 &&
      payload.role === "admin" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= now + 60 &&
      payload.exp > now &&
      payload.exp - payload.iat <= SESSION_TTL_SECONDS
    );
  } catch {
    return false;
  }
}

function cookieFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== COOKIE_NAME) continue;
    return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return undefined;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return verifyAdminSession(cookieFromRequest(request));
}

export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(COOKIE_NAME)?.value);
}

export const adminCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  },
};

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const allowed = new Set([requestUrl.origin]);
  if (forwardedHost) {
    allowed.add(`${forwardedProto || "https"}://${forwardedHost.split(",")[0].trim()}`);
  }
  return allowed.has(origin);
}

export function loginRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return forwarded || request.headers.get("cf-connecting-ip") || "local";
}

export function loginRateLimited(key: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.delete(key);
    return { blocked: false, retryAfter: 0 };
  }
  if (current.count < LOGIN_ATTEMPTS) return { blocked: false, retryAfter: 0 };
  return {
    blocked: true,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
  };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    current.count += 1;
  }

  if (loginAttempts.size > 500) {
    for (const [attemptKey, state] of loginAttempts) {
      if (state.resetAt <= now) loginAttempts.delete(attemptKey);
    }
  }
}

export function clearFailedLogins(key: string): void {
  loginAttempts.delete(key);
}
