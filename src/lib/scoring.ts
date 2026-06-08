import type { Topic, Solution, Condition } from "./schema";

export const SCORE_LABEL: Record<string, string> = { good: "Saludable", warn: "Atención", bad: "Crítico" };
export const SCORE_HEX: Record<string, string> = { good: "#1f8a5b", warn: "#b07d18", bad: "#c0492f" };

export function scoreBucket(g: number): "good" | "warn" | "bad" {
  if (g >= 80) return "good";
  if (g >= 60) return "warn";
  return "bad";
}

export function tierLabel(g: number): string {
  if (g >= 80) return "Óptimo";
  if (g >= 60) return "Consolidado";
  if (g >= 40) return "En desarrollo";
  return "Inicial";
}

export function isQuestionActive(question: { showIf?: { questionId: string; optionIds: string[] } | null }, answers: Record<string, string>): boolean {
  const c = question.showIf;
  if (!c || !c.questionId || !(c.optionIds && c.optionIds.length)) return true;
  const sel = answers[c.questionId];
  return sel != null && c.optionIds.includes(sel);
}

function solutionConditions(sol: Solution): Condition[] {
  if (Array.isArray(sol.conditions) && sol.conditions.length) return sol.conditions;
  return [{
    scope: (sol.scope as "overall" | "topic") || "overall",
    topicId: sol.topicId,
    operator: (sol.operator as "below" | "above" | "between") || "below",
    threshold: sol.threshold ?? 70,
    threshold2: sol.threshold2 ?? 100,
  }];
}

function gradeForScope(cond: Condition, overall: number, topicResults: TopicResult[]): number | null {
  if (cond.scope === "overall") return overall;
  return topicResults.find((r) => r.topicId === cond.topicId)?.grade ?? null;
}

function condMet(cond: Condition, grade: number | null): boolean {
  if (grade == null) return false;
  if (cond.operator === "below") return grade <= cond.threshold;
  if (cond.operator === "above") return grade >= cond.threshold;
  if (cond.operator === "between") return grade >= cond.threshold && grade <= (cond.threshold2 ?? 100);
  return false;
}

export type TopicResult = {
  topicId: string; name: string; scoring: string;
  includeInOverall: boolean; weight: number;
  grade: number; earned: number; max: number;
  answered: number; correct: number; total: number;
  bucket: "good" | "warn" | "bad";
};

export type ComputedResult = {
  topicResults: TopicResult[];
  overall: number;
  overallBucket: "good" | "warn" | "bad";
  triggered: (Solution & { evals: { cond: Condition; grade: number | null; met: boolean }[]; logic: string })[];
};

export function computeResult(
  topics: Topic[],
  solutions: Solution[],
  answers: Record<string, string>
): ComputedResult {
  const topicResults: TopicResult[] = topics.map((t) => {
    let grade = 0, earned = 0, max = 0, answered = 0, correct = 0;
    const qs = t.questions.filter((q) => isQuestionActive(q, answers));
    if (t.scoring === "weighted") {
      qs.forEach((q) => {
        const maxOpt = Math.max(0, ...q.options.map((o) => o.points));
        max += maxOpt;
        const sel = answers[q.id];
        if (sel != null) {
          answered++;
          const opt = q.options.find((o) => o.id === sel);
          if (opt) earned += opt.points;
        }
      });
      grade = max > 0 ? Math.round((earned / max) * 100) : 0;
    } else {
      qs.forEach((q) => {
        const sel = answers[q.id];
        if (sel != null) {
          answered++;
          const opt = q.options.find((o) => o.id === sel);
          if (opt && opt.correct) correct++;
        }
      });
      grade = qs.length > 0 ? Math.round((correct / qs.length) * 100) : 0;
    }
    return {
      topicId: t.id, name: t.name, scoring: t.scoring,
      includeInOverall: t.includeInOverall !== false,
      weight: t.weight == null ? 1 : t.weight,
      grade, earned, max, answered, correct, total: qs.length,
      bucket: scoreBucket(grade),
    };
  });

  const counted = topicResults.filter((r) => r.includeInOverall);
  const wSum = counted.reduce((s, r) => s + (r.weight || 0), 0);
  const overall = counted.length
    ? wSum > 0
      ? Math.round(counted.reduce((s, r) => s + r.grade * (r.weight || 0), 0) / wSum)
      : Math.round(counted.reduce((s, r) => s + r.grade, 0) / counted.length)
    : 0;

  const triggered = (solutions || [])
    .map((sol) => {
      const conds = solutionConditions(sol);
      const evals = conds.map((c) => {
        const g = gradeForScope(c, overall, topicResults);
        return { cond: c, grade: g, met: condMet(c, g) };
      });
      const logic = sol.logic === "any" ? "any" : "all";
      const hit = logic === "any" ? evals.some((e) => e.met) : evals.every((e) => e.met);
      return hit ? { ...sol, evals, logic } : null;
    })
    .filter(Boolean) as ComputedResult["triggered"];

  return { topicResults, overall, overallBucket: scoreBucket(overall), triggered };
}

// Lightweight overall-score helper used by the API list endpoint.
// Computes only the overall grade without allocating per-topic detail.
export function computeOverallScore(topics: Topic[], answers: Record<string, string>): number {
  if (!topics || topics.length === 0) return 0;
  const topicGrades = topics.map((t) => {
    const qs = t.questions.filter((q) => {
      if (!q.showIf || !q.showIf.questionId || !q.showIf.optionIds?.length) return true;
      return q.showIf.optionIds.includes(answers[q.showIf.questionId]);
    });
    let grade = 0;
    if (t.scoring === "weighted") {
      let earned = 0, max = 0;
      qs.forEach((q) => {
        const maxPts = Math.max(0, ...q.options.map((o) => o.points));
        max += maxPts;
        const sel = answers[q.id];
        if (sel != null) {
          const opt = q.options.find((o) => o.id === sel);
          if (opt) earned += opt.points;
        }
      });
      grade = max > 0 ? Math.round((earned / max) * 100) : 0;
    } else {
      let correct = 0;
      qs.forEach((q) => {
        const sel = answers[q.id];
        if (sel != null) {
          const opt = q.options.find((o) => o.id === sel);
          if (opt && opt.correct) correct++;
        }
      });
      grade = qs.length > 0 ? Math.round((correct / qs.length) * 100) : 0;
    }
    return { grade, weight: t.weight == null ? 1 : t.weight, include: t.includeInOverall !== false };
  });

  const counted = topicGrades.filter((r) => r.include);
  if (counted.length === 0) return 0;
  const wSum = counted.reduce((s, r) => s + r.weight, 0);
  return wSum > 0
    ? Math.round(counted.reduce((s, r) => s + r.grade * r.weight, 0) / wSum)
    : Math.round(counted.reduce((s, r) => s + r.grade, 0) / counted.length);
}

export function totalQuestions(topics: Topic[]): number {
  return topics.reduce((s, t) => s + t.questions.length, 0);
}

export function uid(prefix = "id"): string {
  return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  // crypto.getRandomValues for unbiased shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
