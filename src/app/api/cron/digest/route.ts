import { db } from "@/lib/db";
import { taskActions, tests, users } from "@/lib/schema";
import { eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, digestEmail, emailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { Solution } from "@/lib/schema";

// Weekly cron: emails every admin/consultor a digest of open and overdue
// solution actions. Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const open = await db
    .select({ task: taskActions, test: tests })
    .from(taskActions)
    .innerJoin(tests, eq(taskActions.testId, tests.id))
    .where(ne(taskActions.status, "hecho"));

  const today = new Date().toISOString().slice(0, 10);
  const overdue = open
    .filter(({ task }) => task.dueDate && task.dueDate < today)
    .map(({ task, test }) => {
      const sol = ((test.solutions as Solution[]) || []).find((s) => s.id === task.solutionId);
      return {
        entityName: task.entityName,
        solutionName: sol?.name || task.solutionId,
        dueDate: task.dueDate as string,
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const recipients = (await db.select().from(users)).filter((u) => u.role === "admin" || u.role === "consultor");
  if (recipients.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no admin/consultor users" });
  }

  let sent = 0, failed = 0;
  for (const user of recipients) {
    const tpl = digestEmail({
      recipientName: user.name,
      overdue,
      openCount: open.length,
      appUrl: appBaseUrl(req.nextUrl.origin),
    });
    const result = await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });
    if (result.ok) sent++; else failed++;
  }

  return NextResponse.json({ openCount: open.length, overdueCount: overdue.length, sent, failed });
}
