import { db } from "@/lib/db";
import { tests, responses, invitations, testVersions } from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { uid, computeOverallScore } from "@/lib/scoring";
import { NextRequest, NextResponse } from "next/server";
import type { Topic } from "@/lib/schema";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");

  const allTests = mode
    ? await db.select().from(tests).where(eq(tests.mode, mode))
    : await db.select().from(tests);

  if (allTests.length === 0) return NextResponse.json([]);

  const testIds = allTests.map((t) => t.id);

  // Single aggregate query — avoids the unbounded full-table scan.
  const countRows = await db
    .select({ testId: responses.testId, count: sql<number>`count(*)::int` })
    .from(responses)
    .where(inArray(responses.testId, testIds))
    .groupBy(responses.testId);

  const countMap = Object.fromEntries(countRows.map((r) => [r.testId, r.count]));

  // Fetch all responses only for tests that have any (for avg score computation).
  // This is still O(responses) but bounded by the filtered testIds.
  const testIdsWithResponses = countRows.map((r) => r.testId);
  const allResponses = testIdsWithResponses.length > 0
    ? await db.select().from(responses).where(inArray(responses.testId, testIdsWithResponses))
    : [];

  // Build per-test score sums using the shared scoring helper.
  const scoreSumMap: Record<string, number> = {};
  for (const r of allResponses) {
    const test = allTests.find((t) => t.id === r.testId);
    if (!test) continue;
    const score = computeOverallScore(
      (test.topics as Topic[]) || [],
      (r.answers as Record<string, string>) || {},
    );
    scoreSumMap[r.testId] = (scoreSumMap[r.testId] ?? 0) + score;
  }

  // Attach invitations and the latest published version number in two queries.
  const invRows = await db.select().from(invitations).where(inArray(invitations.testId, testIds));
  const invMap: Record<string, typeof invRows> = {};
  for (const inv of invRows) {
    (invMap[inv.testId] ||= []).push(inv);
  }

  const versionRows = await db
    .select({ testId: testVersions.testId, latest: sql<number>`max(${testVersions.version})::int` })
    .from(testVersions)
    .where(inArray(testVersions.testId, testIds))
    .groupBy(testVersions.testId);
  const versionMap = Object.fromEntries(versionRows.map((r) => [r.testId, r.latest]));

  const result = allTests.map((t) => {
    const count = countMap[t.id] ?? 0;
    return {
      ...t,
      _responseCount: count,
      _avgScore: count > 0 ? Math.round((scoreSumMap[t.id] ?? 0) / count) : 0,
      _latestVersion: versionMap[t.id] ?? null,
      invitations: invMap[t.id] ?? [],
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mode } = body;
  if (!mode) return NextResponse.json({ error: "mode required" }, { status: 400 });

  const id = uid("test");
  const newTest = {
    id,
    mode,
    name: "Nuevo cuestionario",
    domain: "General",
    tags: [] as string[],
    description: "",
    status: "borrador",
    accent: "#1f8a5b",
    topics: [] as never[],
    solutions: [] as never[],
    branding: null,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  await db.insert(tests).values(newTest);
  return NextResponse.json(newTest, { status: 201 });
}
