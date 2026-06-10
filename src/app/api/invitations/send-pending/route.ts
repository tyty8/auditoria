import { db } from "@/lib/db";
import { invitations, tests } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, invitationEmail, emailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { Branding } from "@/lib/schema";

// Sends all "pendiente" invitations (with email) for a test in one batch.
// body: { testId: string }
export async function POST(req: NextRequest) {
  const { testId } = await req.json().catch(() => ({}));
  if (!testId || typeof testId !== "string") {
    return NextResponse.json({ error: "testId required" }, { status: 400 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ error: "RESEND_API_KEY no está configurado. Agrega la variable de entorno para habilitar el envío de emails." }, { status: 502 });
  }

  const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  if (!test) return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
  if (test.status !== "publicado") {
    return NextResponse.json({ error: "Publica el cuestionario antes de enviar invitaciones" }, { status: 400 });
  }

  const pending = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.testId, testId), eq(invitations.status, "pendiente")));

  const branding = test.branding as Branding | null;
  const baseLink = `${appBaseUrl(req.nextUrl.origin)}/q/${test.id}`;

  let sent = 0, failed = 0;
  for (const inv of pending) {
    if (!inv.email) { failed++; continue; }
    const link = `${baseLink}?inv=${inv.id}`;
    const tpl = invitationEmail({
      recipientName: inv.name,
      testName: test.name,
      description: test.description,
      orgName: branding?.orgName || test.name,
      coverColor: branding?.coverColor || test.accent || "#1f8a5b",
      link,
    });
    const result = await sendEmail({ to: inv.email, subject: tpl.subject, html: tpl.html });
    if (result.ok) {
      await db.update(invitations).set({ status: "enviada", sentAt: new Date() }).where(eq(invitations.id, inv.id));
      sent++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: pending.length });
}
