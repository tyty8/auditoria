import { db } from "@/lib/db";
import { invitations } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Public endpoint: stamps openedAt the first time an invitee opens their
// quiz link (?inv=...). Idempotent — keeps the earliest open time.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [inv] = await db.select().from(invitations).where(eq(invitations.id, id));
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!inv.openedAt) {
    await db.update(invitations).set({ openedAt: new Date() }).where(eq(invitations.id, id));
  }
  return NextResponse.json({ ok: true });
}
