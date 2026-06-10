import { db } from "@/lib/db";
import { testVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { Topic, Solution } from "@/lib/schema";

// GET /api/tests/[id]/versions
// Returns all published snapshots for a test, newest first, with count
// summaries plus the full topics/solutions payloads (needed for restore).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(testVersions)
    .where(eq(testVersions.testId, id))
    .orderBy(desc(testVersions.version));

  const result = rows.map((r) => {
    const topics = (r.topics as Topic[]) || [];
    const solutions = (r.solutions as Solution[]) || [];
    return {
      id: r.id,
      version: r.version,
      name: r.name,
      publishedAt: r.publishedAt,
      topicCount: topics.length,
      questionCount: topics.reduce((n, t) => n + (t.questions?.length || 0), 0),
      solutionCount: solutions.length,
      topics,
      solutions,
    };
  });

  return NextResponse.json(result);
}
