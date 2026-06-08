// Single-tenant admin authentication.
// ADMIN_PASSWORD  – password the admin types at the login form
// ADMIN_SECRET    – long random string used to sign the session cookie (never exposed to clients)
// Generate a secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

export const COOKIE_NAME = "auditoria_session";
const PAYLOAD = "auditoria-session-v1";

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SECRET env var is missing or too short");
  return s;
}

// HMAC-SHA256 of a fixed payload, base64url-encoded.
// Changing ADMIN_SECRET revokes all existing sessions.
export async function createSessionToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(PAYLOAD));
  const bytes = new Uint8Array(sig);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Constant-time string comparison (avoids timing attacks).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const expected = await createSessionToken();
    return safeEqual(token, expected);
  } catch {
    return false;
  }
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Constant-time comparison to prevent timing attacks on the password.
  return safeEqual(input, pw);
}
