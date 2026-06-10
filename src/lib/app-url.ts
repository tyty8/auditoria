// Resolves the public base URL for links in emails.
// Priority: APP_URL env var → Vercel production URL → the incoming request origin.
export function appBaseUrl(reqOrigin?: string): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return (reqOrigin || "http://localhost:3000").replace(/\/$/, "");
}
