import { db } from "@/lib/db";
import { tests, testVersions } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { uid } from "@/lib/scoring";
import type { Solution, Topic } from "@/lib/schema";

// Only allow these columns to be patched — prevents mass assignment.
const ALLOWED_PATCH_FIELDS = [
  "name", "domain", "tags", "description", "status",
  "accent", "topics", "solutions", "branding", "mode", "archived",
] as const;
type AllowedField = (typeof ALLOWED_PATCH_FIELDS)[number];
type TestPatch = Partial<Pick<InferInsertModel<typeof tests>, AllowedField>>;

function isSafeUrl(url: unknown): boolean {
  if (typeof url !== "string") return true; // null / undefined is fine
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateSolutions(solutions: unknown): string | null {
  if (!Array.isArray(solutions)) return null;
  for (const sol of solutions as Solution[]) {
    if (sol.link?.url && !isSafeUrl(sol.link.url)) {
      return `Invalid link URL in solution "${sol.name}": must start with http:// or https://`;
    }
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db.select().from(tests).where(eq(tests.id, id));
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Build patch from the explicit allowlist only.
  const patch: TestPatch = {};
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body && body[field] !== undefined) {
      (patch as Record<string, unknown>)[field] = body[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate solution link URLs to prevent stored XSS.
  if ("solutions" in patch) {
    const err = validateSolutions(patch.solutions);
    if (err) return NextResponse.json({ error: err }, { status: 422 });
  }

  await db.update(tests).set(patch).where(eq(tests.id, id));

  const updated = await db.select().from(tests).where(eq(tests.id, id));
  if (updated.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // On publish, snapshot the instrument (questions + solutions) as an immutable
  // version so historical responses stay comparable after later edits.
  // Only creates a new version when the content actually changed.
  if (patch.status === "publicado") {
    const t = updated[0];
    const [latest] = await db
      .select()
      .from(testVersions)
      .where(eq(testVersions.testId, id))
      .orderBy(desc(testVersions.version))
      .limit(1);

    const fingerprint = JSON.stringify({ topics: t.topics, solutions: t.solutions });
    const latestFingerprint = latest ? JSON.stringify({ topics: latest.topics, solutions: latest.solutions }) : null;

    if (fingerprint !== latestFingerprint) {
      await db.insert(testVersions).values({
        id: uid("tv"),
        testId: id,
        version: (latest?.version ?? 0) + 1,
        name: t.name,
        topics: (t.topics as Topic[]) || [],
        solutions: (t.solutions as Solution[]) || [],
        publishedAt: new Date(),
      });
    }
  }

  return NextResponse.json(updated[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(tests).where(eq(tests.id, id));
  return NextResponse.json({ ok: true });
}
