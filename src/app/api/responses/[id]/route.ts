import { db } from "@/lib/db";
import { responses } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(responses).where(eq(responses.id, id));
  return NextResponse.json({ ok: true });
}
