import { db } from "@/lib/db";
import { invitations, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const testId = req.nextUrl.searchParams.get("testId");
  const mode = req.nextUrl.searchParams.get("mode");

  if (testId) {
    const rows = await db.select().from(invitations).where(eq(invitations.testId, testId));
    return NextResponse.json(rows);
  }
  if (mode) {
    const rows = await db
      .select({ invitations })
      .from(invitations)
      .innerJoin(tests, eq(invitations.testId, tests.id))
      .where(eq(tests.mode, mode));
    return NextResponse.json(rows.map((r) => r.invitations));
  }
  const all = await db.select().from(invitations);
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { testId, name, email, company, status, sentAt } = body;
  if (!testId) return NextResponse.json({ error: "testId required" }, { status: 400 });

  const id = uid("inv");

  // Determine final status: if sentAt provided, mark as "enviada" unless a different status is explicitly set
  const finalStatus = status || (sentAt ? "enviada" : "pendiente");

  const row = {
    id,
    testId,
    name: name || null,
    email: email || null,
    company: company || null,
    status: finalStatus,
    sentAt: sentAt || null,
  };

  await db.insert(invitations).values(row);
  return NextResponse.json(row, { status: 201 });
}
