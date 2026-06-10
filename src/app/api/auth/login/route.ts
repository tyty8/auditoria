import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifyPassword, COOKIE_NAME } from "@/lib/auth";
import { verifyUserPassword } from "@/lib/users";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/lib/schema";

export async function POST(req: NextRequest) {
  let email: unknown, password: unknown;
  try {
    ({ email, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let session: { sub: string; role: UserRole; name?: string; company?: string | null } | null = null;

  if (typeof email === "string" && email.trim()) {
    // Per-user login. Wrapped in try/catch so a missing users table (schema not
    // pushed yet) degrades to "invalid credentials" instead of a 500.
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
      if (user && verifyUserPassword(password, user.passwordHash)) {
        session = { sub: user.id, role: user.role as UserRole, name: user.name || undefined, company: user.company };
      }
    } catch {
      session = null;
    }
  } else if (verifyPassword(password)) {
    // Legacy master password — full admin.
    session = { sub: "legacy-admin", role: "admin", name: "Administrador" };
  }

  if (!session) {
    // Same response shape for wrong credentials and missing config to avoid enumeration.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken(session);
  const res = NextResponse.json({ ok: true, role: session.role, name: session.name || null });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
