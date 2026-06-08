import { db } from "@/lib/db";
import { invitations } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Explicit allowlist prevents mass assignment.
const ALLOWED_PATCH_FIELDS = ["name", "email", "company", "status", "sentAt"] as const;
type AllowedField = (typeof ALLOWED_PATCH_FIELDS)[number];
type InvitationPatch = Partial<Pick<InferInsertModel<typeof invitations>, AllowedField>>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const patch: InvitationPatch = {};
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body && body[field] !== undefined) {
      (patch as Record<string, unknown>)[field] = body[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.update(invitations).set(patch).where(eq(invitations.id, id));

  const updated = await db.select().from(invitations).where(eq(invitations.id, id));
  if (updated.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(invitations).where(eq(invitations.id, id));
  return NextResponse.json({ ok: true });
}
