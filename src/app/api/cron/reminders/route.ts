import { db } from "@/lib/db";
import { invitations, tests } from "@/lib/schema";
import { eq, and, isNull, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, reminderEmail, emailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { Branding } from "@/lib/schema";

const REMINDER_AFTER_DAYS = 3;

// Daily cron: nudges invitations that were sent N+ days ago, are still not
// completed, and haven't been reminded in the last N days.
// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db
    .select({ inv: invitations, test: tests })
    .from(invitations)
    .innerJoin(tests, eq(invitations.testId, tests.id))
    .where(and(
      eq(invitations.status, "enviada"),
      eq(tests.status, "publicado"),
      lt(invitations.sentAt, cutoff),
      or(isNull(invitations.lastReminderAt), lt(invitations.lastReminderAt, cutoff)),
    ));

  let sent = 0, failed = 0;
  for (const { inv, test } of stale) {
    if (!inv.email) continue;
    const branding = test.branding as Branding | null;
    const tpl = reminderEmail({
      recipientName: inv.name,
      testName: test.name,
      orgName: branding?.orgName || test.name,
      coverColor: branding?.coverColor || test.accent || "#1f8a5b",
      link: `${appBaseUrl(req.nextUrl.origin)}/q/${test.id}`,
    });
    const result = await sendEmail({ to: inv.email, subject: tpl.subject, html: tpl.html });
    if (result.ok) {
      await db.update(invitations).set({ lastReminderAt: new Date() }).where(eq(invitations.id, inv.id));
      sent++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ candidates: stale.length, sent, failed });
}
