import { db } from "@/lib/db";
import { responses, tests, invitations } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

const MAX_FIELD_LEN = 500;

function truncate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  return v.slice(0, MAX_FIELD_LEN);
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");
  const testId = req.nextUrl.searchParams.get("testId");

  if (testId) {
    const rows = await db.select().from(responses).where(eq(responses.testId, testId));
    return NextResponse.json(rows);
  }

  if (mode) {
    const rows = await db
      .select({ responses })
      .from(responses)
      .innerJoin(tests, eq(responses.testId, tests.id))
      .where(eq(tests.mode, mode));
    return NextResponse.json(rows.map((r) => r.responses));
  }

  const all = await db.select().from(responses);
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { testId, respondent, company, email, role, answers } = body;

  if (!testId || typeof testId !== "string") {
    return NextResponse.json({ error: "testId required" }, { status: 400 });
  }

  // Verify the test exists and is published before accepting a submission.
  const [test] = await db
    .select({ id: tests.id })
    .from(tests)
    .where(and(eq(tests.id, testId), eq(tests.status, "publicado")));

  if (!test) {
    return NextResponse.json({ error: "Test not found or not published" }, { status: 404 });
  }

  // Validate answers is a plain object of string → string pairs.
  const safeAnswers: Record<string, string> = {};
  if (answers && typeof answers === "object" && !Array.isArray(answers)) {
    for (const [k, v] of Object.entries(answers)) {
      if (typeof k === "string" && typeof v === "string") {
        safeAnswers[k.slice(0, 100)] = v.slice(0, 100);
      }
    }
  }

  const id = uid("r");
  // Always generate submittedAt server-side — never trust the client timestamp.
  const submittedAt = new Date();

  await db.insert(responses).values({
    id,
    testId,
    respondent: truncate(respondent),
    company: truncate(company),
    email: truncate(email),
    role: truncate(role),
    answers: safeAnswers,
    submittedAt,
  });

  // Auto-complete invitation by email match.
  if (email && typeof email === "string") {
    await db
      .update(invitations)
      .set({ status: "completada" })
      .where(and(eq(invitations.testId, testId), eq(invitations.email, email.slice(0, MAX_FIELD_LEN))));
  }

  return NextResponse.json({ id }, { status: 201 });
}
