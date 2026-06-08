"use client";
import React, { useMemo } from "react";
import { useStore } from "@/components/store";
import { PageWrap, StatCard, EmptyState, ScoreBadge, Icon } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, totalQuestions } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;

// ---- Horizontal bar ----
function HBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 8, background: "var(--surface-sunken)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color || "var(--primary)", borderRadius: 99, transition: "width .6s cubic-bezier(.2,.7,.3,1)" }} />
    </div>
  );
}

export default function HomePage({ nav }: { nav: NavFn }) {
  const { tests, responses, modeConfig } = useStore();

  // ---- Aggregate stats ----
  const stats = useMemo(() => {
    const activeTests = tests.filter((t) => t.status === "publicado");
    const totalResponses = responses.length;

    let scoreSum = 0;
    let scoredCount = 0;
    let completedCount = 0;

    responses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      scoreSum += result.overall;
      scoredCount++;
      const answered = Object.keys(r.answers || {}).length;
      const total = totalQuestions(test.topics || []);
      if (total > 0 && answered >= total) completedCount++;
    });

    const avgScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;
    const completionRate = totalResponses > 0 ? Math.round((completedCount / totalResponses) * 100) : 0;

    return { activeTests: activeTests.length, totalResponses, avgScore, completionRate };
  }, [tests, responses]);

  // ---- Per-test stats ----
  const testStats = useMemo(() => {
    return tests.map((test) => {
      const testResponses = responses.filter((r) => r.testId === test.id);
      let scoreSum = 0;
      testResponses.forEach((r) => {
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        scoreSum += result.overall;
      });
      const avgScore = testResponses.length > 0 ? Math.round(scoreSum / testResponses.length) : 0;
      return {
        id: test.id,
        name: test.name,
        domain: test.domain,
        status: test.status,
        accent: test.accent || "var(--primary)",
        responseCount: testResponses.length,
        avgScore,
        tags: test.tags || [],
      };
    }).sort((a, b) => b.responseCount - a.responseCount);
  }, [tests, responses]);

  const maxResponses = Math.max(1, ...testStats.map((t) => t.responseCount));

  // ---- Top solutions ----
  const topSolutions = useMemo(() => {
    const counts: Record<string, { name: string; count: number; category: string }> = {};

    responses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      result.triggered.forEach((sol) => {
        if (!counts[sol.id]) counts[sol.id] = { name: sol.name, count: 0, category: sol.category || "" };
        counts[sol.id].count++;
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }));
  }, [tests, responses]);

  const maxSolCount = Math.max(1, ...topSolutions.map((s) => s.count));

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Inicio</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Resumen general de actividad en todos los cuestionarios
        </p>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 36 }}>
        <StatCard
          label="Cuestionarios activos"
          value={stats.activeTests}
          icon="clipboard"
          color="var(--primary)"
          sub={`de ${tests.length} total`}
        />
        <StatCard
          label="Respuestas totales"
          value={stats.totalResponses}
          icon="users"
          color="var(--info)"
          sub="todas las evaluaciones"
        />
        <StatCard
          label="Puntaje promedio"
          value={stats.avgScore}
          icon="gauge"
          color={SCORE_HEX[scoreBucket(stats.avgScore)] || "var(--primary)"}
          sub={stats.avgScore >= 80 ? "Saludable" : stats.avgScore >= 60 ? "Atención" : "Crítico"}
        />
        <StatCard
          label="Tasa de completud"
          value={stats.completionRate + "%"}
          icon="check2"
          color="var(--good)"
          sub="respuestas completadas"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Cuestionarios por respuestas */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Cuestionarios por respuestas</h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => nav("dashboard")}
              style={{ color: "var(--primary)", fontWeight: 600 }}
            >
              Ver todos <Icon name="arrowRight" size={14} />
            </button>
          </div>

          {testStats.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="Sin cuestionarios"
              sub="Crea tu primer cuestionario para ver estadísticas aquí."
              action={
                <button className="btn btn-primary btn-sm" onClick={() => nav("dashboard")}>
                  <Icon name="plus" size={15} /> Ir a cuestionarios
                </button>
              }
            />
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {testStats.map((test, i) => (
                <div
                  key={test.id}
                  onClick={() => nav("responses", { testId: test.id })}
                  style={{
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    borderBottom: i < testStats.length - 1 ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                    transition: "background .13s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* accent dot */}
                  <div style={{ width: 8, height: 8, borderRadius: 99, background: test.accent, flex: "none" }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {test.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <HBar value={test.responseCount} max={maxResponses} color={test.accent} />
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", minWidth: 20, textAlign: "right" }}>
                        {test.responseCount}
                      </span>
                    </div>
                  </div>

                  {test.responseCount > 0 ? (
                    <ScoreBadge value={test.avgScore} />
                  ) : (
                    <span className="badge" style={{ fontSize: 11 }}>Sin respuestas</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top solutions */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Soluciones más recomendadas</h2>
          </div>

          {topSolutions.length === 0 ? (
            <EmptyState
              icon="spark"
              title="Sin datos de soluciones"
              sub="Agrega respuestas a los cuestionarios para ver qué soluciones se activan con más frecuencia."
            />
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {topSolutions.map((sol, i) => (
                <div
                  key={sol.id}
                  style={{
                    padding: "12px 18px",
                    borderBottom: i < topSolutions.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {sol.name}
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginLeft: 10, flex: "none" }}
                    >
                      {sol.count}×
                    </span>
                  </div>
                  {sol.category && (
                    <div style={{ marginBottom: 6 }}>
                      <span className="tagmini">{sol.category}</span>
                    </div>
                  )}
                  <HBar value={sol.count} max={maxSolCount} color="var(--primary)" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageWrap>
  );
}
