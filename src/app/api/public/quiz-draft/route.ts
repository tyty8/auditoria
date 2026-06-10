import { db } from "@/lib/db";
import { quizDrafts, tests } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

// Public endpoint: server-side backup of an in-progress quiz so a respondent
// can resume from another device. Keyed by testId + draftKey (invitation id
// or normalized email). Only published tests accept drafts.

function normKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim().toLowerCase().slice(0, 200);
  return k.length >= 3 ? k : null;
}

export async function GET(req: NextRequest) {
  const testId = req.nextUrl.searchParams.get("testId");
  const key = normKey(req.nextUrl.searchParams.get("key"));
  if (!testId || !key) return NextResponse.json({ error: "testId and key required" }, { status: 400 });

  const [row] = await db.select().from(quizDrafts)
    .where(and(eq(quizDrafts.testId, testId), eq(quizDrafts.draftKey, key)));
  return NextResponse.json(row ?? null);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const testId = typeof body.testId === "string" ? body.testId : null;
  const key = normKey(body.key);
  if (!testId || !key) return NextResponse.json({ error: "testId and key required" }, { status: 400 });

  const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  if (!test || test.status !== "publicado") {
    return NextResponse.json({ error: "Cuestionario no disponible" }, { status: 404 });
  }

  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const person = body.person && typeof body.person === "object" ? body.person : null;

  const [existing] = await db.select().from(quizDrafts)
    .where(and(eq(quizDrafts.testId, testId), eq(quizDrafts.draftKey, key)));

  if (existing) {
    await db.update(quizDrafts)
      .set({ answers, person, updatedAt: new Date() })
      .where(eq(quizDrafts.id, existing.id));
    return NextResponse.json({ ok: true, id: existing.id });
  }

  const id = uid("qd");
  await db.insert(quizDrafts).values({ id, testId, draftKey: key, answers, person, updatedAt: new Date() });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const testId = typeof body.testId === "string" ? body.testId : null;
  const key = normKey(body.key);
  if (!testId || !key) return NextResponse.json({ error: "testId and key required" }, { status: 400 });

  await db.delete(quizDrafts)
    .where(and(eq(quizDrafts.testId, testId), eq(quizDrafts.draftKey, key)));
  return NextResponse.json({ ok: true });
}
