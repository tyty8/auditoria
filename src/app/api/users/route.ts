import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { hashPassword } from "@/lib/users";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["admin", "consultor", "viewer"];

// User management is admin-only; the consultant list (id, name, email) is
// readable by any session so it can populate assignee pickers.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, company: users.company, createdAt: users.createdAt })
    .from(users);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores pueden gestionar usuarios" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, password, role, company } = body;

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized));
  if (existing.length > 0) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const row = {
    id: uid("u"),
    email: normalized,
    name: typeof name === "string" ? name.slice(0, 200) : null,
    passwordHash: hashPassword(password),
    role,
    company: typeof company === "string" && company ? company.slice(0, 200) : null,
    createdAt: new Date(),
  };
  await db.insert(users).values(row);
  const { passwordHash: _omit, ...safe } = row;
  void _omit;
  return NextResponse.json(safe, { status: 201 });
}
