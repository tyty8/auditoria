export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ClientQuiz from "@/components/client-quiz";

export default async function QuizPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  if (!test || test.status !== "publicado") notFound();
  return <ClientQuiz test={test} />;
}
