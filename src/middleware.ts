import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

// Routes that skip auth entirely.
// /q/* — public quiz pages (server-rendered)
// /login — login page
// /api/responses POST — anonymous quiz submission
// /api/auth/login|logout — auth endpoints
// /api/cron/* — verified inside the route via CRON_SECRET bearer token
function isPublic(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/q/")) return true;
  if (pathname.startsWith("/api/public/")) return true; // quiz drafts, opened-tracking, result email
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/api/responses" && req.method === "POST") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  if (isPublic(req)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Viewer accounts are read-only: block all mutating API calls.
  if (
    session.role === "viewer" &&
    req.nextUrl.pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    return NextResponse.json({ error: "Tu cuenta es de solo lectura" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on every path except Next.js internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
