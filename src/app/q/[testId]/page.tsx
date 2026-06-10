export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ClientQuiz from "@/components/client-quiz";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ inv?: string | string[] }>;
}) {
  const { testId } = await params;
  const sp = await searchParams;
  const inv = typeof sp.inv === "string" ? sp.inv : Array.isArray(sp.inv) ? sp.inv[0] : undefined;

  const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  if (!test || test.status !== "publicado") notFound();
  return <ClientQuiz test={test} inv={inv} />;
}
