export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { tests, responses } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { computeResult, computeOverallScore } from "@/lib/scoring";
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

  // Benchmark: average overall score across ALL responses for this test
  // (only computed when the branding opts in — keeps the common path light).
  let average: number | null = null;
  if (test.branding?.showBenchmark) {
    const rows = await db
      .select({ answers: responses.answers })
      .from(responses)
      .where(eq(responses.testId, testId));
    if (rows.length > 0) {
      const sum = rows.reduce(
        (s, r) => s + computeOverallScore(topics, (r.answers as Record<string, string>) || {}),
        0
      );
      average = Math.round(sum / rows.length);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <ResultView
        test={test}
        result={result}
        respondent={response.respondent}
        company={response.company}
        answers={answers}
        responseId={response.id}
        responseEmail={response.email}
        average={average}
      />
    </main>
  );
}
