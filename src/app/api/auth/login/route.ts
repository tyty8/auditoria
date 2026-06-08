import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifyPassword, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let password: string;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof password !== "string" || !verifyPassword(password)) {
    // Same response shape for wrong password and missing config to avoid enumeration.
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
