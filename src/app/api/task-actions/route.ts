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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, testId, solutionId, entityName, status, assignee, dueDate, priority } = body;

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
