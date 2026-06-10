import { db } from "@/lib/db";
import { responses, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, emailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import { computeResult, tierLabel, SCORE_HEX, SCORE_LABEL } from "@/lib/scoring";

// Public endpoint: emails a respondent their own result.
// Security model: if the response already has a stored email we ONLY send to
// that address (the provided one is ignored). Otherwise the caller may supply
// a destination, which is validated but never stored.

// Naive in-memory rate limit — at most 3 sends per response per server instance.
const sendCounts = new Map<string, number>();
const MAX_SENDS = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const responseId = typeof body.responseId === "string" ? body.responseId : null;
  if (!responseId) {
    return NextResponse.json({ error: "responseId requerido" }, { status: 400 });
  }

  const [response] = await db.select().from(responses).where(eq(responses.id, responseId));
  if (!response) {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }
  const [test] = await db.select().from(tests).where(eq(tests.id, response.testId));
  if (!test) {
    return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
  }

  const count = sendCounts.get(responseId) || 0;
  if (count >= MAX_SENDS) {
    return NextResponse.json(
      { error: "Se alcanzó el límite de envíos para este resultado" },
      { status: 429 }
    );
  }

  // Resolve the destination address (see security model above).
  let to = (response.email || "").trim();
  if (!to) {
    const provided = typeof body.email === "string" ? body.email.trim() : "";
    if (!EMAIL_RE.test(provided)) {
      return NextResponse.json({ error: "Ingresa un correo válido" }, { status: 400 });
    }
    to = provided;
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "El envío de correos no está configurado en este servidor" },
      { status: 502 }
    );
  }

  const topics = (test.topics as import("@/lib/schema").Topic[]) || [];
  const solutions = (test.solutions as import("@/lib/schema").Solution[]) || [];
  const answers = (response.answers as Record<string, string>) || {};
  const result = computeResult(topics, solutions, answers);

  const branding = test.branding;
  const coverColor = branding?.coverColor || test.accent || "#1f8a5b";
  const orgName = branding?.orgName || test.name;
  const overallColor = SCORE_HEX[result.overallBucket];
  const resultUrl = `${appBaseUrl(req.nextUrl.origin)}/q/${test.id}/result/${response.id}`;

  const topicRows = result.topicResults
    .map(
      (tr) => `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13.5px;color:#1c2420">${esc(tr.name)}</td>
        <td align="right" style="padding:9px 12px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13.5px;font-weight:bold;color:${SCORE_HEX[tr.bucket]};white-space:nowrap">${tr.grade}/100</td>
      </tr>`
    )
    .join("");

  const solutionsBlock = result.triggered.length
    ? `<p style="margin:24px 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#1c2420">Recomendaciones para ti</p>
       <ul style="margin:0;padding-left:18px;font-family:Arial,sans-serif;font-size:13.5px;line-height:1.7;color:#3d4742">
         ${result.triggered.map((s) => `<li>${esc(s.name)}</li>`).join("")}
       </ul>`
    : "";

  const hi = response.respondent ? `Hola ${esc(response.respondent)},` : "Hola,";

  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f5f3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f3;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:${coverColor};padding:28px 32px;text-align:center">
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:6px">${esc(orgName)}</div>
          <div style="font-family:Arial,sans-serif;font-size:19px;font-weight:bold;color:#ffffff">${esc(test.name)}</div>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#3d4742">${hi} aquí tienes el resumen de tus resultados.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 20px">
            <div style="font-family:Arial,sans-serif;font-size:48px;font-weight:bold;line-height:1;color:${overallColor}">${result.overall}<span style="font-size:20px;color:#9aa39d">/100</span></div>
            <div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;margin-top:8px;color:${overallColor}">${esc(tierLabel(result.overall))}</div>
            <div style="font-family:Arial,sans-serif;font-size:12.5px;margin-top:3px;color:#9aa39d">${esc(SCORE_LABEL[result.overallBucket] || "")}</div>
          </td></tr></table>
          ${
            topicRows
              ? `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#1c2420">Resultados por tema</p>
                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eae6;border-radius:8px;border-collapse:separate;overflow:hidden">${topicRows}</table>`
              : ""
          }
          ${solutionsBlock}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0"><tr><td style="border-radius:8px;background:${coverColor}">
            <a href="${esc(resultUrl)}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Ver resultado completo</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e8eae6;text-align:center">
          <span style="font-family:Arial,sans-serif;font-size:11.5px;color:#9aa39d">Enviado con Auditoría</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const sent = await sendEmail({
    to,
    subject: `Tus resultados: ${test.name}`,
    html,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error || "No se pudo enviar el correo" },
      { status: 502 }
    );
  }

  sendCounts.set(responseId, count + 1);
  return NextResponse.json({ ok: true, to });
}
