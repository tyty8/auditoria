export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { tests, responses } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { computeResult } from "@/lib/scoring";
import ResultView from "@/components/result-view";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ testId: string; responseId: string }>;
}) {
  const { testId, responseId } = await params;

  const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  if (!test) notFound();

  const [response] = await db.select().from(responses).where(eq(responses.id, responseId));
  if (!response || response.testId !== testId) notFound();

  const topics = (test.topics as import("@/lib/schema").Topic[]) || [];
  const solutions = (test.solutions as import("@/lib/schema").Solution[]) || [];
  const answers = (response.answers as Record<string, string>) || {};

  const result = computeResult(topics, solutions, answers);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <ResultView
        test={test}
        result={result}
        respondent={response.respondent}
        company={response.company}
      />
    </main>
  );
}
