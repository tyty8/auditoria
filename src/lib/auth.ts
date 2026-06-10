// Admin authentication with multi-user sessions.
// ADMIN_PASSWORD  – legacy master password (always logs in as role "admin")
// ADMIN_SECRET    – long random string used to sign the session cookie (never exposed to clients)
// Generate a secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Session token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
// Uses WebCrypto only so it runs both in route handlers and edge middleware.

export const COOKIE_NAME = "auditoria_session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string; // user id, or "legacy-admin" for ADMIN_PASSWORD logins
  role: "admin" | "consultor" | "viewer";
  name?: string;
  company?: string | null;
  exp: number; // unix seconds
};

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SECRET env var is missing or too short");
  return s;
}

function b64urlEncode(bytes: Uint8Array): string {
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecodeToString(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

export async function createSessionToken(payload: Omit<SessionPayload, "exp">): Promise<string> {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

// Constant-time string comparison (avoids timing attacks).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns the payload when the token is valid and unexpired, null otherwise.
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = await hmac(body);
    if (!safeEqual(sig, expected)) return null;
    const payload = JSON.parse(b64urlDecodeToString(body)) as SessionPayload;
    if (!payload || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!["admin", "consultor", "viewer"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Reads and verifies the session from a Request's cookies (route handlers).
export async function getSession(req: { cookies: { get(name: string): { value: string } | undefined } }): Promise<SessionPayload | null> {
  return verifySessionToken(req.cookies.get(COOKIE_NAME)?.value);
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Constant-time comparison to prevent timing attacks on the password.
  return safeEqual(input, pw);
}
