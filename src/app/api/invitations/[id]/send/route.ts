import { db } from "@/lib/db";
import { invitations, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, invitationEmail, reminderEmail } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { Branding } from "@/lib/schema";

// Sends (or re-sends) the invitation email for a single invitation.
// body: { reminder?: boolean } — when true, uses the reminder template.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const isReminder = Boolean(body?.reminder);

  const [inv] = await db.select().from(invitations).where(eq(invitations.id, id));
  if (!inv) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  if (!inv.email) return NextResponse.json({ error: "La invitación no tiene email" }, { status: 400 });

  const [test] = await db.select().from(tests).where(eq(tests.id, inv.testId));
  if (!test) return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
  if (test.status !== "publicado") {
    return NextResponse.json({ error: "Publica el cuestionario antes de enviar invitaciones" }, { status: 400 });
  }

  const branding = test.branding as Branding | null;
  // ?inv= lets the quiz mark the invitation as opened and key the server-side draft.
  const link = `${appBaseUrl(req.nextUrl.origin)}/q/${test.id}?inv=${inv.id}`;
  const tpl = (isReminder ? reminderEmail : invitationEmail)({
    recipientName: inv.name,
    testName: test.name,
    description: test.description,
    orgName: branding?.orgName || test.name,
    coverColor: branding?.coverColor || test.accent || "#1f8a5b",
    link,
  });

  const result = await sendEmail({ to: inv.email, subject: tpl.subject, html: tpl.html });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const patch = isReminder
    ? { lastReminderAt: new Date() }
    : { status: "enviada", sentAt: new Date() };
  await db.update(invitations).set(patch).where(eq(invitations.id, id));

  const [updated] = await db.select().from(invitations).where(eq(invitations.id, id));
  return NextResponse.json(updated);
}
