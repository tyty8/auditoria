"use client";
import React, { useMemo } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreRing, ScoreBar, ScoreBadge, Avatar, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel, SCORE_LABEL } from "@/lib/scoring";
import { TrendChart, DeltaBadge, monthlyAverages } from "@/components/trend-chart";
import { NotesPanel } from "@/components/notes-panel";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;

export default function ClienteDetailPage({ company, nav }: { company: string; nav: NavFn }) {
  const { tests, responses, modeConfig, mode } = useStore();

  const entityResponses = useMemo(
    () => responses.filter((r) => (r.company || "Sin asignar") === company),
    [responses, company]
  );

  const overallData = useMemo(() => {
    let scoreSum = 0;
    let scoredCount = 0;
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      scoreSum += result.overall;
      scoredCount++;
    });
    const avg = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;
    return { avg, count: entityResponses.length };
  }, [tests, entityResponses]);

  const testBreakdowns = useMemo(() => {
    const byTest: Record<string, { testName: string; rows: { overall: number; topicResults: ReturnType<typeof computeResult>["topicResults"] }[] }> = {};
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      if (!byTest[r.testId]) byTest[r.testId] = { testName: test.name, rows: [] };
      byTest[r.testId].rows.push({ overall: result.overall, topicResults: result.topicResults });
    });
    return Object.entries(byTest).map(([testId, data]) => {
      const avgOverall = data.rows.length > 0
        ? Math.round(data.rows.reduce((s, r) => s + r.overall, 0) / data.rows.length)
        : 0;
      const topicIds = data.rows[0]?.topicResults.map((t) => ({ id: t.topicId, name: t.name })) || [];
      const topicAvgs = topicIds.map((t) => {
        const grades = data.rows.map((r) => r.topicResults.find((tr) => tr.topicId === t.id)?.grade ?? 0);
        return {
          id: t.id,
          name: t.name,
          avg: grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0,
        };
      });
      return { testId, testName: data.testName, avgOverall, topicAvgs, count: data.rows.length };
    });
  }, [tests, entityResponses]);

  const triggeredSolutions = useMemo(() => {
    const seen = new Set<string>();
    const sols: (Solution & { testName: string; count: number })[] = [];
    const countMap: Record<string, number> = {};
    const solMap: Record<string, Solution & { testName: string }> = {};
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      result.triggered.forEach((sol) => {
        const key = sol.id;
        countMap[key] = (countMap[key] || 0) + 1;
        if (!solMap[key]) solMap[key] = { ...sol, testName: test.name };
      });
    });
    Object.entries(solMap).forEach(([id, sol]) => {
      sols.push({ ...sol, count: countMap[id] });
    });
    return sols;
  }, [tests, entityResponses]);

  // Score-over-time: average overall score per month across all questionnaires.
  const trend = useMemo(() => {
    const scored: { submittedAt?: string | null; score: number }[] = [];
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      scored.push({
        submittedAt: r.submittedAt,
        score: computeResult(test.topics || [], test.solutions || [], r.answers || {}).overall,
      });
    });
    return monthlyAverages(scored);
  }, [tests, entityResponses]);

  const trendDelta = trend.length >= 2 ? trend[trend.length - 1].value - trend[trend.length - 2].value : 0;

  const history = useMemo(() => {
    return [...entityResponses]
      .map((r) => {
        const test = tests.find((t) => t.id === r.testId);
        if (!test) return null;
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        return { row: r, testName: test.name, overall: result.overall };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const da = a!.row.submittedAt ? new Date(a!.row.submittedAt).getTime() : 0;
        const db = b!.row.submittedAt ? new Date(b!.row.submittedAt).getTime() : 0;
        return db - da;
      }) as { row: typeof entityResponses[0]; testName: string; overall: number }[];
  }, [tests, entityResponses]);

  const bucket = scoreBucket(overallData.avg);
  const color = SCORE_HEX[bucket];

  return (
    <PageWrap>
      {/* Back button */}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => nav("clientes")}
        style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}
      >
        <Icon name="back" size={16} /> Volver a {modeConfig.groupTitle}
      </button>

      {/* Header */}
      <div className="card" style={{ padding: "28px 32px", marginBottom: 24, display: "flex", alignItems: "center", gap: 28 }}>
        <ScoreRing value={overallData.avg} size={120} stroke={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{modeConfig.groupNounCap}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 8 }}>{company}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className={"badge badge-" + bucket} style={{ fontSize: 13 }}>{tierLabel(overallData.avg)}</span>
            <span className="badge">{overallData.count} evaluaci{overallData.count === 1 ? "ón" : "ones"}</span>
            <span className="badge" style={{ color }}>{SCORE_LABEL[bucket]}</span>
            {trend.length >= 2 && <DeltaBadge delta={trendDelta} />}
          </div>
        </div>
      </div>

      {entityResponses.length === 0 ? (
        <EmptyState icon="clipboard" title="Sin evaluaciones" sub="Aún no hay evaluaciones para esta entidad." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Evolution over time */}
          {trend.length >= 2 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Evolución del puntaje</h2>
                <DeltaBadge delta={trendDelta} />
              </div>
              <div className="card" style={{ padding: "18px 20px" }}>
                <TrendChart points={trend} />
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
                  Promedio mensual de todas las evaluaciones de {company}.
                </div>
              </div>
            </section>
          )}

          {/* Per-questionnaire breakdown */}
          {testBreakdowns.length > 0 && (
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Desglose por cuestionario</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {testBreakdowns.map((td) => (
                  <div key={td.testId} className="card" style={{ overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{td.testName}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{td.count} respuesta{td.count !== 1 ? "s" : ""}</div>
                      </div>
                      <ScoreBadge value={td.avgOverall} />
                    </div>
                    {td.topicAvgs.length > 0 && (
                      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {td.topicAvgs.map((ta) => {
                          const tb = scoreBucket(ta.avg);
                          return (
                            <div key={ta.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 140, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "none" }}>
                                {ta.name}
                              </div>
                              <div style={{ flex: 1 }}>
                                <ScoreBar value={ta.avg} height={7} showVal />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Solutions panel */}
          {triggeredSolutions.length > 0 && (
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>
                Soluciones recomendadas
                <span className="badge" style={{ marginLeft: 10, fontSize: 12 }}>{triggeredSolutions.length}</span>
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {triggeredSolutions.map((sol) => (
                  <div key={sol.id} className="card" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{sol.name}</span>
                          {sol.category && <span className="tagmini">{sol.category}</span>}
                          {sol.count > 1 && (
                            <span className="badge" style={{ fontSize: 11 }}>×{sol.count}</span>
                          )}
                        </div>
                        {sol.description && (
                          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>{sol.description}</p>
                        )}
                        {sol.actions && sol.actions.length > 0 && (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 3 }}>
                            {sol.actions.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Consultant notes */}
          <section>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Notas del consultor</h2>
            <NotesPanel company={company} mode={mode} />
          </section>

          {/* Response history */}
          <section>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Historial de evaluaciones</h2>
            <div className="card" style={{ overflow: "hidden" }}>
              {history.map((h, i) => (
                <div
                  key={h.row.id}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < history.length - 1 ? "1px solid var(--line)" : "none" }}
                >
                  <Avatar name={h.row.respondent || h.row.email || "?"} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>
                      {h.row.respondent || h.row.email || "Anónimo"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>
                      {h.testName}
                      {h.row.submittedAt ? ` · ${new Date(h.row.submittedAt).toLocaleDateString("es")}` : ""}
                      {h.row.role ? ` · ${h.row.role}` : ""}
                    </div>
                  </div>
                  <ScoreBadge value={h.overall} />
                  <a
                    href={`/q/${h.row.testId}/result/${h.row.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Ver resultado"
                    style={{ padding: 5, width: 28, height: 28 }}
                  >
                    <Icon name="external" size={13} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </PageWrap>
  );
}
