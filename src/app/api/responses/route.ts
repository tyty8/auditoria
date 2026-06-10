import { db } from "@/lib/db";
import { responses, tests, invitations, testVersions } from "@/lib/schema";
import { eq, and, or, ilike, gte, lte, desc, sql, type SQL } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

const MAX_FIELD_LEN = 500;

function truncate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  return v.slice(0, MAX_FIELD_LEN);
}

// GET /api/responses
//   ?testId= | ?mode=  — scope
//   &q=               — case-insensitive match on respondent / email / company
//   &from=&to=        — ISO dates (inclusive) on submittedAt
//   &limit=&offset=   — server-side pagination (omit for the full list)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("mode");
  const testId = p.get("testId");
  const q = p.get("q");
  const from = p.get("from");
  const to = p.get("to");
  const limit = Math.min(Number(p.get("limit")) || 0, 500);
  const offset = Math.max(Number(p.get("offset")) || 0, 0);

  const conditions: SQL[] = [];
  if (testId) conditions.push(eq(responses.testId, testId));
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const match = or(
      ilike(responses.respondent, pattern),
      ilike(responses.email, pattern),
      ilike(responses.company, pattern),
    );
    if (match) conditions.push(match);
  }
  if (from && !Number.isNaN(Date.parse(from))) conditions.push(gte(responses.submittedAt, new Date(from)));
  if (to && !Number.isNaN(Date.parse(to))) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(responses.submittedAt, end));
  }

  if (!testId && mode) {
    let query = db
      .select({ responses })
      .from(responses)
      .innerJoin(tests, eq(responses.testId, tests.id))
      .where(and(eq(tests.mode, mode), ...conditions))
      .orderBy(desc(responses.submittedAt))
      .$dynamic();
    if (limit > 0) query = query.limit(limit).offset(offset);
    const rows = await query;
    return NextResponse.json(rows.map((r) => r.responses));
  }

  let query = db
    .select()
    .from(responses)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(responses.submittedAt))
    .$dynamic();
  if (limit > 0) query = query.limit(limit).offset(offset);
  const rows = await query;
  return NextResponse.json(rows);
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

  // Stamp the response with the currently published version of the instrument.
  const [latestVersion] = await db
    .select({ version: sql<number>`max(${testVersions.version})::int` })
    .from(testVersions)
    .where(eq(testVersions.testId, testId));

  await db.insert(responses).values({
    id,
    testId,
    respondent: truncate(respondent),
    company: truncate(company),
    email: truncate(email),
    role: truncate(role),
    answers: safeAnswers,
    submittedAt,
    testVersion: latestVersion?.version ?? null,
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
