import { getDb } from "./db";
import { tests, responses, invitations, taskActions, consultantNotes } from "./schema";
import { eq, inArray } from "drizzle-orm";
import { makeSeedClientes, makeSeedTiendas, makeSeedEmpleados } from "./seed-data";

type SeedMode = "clientes" | "tiendas" | "empleados";

async function seedMode(mode: SeedMode) {
  const db = getDb();

  const existingTests = await db.select({ id: tests.id }).from(tests).where(eq(tests.mode, mode));
  const existingTestIds = existingTests.map((t) => t.id);

  if (existingTestIds.length > 0) {
    await db.delete(taskActions).where(inArray(taskActions.testId, existingTestIds));
  }
  await db.delete(consultantNotes).where(eq(consultantNotes.mode, mode));
  await db.delete(tests).where(eq(tests.mode, mode));

  const seedData =
    mode === "clientes" ? makeSeedClientes() :
    mode === "tiendas"  ? makeSeedTiendas()  :
                          makeSeedEmpleados();

  for (const t of seedData.tests) {
    await db.insert(tests).values({ ...t });
  }
  for (const r of seedData.responses) {
    await db.insert(responses).values({ ...r, submittedAt: new Date(r.submittedAt) });
  }
  for (const inv of seedData.invitations) {
    await db.insert(invitations).values({ ...inv, sentAt: inv.sentAt ? new Date(inv.sentAt) : null });
  }
  for (const ta of seedData.taskActions) {
    await db.insert(taskActions).values({ ...ta });
  }
  for (const note of seedData.consultantNotes) {
    await db.insert(consultantNotes).values({ ...note });
  }

  console.log(`✓ ${mode}: ${seedData.tests.length} tests, ${seedData.responses.length} responses, ${seedData.invitations.length} invitations, ${seedData.taskActions.length} task actions, ${seedData.consultantNotes.length} notes`);
}

async function main() {
  for (const mode of ["clientes", "tiendas", "empleados"] as SeedMode[]) {
    await seedMode(mode);
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
