import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/users";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["admin", "consultor", "viewer"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores pueden gestionar usuarios" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = body.name.slice(0, 200);
  if (typeof body.company === "string") patch.company = body.company.slice(0, 200) || null;
  if (typeof body.role === "string" && VALID_ROLES.includes(body.role)) patch.role = body.role;
  if (typeof body.password === "string" && body.password.length >= 8) patch.passwordHash = hashPassword(body.password);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  const [updated] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, company: users.company })
    .from(users)
    .where(eq(users.id, id));
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores pueden gestionar usuarios" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.sub) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
