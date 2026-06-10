import { db } from "@/lib/db";
import { tests, responses, reportSends } from "@/lib/schema";
import { eq, and, isNull, or, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel, uid } from "@/lib/scoring";
import { MODE_CONFIG, type ModeId } from "@/lib/modes";
import { sendEmail, emailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { Topic, Solution } from "@/lib/schema";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(v: number): string {
  return SCORE_HEX[scoreBucket(v)];
}

// Spanish summary email mirroring the branded shell in lib/email.ts.
function reportEmailHtml(opts: {
  company: string;
  modeLabel: string;
  avg: number;
  count: number;
  date: string;
  breakdowns: { name: string; avg: number }[];
  solutionsCount: number;
  link: string;
}): string {
  const coverColor = "#1f8a5b";
  const rows = opts.breakdowns.map((b) =>
    `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13.5px;color:#1c2420">${escapeHtml(b.name)}</td>
      <td align="right" style="padding:9px 12px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13.5px;color:${scoreColor(b.avg)};white-space:nowrap"><strong>${b.avg}</strong>/100</td>
    </tr>`
  ).join("");
  const solLine = opts.solutionsCount > 0
    ? `<p style="margin:16px 0 0">Se identificaron <strong>${opts.solutionsCount}</strong> solución${opts.solutionsCount === 1 ? "" : "es"} recomendada${opts.solutionsCount === 1 ? "" : "s"}. Encontrarás el detalle y los pasos de acción en el reporte completo.</p>`
    : `<p style="margin:16px 0 0">No se activaron soluciones recomendadas en este período.</p>`;
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f5f3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f3;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:${coverColor};padding:28px 32px;text-align:center">
          <span style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.85)">Auditoría</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11.5px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#9aa39d">Reporte de evaluación · ${escapeHtml(opts.modeLabel)}</p>
          <h1 style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:22px;color:#1c2420">${escapeHtml(opts.company)}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>
            <td style="font-family:Arial,sans-serif;font-size:40px;font-weight:bold;color:${scoreColor(opts.avg)};line-height:1">${opts.avg}<span style="font-size:16px;color:#9aa39d">/100</span></td>
            <td style="padding-left:16px;font-family:Arial,sans-serif;font-size:14px;color:#3d4742;vertical-align:middle">
              Nivel <strong>${escapeHtml(tierLabel(opts.avg))}</strong><br/>
              <span style="font-size:12.5px;color:#9aa39d">${opts.count} evaluaci${opts.count === 1 ? "ón" : "ones"} · ${escapeHtml(opts.date)}</span>
            </td>
          </tr></table>
          <div style="font-family:Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#3d4742">
            ${opts.breakdowns.length > 0 ? `
            <p style="margin:0 0 8px;font-weight:bold;color:#1c2420">Resultados por cuestionario</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eae6;border-radius:8px;border-collapse:separate;overflow:hidden">${rows}</table>` : ""}
            ${solLine}
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0"><tr><td style="border-radius:8px;background:${coverColor}">
            <a href="${escapeHtml(opts.link)}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Ver reporte completo</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e8eae6;text-align:center">
          <span style="font-family:Arial,sans-serif;font-size:11.5px;color:#9aa39d">Enviado con Auditoría</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// GET /api/reports/{any}/send?mode=clientes[&company=Acme]
// Returns { sends: [...] } — the latest send per company for the mode
// (the path segment is ignored; filtering is driven by query params).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  await params; // path segment unused for listing
  const mode = req.nextUrl.searchParams.get("mode") || "clientes";
  const companyQ = req.nextUrl.searchParams.get("company");

  const where = companyQ
    ? and(eq(reportSends.mode, mode), eq(reportSends.company, companyQ))
    : eq(reportSends.mode, mode);

  const rows = await db
    .select()
    .from(reportSends)
    .where(where)
    .orderBy(desc(reportSends.sentAt));

  // Keep only the most recent send per company.
  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.company)) continue;
    seen.add(row.company);
    latest.push(row);
  }
  return NextResponse.json({ sends: latest });
}

// POST /api/reports/[company]/send — body { mode, email }
// Emails a Spanish summary of the company report and logs the send.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: rawCompany } = await params;
  const company = decodeURIComponent(rawCompany);
  const body = await req.json().catch(() => ({}));
  const mode = (body?.mode || "clientes") as ModeId;
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.clientes;
  const email = String(body?.email || "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email inválido. Verifica la dirección del destinatario." }, { status: 400 });
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "El envío de emails no está configurado. Agrega RESEND_API_KEY en las variables de entorno para habilitarlo." },
      { status: 502 }
    );
  }

  const modeTests = await db.select().from(tests).where(eq(tests.mode, mode));
  if (modeTests.length === 0) {
    return NextResponse.json({ error: "Sin datos para este modo" }, { status: 404 });
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
    return NextResponse.json({ error: "No hay evaluaciones para generar este reporte" }, { status: 404 });
  }

  // Aggregate — same math as the on-screen report.
  let sum = 0;
  const byTest: Record<string, { name: string; sum: number; count: number }> = {};
  const solIds = new Set<string>();
  for (const r of entityResponses) {
    const test = testMap.get(r.testId)!;
    const result = computeResult(
      (test.topics as Topic[]) || [],
      (test.solutions as Solution[]) || [],
      (r.answers as Record<string, string>) || {}
    );
    sum += result.overall;
    const bt = (byTest[r.testId] ||= { name: test.name, sum: 0, count: 0 });
    bt.sum += result.overall;
    bt.count++;
    result.triggered.forEach((s) => solIds.add(s.id));
  }
  const avg = Math.round(sum / entityResponses.length);
  const breakdowns = Object.values(byTest).map((b) => ({ name: b.name, avg: Math.round(b.sum / b.count) }));

  const link = `${appBaseUrl(req.nextUrl.origin)}/#reporte/${encodeURIComponent(company)}`;
  const html = reportEmailHtml({
    company,
    modeLabel: modeConfig.singular,
    avg,
    count: entityResponses.length,
    date: new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }),
    breakdowns,
    solutionsCount: solIds.size,
    link,
  });

  const result = await sendEmail({ to: email, subject: `Reporte de evaluación — ${company}`, html });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "No se pudo enviar el email" }, { status: 502 });
  }

  const [send] = await db
    .insert(reportSends)
    .values({ id: uid("rs"), company, mode, email })
    .returning();
  return NextResponse.json(send, { status: 201 });
}
