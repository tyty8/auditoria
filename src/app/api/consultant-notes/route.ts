import { db } from "@/lib/db";
import { consultantNotes } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get("company");
  const mode = req.nextUrl.searchParams.get("mode");

  if (!company || !mode) {
    return NextResponse.json({ error: "company and mode are required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(consultantNotes)
    .where(and(eq(consultantNotes.company, company), eq(consultantNotes.mode, mode)));

  if (rows.length === 0) {
    return NextResponse.json({ content: "" });
  }

  return NextResponse.json(rows[0]);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { company, mode, content } = body;

  if (!company || !mode) {
    return NextResponse.json({ error: "company and mode are required" }, { status: 400 });
  }

  // Check if row exists for company+mode
  const existing = await db
    .select()
    .from(consultantNotes)
    .where(and(eq(consultantNotes.company, company), eq(consultantNotes.mode, mode)));

  if (existing.length > 0) {
    await db
      .update(consultantNotes)
      .set({ content: content ?? "", updatedAt: new Date() })
      .where(and(eq(consultantNotes.company, company), eq(consultantNotes.mode, mode)));
    const updated = await db
      .select()
      .from(consultantNotes)
      .where(and(eq(consultantNotes.company, company), eq(consultantNotes.mode, mode)));
    return NextResponse.json(updated[0]);
  }

  const id = uid("cn");
  const row = {
    id,
    company,
    mode,
    content: content ?? "",
    updatedAt: new Date(),
  };

  await db.insert(consultantNotes).values(row);
  return NextResponse.json(row, { status: 201 });
}
