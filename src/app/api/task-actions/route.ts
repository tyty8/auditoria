import { db } from "@/lib/db";
import { taskActions, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { uid } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");

  if (mode) {
    // Join with tests to filter by mode
    const rows = await db
      .select({ taskActions })
      .from(taskActions)
      .innerJoin(tests, eq(taskActions.testId, tests.id))
      .where(eq(tests.mode, mode));
    return NextResponse.json(rows.map((r) => r.taskActions));
  }

  const all = await db.select().from(taskActions);
  return NextResponse.json(all);
}

const VALID_PRIORITIES = ["alta", "media", "baja"];

function sanitizeDueDate(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function sanitizeComments(v: unknown): { id: string; text: string; author?: string; at: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c) => c && typeof c === "object" && typeof c.text === "string")
    .slice(0, 200)
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : uid("cm"),
      text: String(c.text).slice(0, 2000),
      author: typeof c.author === "string" ? c.author.slice(0, 120) : undefined,
      at: typeof c.at === "string" ? c.at : new Date().toISOString(),
    }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, testId, solutionId, entityName, status, assignee, dueDate, priority, comments } = body;

  if (!testId || !solutionId || !entityName) {
    return NextResponse.json({ error: "testId, solutionId, and entityName are required" }, { status: 400 });
  }

  const fields = {
    testId,
    solutionId,
    entityName,
    status: status || "pendiente",
    assignee: assignee || null,
    dueDate: sanitizeDueDate(dueDate),
    priority: VALID_PRIORITIES.includes(priority) ? priority : "media",
    // Only overwrite the comment thread when the client explicitly sends it.
    ...(comments !== undefined ? { comments: sanitizeComments(comments) } : {}),
    updatedAt: new Date(),
  };

  // If id provided, try to update existing row
  if (id) {
    const existing = await db.select().from(taskActions).where(eq(taskActions.id, id));
    if (existing.length > 0) {
      await db.update(taskActions).set(fields).where(eq(taskActions.id, id));
      const updated = await db.select().from(taskActions).where(eq(taskActions.id, id));
      return NextResponse.json(updated[0]);
    }
  }

  // Insert new
  const row = { id: id || uid("ta"), ...fields };
  await db.insert(taskActions).values(row);
  return NextResponse.json(row, { status: 201 });
}
