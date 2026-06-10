import { db } from "@/lib/db";
import { tests, responses, consultantNotes } from "@/lib/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { computeResult } from "@/lib/scoring";
import { MODE_CONFIG, type ModeId } from "@/lib/modes";
import { renderPdfReport, type PdfReportData } from "@/lib/pdf-report";
import type { Topic, Solution } from "@/lib/schema";

export const dynamic = "force-dynamic";

// GET /api/reports/[company]/pdf?mode=clientes — server-rendered PDF report
// mirroring the printable entity report.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: rawCompany } = await params;
  const company = decodeURIComponent(rawCompany);
  const mode = (req.nextUrl.searchParams.get("mode") || "clientes") as ModeId;
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.clientes;

  const modeTests = await db.select().from(tests).where(eq(tests.mode, mode));
  if (modeTests.length === 0) {
    return NextResponse.json({ error: "Sin datos" }, { status: 404 });
  }
  const testMap = new Map(modeTests.map((t) => [t.id, t]));

  const companyFilter = company === "Sin asignar"
    ? or(eq(responses.company, company), isNull(responses.company), eq(responses.company, ""))
    : eq(responses.company, company);

  const rows = await db
    .select({ r: responses })
    .from(responses)
    .innerJoin(tests, eq(responses.testId, tests.id))
    .where(and(eq(tests.mode, mode), companyFilter));

  const entityResponses = rows.map((x) => x.r).filter((r) => testMap.has(r.testId));
  if (entityResponses.length === 0) {
    return NextResponse.json({ error: "Sin evaluaciones para esta entidad" }, { status: 404 });
  }

  // Aggregate — same math as the on-screen report.
  let sum = 0;
  const byTest: Record<string, { testName: string; rows: ReturnType<typeof computeResult>[] }> = {};
  const solMap: Record<string, { sol: Solution; testName: string }> = {};

  for (const r of entityResponses) {
    const test = testMap.get(r.testId)!;
    const result = computeResult((test.topics as Topic[]) || [], (test.solutions as Solution[]) || [], (r.answers as Record<string, string>) || {});
    sum += result.overall;
    (byTest[r.testId] ||= { testName: test.name, rows: [] }).rows.push(result);
    result.triggered.forEach((sol) => {
      if (!solMap[sol.id]) solMap[sol.id] = { sol, testName: test.name };
    });
  }

  const breakdowns = Object.values(byTest).map((data) => {
    const avgOverall = Math.round(data.rows.reduce((s, r) => s + r.overall, 0) / data.rows.length);
    const topicAvgs = (data.rows[0]?.topicResults || []).map((t) => {
      const grades = data.rows.map((r) => r.topicResults.find((tr) => tr.topicId === t.topicId)?.grade ?? 0);
      return { name: t.name, avg: Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) };
    });
    return { testName: data.testName, avgOverall, topicAvgs };
  });

  const [noteRow] = await db
    .select()
    .from(consultantNotes)
    .where(and(eq(consultantNotes.company, company), eq(consultantNotes.mode, mode)));

  const data: PdfReportData = {
    company,
    modeLabel: modeConfig.singular,
    generatedAt: new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }),
    overall: { avg: Math.round(sum / entityResponses.length), count: entityResponses.length },
    breakdowns,
    solutions: Object.values(solMap).map(({ sol, testName }) => ({
      name: sol.name,
      category: sol.category || undefined,
      testName,
      description: sol.description || undefined,
      actions: sol.actions || [],
    })),
    notes: noteRow?.content || "",
  };

  const buffer = await renderPdfReport(data);

  const filename = `reporte_${company.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
