import { db } from "@/lib/db";
import { invitations } from "@/lib/schema";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

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
