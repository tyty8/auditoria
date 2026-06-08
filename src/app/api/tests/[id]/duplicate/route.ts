import { db } from "@/lib/db";
import { tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db.select().from(tests).where(eq(tests.id, id));
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const original = rows[0];

  const copy = {
    ...original,
    id: uid("test"),
    name: original.name + " (copia)",
    status: "borrador",
    createdAt: new Date().toISOString().slice(0, 10),
  };

  await db.insert(tests).values(copy);
  return NextResponse.json(copy, { status: 201 });
}
