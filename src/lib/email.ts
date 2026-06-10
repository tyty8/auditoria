// Email delivery via the Resend HTTP API (no SDK dependency).
// RESEND_API_KEY – API key from https://resend.com
// EMAIL_FROM     – verified sender, e.g. "Auditoría <hola@tudominio.com>"
// APP_URL        – public base URL used in links (falls back to the request origin)

export type SendResult = { ok: boolean; error?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no está configurado. Agrega la variable de entorno para habilitar el envío de emails." };
  }
  const from = process.env.EMAIL_FROM || "Auditoría <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.message || `Error del proveedor de email (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo conectar con el proveedor de email" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared branded shell for all outgoing emails.
function shell(opts: { coverColor: string; orgName: string; heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0"><tr><td style="border-radius:8px;background:${opts.coverColor}">
        <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(opts.ctaLabel)}</a>
      </td></tr></table>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f5f3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f3;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:${opts.coverColor};padding:28px 32px;text-align:center">
          <span style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.85)">${escapeHtml(opts.orgName)}</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:21px;color:#1c2420">${escapeHtml(opts.heading)}</h1>
          <div style="font-family:Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#3d4742">${opts.bodyHtml}</div>
          ${cta}
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e8eae6;text-align:center">
          <span style="font-family:Arial,sans-serif;font-size:11.5px;color:#9aa39d">Enviado con Auditoría</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function invitationEmail(opts: {
  recipientName?: string | null;
  testName: string;
  description?: string | null;
  orgName: string;
  coverColor: string;
  link: string;
}): { subject: string; html: string } {
  const hi = opts.recipientName ? `Hola ${escapeHtml(opts.recipientName)},` : "Hola,";
  return {
    subject: `Te invitamos a completar: ${opts.testName}`,
    html: shell({
      coverColor: opts.coverColor,
      orgName: opts.orgName,
      heading: opts.testName,
      bodyHtml: `<p style="margin:0 0 12px">${hi}</p>
        <p style="margin:0 0 12px">Te invitamos a completar la evaluación <strong>${escapeHtml(opts.testName)}</strong>.${opts.description ? " " + escapeHtml(opts.description) : ""}</p>
        <p style="margin:0">Solo toma unos minutos y tus respuestas nos ayudan a mejorar.</p>`,
      ctaLabel: "Comenzar evaluación",
      ctaUrl: opts.link,
    }),
  };
}

export function reminderEmail(opts: {
  recipientName?: string | null;
  testName: string;
  orgName: string;
  coverColor: string;
  link: string;
}): { subject: string; html: string } {
  const hi = opts.recipientName ? `Hola ${escapeHtml(opts.recipientName)},` : "Hola,";
  return {
    subject: `Recordatorio: ${opts.testName} sigue pendiente`,
    html: shell({
      coverColor: opts.coverColor,
      orgName: opts.orgName,
      heading: "Tu evaluación sigue pendiente",
      bodyHtml: `<p style="margin:0 0 12px">${hi}</p>
        <p style="margin:0">Hace unos días te invitamos a completar <strong>${escapeHtml(opts.testName)}</strong> y aún no registramos tu respuesta. ¿Nos regalas unos minutos?</p>`,
      ctaLabel: "Completar ahora",
      ctaUrl: opts.link,
    }),
  };
}

export function digestEmail(opts: {
  recipientName?: string | null;
  overdue: { entityName: string; solutionName: string; dueDate: string }[];
  openCount: number;
  appUrl: string;
}): { subject: string; html: string } {
  const hi = opts.recipientName ? `Hola ${escapeHtml(opts.recipientName)},` : "Hola,";
  const rows = opts.overdue.slice(0, 15).map((t) =>
    `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13px;color:#1c2420"><strong>${escapeHtml(t.entityName)}</strong></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13px;color:#3d4742">${escapeHtml(t.solutionName)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e8eae6;font-family:Arial,sans-serif;font-size:13px;color:#c0492f;white-space:nowrap">${escapeHtml(t.dueDate)}</td>
    </tr>`
  ).join("");
  const table = opts.overdue.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e8eae6;border-radius:8px;border-collapse:separate;overflow:hidden">${rows}</table>
       ${opts.overdue.length > 15 ? `<p style="margin:10px 0 0;font-size:12.5px;color:#9aa39d">…y ${opts.overdue.length - 15} más.</p>` : ""}`
    : `<p style="margin:12px 0 0">No hay acciones atrasadas. ¡Buen trabajo!</p>`;
  return {
    subject: `Resumen semanal: ${opts.overdue.length} acción${opts.overdue.length === 1 ? "" : "es"} atrasada${opts.overdue.length === 1 ? "" : "s"}, ${opts.openCount} abiertas`,
    html: shell({
      coverColor: "#1f8a5b",
      orgName: "Auditoría",
      heading: "Resumen semanal de acciones",
      bodyHtml: `<p style="margin:0 0 12px">${hi}</p>
        <p style="margin:0">Tienes <strong>${opts.openCount}</strong> acciones abiertas, de las cuales <strong>${opts.overdue.length}</strong> están atrasadas.</p>
        ${table}`,
      ctaLabel: "Abrir tablero de acciones",
      ctaUrl: opts.appUrl + "/#soluciones",
    }),
  };
}
