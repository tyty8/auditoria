"use client";
import React, { useMemo } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreRing, ScoreBar, ScoreBadge, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel, SCORE_LABEL } from "@/lib/scoring";
import { NotesPanel } from "@/components/notes-panel";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

export default function ReporteDetailPage({ company, nav, toast }: { company: string; nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig, mode } = useStore();

  const entityResponses = useMemo(
    () => responses.filter((r) => (r.company || "Sin asignar") === company),
    [responses, company]
  );

  const overallData = useMemo(() => {
    let sum = 0;
    let count = 0;
    let lastDate = "";
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      sum += result.overall;
      count++;
      if (r.submittedAt && (!lastDate || r.submittedAt > lastDate)) lastDate = r.submittedAt;
    });
    return { avg: count > 0 ? Math.round(sum / count) : 0, count, lastDate };
  }, [tests, entityResponses]);

  const testBreakdowns = useMemo(() => {
    const byTest: Record<string, {
      testName: string;
      rows: { overall: number; topicResults: ReturnType<typeof computeResult>["topicResults"] }[];
    }> = {};
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      if (!byTest[r.testId]) byTest[r.testId] = { testName: test.name, rows: [] };
      byTest[r.testId].rows.push({ overall: result.overall, topicResults: result.topicResults });
    });
    return Object.entries(byTest).map(([testId, data]) => {
      const avgOverall = data.rows.length > 0
        ? Math.round(data.rows.reduce((s, r) => s + r.overall, 0) / data.rows.length) : 0;
      const topicAvgs = (data.rows[0]?.topicResults || []).map((t) => {
        const grades = data.rows.map((r) => r.topicResults.find((tr) => tr.topicId === t.topicId)?.grade ?? 0);
        return {
          id: t.topicId,
          name: t.name,
          avg: grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0,
        };
      });
      return { testId, testName: data.testName, avgOverall, topicAvgs };
    });
  }, [tests, entityResponses]);

  const recommendedSolutions = useMemo(() => {
    const seen = new Set<string>();
    const sols: (Solution & { testName: string; count: number })[] = [];
    const countMap: Record<string, number> = {};
    const solMap: Record<string, Solution & { testName: string }> = {};
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      result.triggered.forEach((sol) => {
        countMap[sol.id] = (countMap[sol.id] || 0) + 1;
        if (!solMap[sol.id]) solMap[sol.id] = { ...sol, testName: test.name };
      });
    });
    Object.entries(solMap).forEach(([id, sol]) => {
      sols.push({ ...sol, count: countMap[id] });
    });
    return sols;
  }, [tests, entityResponses]);

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#reporte/${encodeURIComponent(company)}`;
    navigator.clipboard.writeText(url).then(() => toast("Enlace copiado", "link")).catch(() => toast("Error al copiar", "alert"));
  }

  const bucket = scoreBucket(overallData.avg);
  const color = SCORE_HEX[bucket];
  const dateStr = overallData.lastDate
    ? new Date(overallData.lastDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {/* Print styles injected inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .card { box-shadow: none !important; border: 1px solid #e0e0e0 !important; }
        }
      `}</style>

      <PageWrap maxWidth="860px">
        {/* Back + actions — hidden on print */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav("reportes")}>
            <Icon name="back" size={16} /> Volver a reportes
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
            <Icon name="link" size={14} /> Copiar enlace
          </button>
          <a
            href={`/api/reports/${encodeURIComponent(company)}/pdf?mode=${mode}`}
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: "none" }}
            download
          >
            <Icon name="download" size={14} /> Descargar PDF
          </a>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Icon name="doc" size={14} /> Imprimir
          </button>
        </div>

        {entityResponses.length === 0 ? (
          <EmptyState icon="doc" title="Sin datos" sub="No hay evaluaciones para generar este reporte." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Report header */}
            <div className="card" style={{ padding: "36px 40px", background: "var(--surface-2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>
                <ScoreRing value={overallData.avg} size={130} stroke={10} animate={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 6 }}>
                    Reporte de evaluación · {modeConfig.singular}
                  </div>
                  <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ink)", marginBottom: 10 }}>
                    {company}
                  </h1>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <span className={"badge badge-" + bucket} style={{ fontSize: 13, padding: "5px 12px" }}>
                      {tierLabel(overallData.avg)} · {SCORE_LABEL[bucket]}
                    </span>
                    <span className="badge">{overallData.count} evaluaci{overallData.count === 1 ? "ón" : "ones"}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    Última evaluación: {dateStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Per-test breakdowns */}
            {testBreakdowns.length > 0 && (
              <section>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: "-.01em" }}>
                  Resultados por cuestionario
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {testBreakdowns.map((td) => (
                    <div key={td.testId} className="card" style={{ overflow: "hidden" }}>
                      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{td.testName}</div>
                        </div>
                        <ScoreBadge value={td.avgOverall} />
                      </div>
                      {td.topicAvgs.length > 0 && (
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                          {td.topicAvgs.map((ta) => (
                            <div key={ta.id}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>{ta.name}</span>
                                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: SCORE_HEX[scoreBucket(ta.avg)] }}>{ta.avg}</span>
                              </div>
                              <ScoreBar value={ta.avg} height={8} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommended solutions */}
            {recommendedSolutions.length > 0 && (
              <section>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: "-.01em" }}>
                  Soluciones recomendadas
                  <span className="badge" style={{ marginLeft: 10, fontSize: 12, fontWeight: 700 }}>{recommendedSolutions.length}</span>
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {recommendedSolutions.map((sol) => (
                    <div key={sol.id} className="card" style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flex: "none", marginTop: 2 }}>
                          <Icon name="spark" size={17} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                            <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{sol.name}</span>
                            {sol.category && (
                              <span className="tagmini">{sol.category}</span>
                            )}
                            {sol.count > 1 && (
                              <span className="badge" style={{ fontSize: 11 }}>×{sol.count}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 8 }}>{sol.testName}</div>
                          {sol.description && (
                            <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 10px", lineHeight: 1.55 }}>
                              {sol.description}
                            </p>
                          )}
                          {sol.actions && sol.actions.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                                Pasos de acción
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                                {sol.actions.map((a, i) => (
                                  <li key={i} style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sol.link && (
                            <a
                              href={sol.link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
                            >
                              <Icon name="external" size={13} /> {sol.link.label}
                            </a>
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
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, letterSpacing: "-.01em" }}>
                Notas del consultor
              </h2>
              <NotesPanel company={company} mode={mode} />
            </section>

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-3)", padding: "16px 0 8px", borderTop: "1px solid var(--line)" }}>
              Reporte generado por Auditoría · {company} · {dateStr}
            </div>
          </div>
        )}
      </PageWrap>
    </>
  );
}
