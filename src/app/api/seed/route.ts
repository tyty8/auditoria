import { db } from "@/lib/db";
import { tests, responses, invitations, taskActions, consultantNotes } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { makeSeedClientes, makeSeedTiendas, makeSeedEmpleados } from "@/lib/seed-data";
import { NextRequest, NextResponse } from "next/server";

type SeedMode = "clientes" | "tiendas" | "empleados";

async function seedMode(mode: SeedMode) {
  // 1. Fetch all test IDs for this mode (to clean up related records)
  const existingTests = await db.select({ id: tests.id }).from(tests).where(eq(tests.mode, mode));
  const existingTestIds = existingTests.map((t) => t.id);

  // 2. Delete task actions for tests in this mode
  if (existingTestIds.length > 0) {
    await db.delete(taskActions).where(inArray(taskActions.testId, existingTestIds));
  }

  // 3. Delete consultant notes for this mode
  await db.delete(consultantNotes).where(eq(consultantNotes.mode, mode));

  // 4. Delete tests (cascades to responses and invitations via FK)
  await db.delete(tests).where(eq(tests.mode, mode));

  // 5. Get seed data for the requested mode
  let seedData;
  if (mode === "clientes") seedData = makeSeedClientes();
  else if (mode === "tiendas") seedData = makeSeedTiendas();
  else seedData = makeSeedEmpleados();

  const { tests: seedTests, responses: seedResponses, invitations: seedInvitations, taskActions: seedTaskActions, consultantNotes: seedNotes } = seedData;

  // 6. Insert tests
  for (const test of seedTests) {
    await db.insert(tests).values({
      id: test.id,
      mode: test.mode,
      name: test.name,
      domain: test.domain,
      tags: test.tags,
      description: test.description,
      status: test.status,
      accent: test.accent,
      topics: test.topics,
      solutions: test.solutions,
      branding: test.branding,
      createdAt: test.createdAt,
    });
  }

  // 7. Insert responses
  for (const resp of seedResponses) {
    await db.insert(responses).values({
      id: resp.id,
      testId: resp.testId,
      respondent: resp.respondent,
      company: resp.company,
      email: resp.email,
      role: resp.role,
      submittedAt: new Date(resp.submittedAt),
      answers: resp.answers,
    });
  }

  // 8. Insert invitations
  for (const inv of seedInvitations) {
    await db.insert(invitations).values({
      id: inv.id,
      testId: inv.testId,
      name: inv.name,
      email: inv.email,
      company: inv.company,
      status: inv.status,
      sentAt: inv.sentAt ? new Date(inv.sentAt) : null,
    });
  }

  // 9. Insert task actions
  for (const ta of seedTaskActions) {
    await db.insert(taskActions).values({
      id: ta.id,
      testId: ta.testId,
      solutionId: ta.solutionId,
      entityName: ta.entityName,
      status: ta.status,
      assignee: ta.assignee,
    });
  }

  // 10. Insert consultant notes
  for (const note of seedNotes) {
    await db.insert(consultantNotes).values({
      id: note.id,
      company: note.company,
      mode: note.mode,
      content: note.content,
    });
  }

  return {
    tests: seedTests.length,
    responses: seedResponses.length,
    invitations: seedInvitations.length,
    taskActions: seedTaskActions.length,
    consultantNotes: seedNotes.length,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = body.mode as SeedMode | "all";

  if (!mode || !["clientes", "tiendas", "empleados", "all"].includes(mode)) {
    return NextResponse.json(
      { error: "mode must be one of: clientes, tiendas, empleados, all" },
      { status: 400 }
    );
  }

  if (mode === "all") {
    const results: Record<string, object> = {};
    for (const m of ["clientes", "tiendas", "empleados"] as SeedMode[]) {
      results[m] = await seedMode(m);
    }
    return NextResponse.json({ ok: true, mode: "all", inserted: results });
  }

  const inserted = await seedMode(mode);
  return NextResponse.json({ ok: true, mode, inserted });
}
