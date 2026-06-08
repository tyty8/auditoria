"use client";
import React, { useMemo, useState } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreBar, ScoreBadge, Avatar, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, SCORE_LABEL, tierLabel } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type StatusFilter = "todos" | "good" | "warn" | "bad";

type EntityRow = {
  name: string;
  avg: number;
  bucket: "good" | "warn" | "bad";
  totalResponses: number;
  testScores: { testId: string; testName: string; avg: number; bucket: "good" | "warn" | "bad" }[];
};

export default function TableroPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig } = useStore();
  const [search, setSearch] = useState("");
  const [cuestionarioFilter, setCuestionarioFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const entities = useMemo((): EntityRow[] => {
    const map: Record<string, { name: string; testScoreMap: Record<string, number[]>; totalResponses: number }> = {};
    responses.forEach((r) => {
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, testScoreMap: {}, totalResponses: 0 };
      map[key].totalResponses++;
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      if (!map[key].testScoreMap[r.testId]) map[key].testScoreMap[r.testId] = [];
      map[key].testScoreMap[r.testId].push(result.overall);
    });

    return Object.values(map).map((e) => {
      const testScores = Object.entries(e.testScoreMap).map(([testId, scores]) => {
        const test = tests.find((t) => t.id === testId);
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { testId, testName: test?.name || testId, avg, bucket: scoreBucket(avg) };
      });
      const allScores = testScores.map((t) => t.avg);
      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
      return { name: e.name, avg, bucket: scoreBucket(avg), totalResponses: e.totalResponses, testScores };
    }).sort((a, b) => a.avg - b.avg);
  }, [tests, responses]);

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "todos" && e.bucket !== statusFilter) return false;
      if (cuestionarioFilter !== "all") {
        const ts = e.testScores.find((t) => t.testId === cuestionarioFilter);
        if (!ts) return false;
      }
      return true;
    });
  }, [entities, search, statusFilter, cuestionarioFilter]);

  const kpis = useMemo(() => {
    const count = entities.length;
    const avg = count > 0 ? Math.round(entities.reduce((s, e) => s + e.avg, 0) / count) : 0;
    const healthy = entities.filter((e) => e.bucket === "good").length;
    const critical = entities.filter((e) => e.bucket === "bad").length;
    const pctHealthy = count > 0 ? Math.round((healthy / count) * 100) : 0;
    const pctCritical = count > 0 ? Math.round((critical / count) * 100) : 0;
    return { count, avg, pctHealthy, pctCritical };
  }, [entities]);

  const distrib = useMemo(() => {
    const n = filteredEntities.length || 1;
    const good = filteredEntities.filter((e) => e.bucket === "good").length;
    const warn = filteredEntities.filter((e) => e.bucket === "warn").length;
    const bad = filteredEntities.filter((e) => e.bucket === "bad").length;
    return {
      good: { count: good, pct: Math.round((good / n) * 100) },
      warn: { count: warn, pct: Math.round((warn / n) * 100) },
      bad: { count: bad, pct: Math.round((bad / n) * 100) },
    };
  }, [filteredEntities]);

  const allTests = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    responses.forEach((r) => {
      if (!seen.has(r.testId)) {
        const test = tests.find((t) => t.id === r.testId);
        if (test) { seen.add(r.testId); result.push({ id: r.testId, name: test.name }); }
      }
    });
    return result;
  }, [tests, responses]);

  function clearFilters() {
    setSearch("");
    setCuestionarioFilter("all");
    setStatusFilter("todos");
  }

  function exportCSV() {
    // Simple self-contained CSV export — no external dependencies.
    function toCSV(rows: (string | number)[][]): string {
      return rows.map((row) =>
        row.map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        }).join(",")
      ).join("\n");
    }

    function downloadCSV(content: string, filename: string) {
      const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    const label = modeConfig.label.toLowerCase();

    // Sheet 1 — Ranking
    const rankRows: (string | number)[][] = [
      ["Entidad", "Puntaje", "Nivel", "Estado", "Respuestas"],
      ...filteredEntities.map((e) => [e.name, e.avg, tierLabel(e.avg), SCORE_LABEL[e.bucket], e.totalResponses]),
    ];
    downloadCSV(toCSV(rankRows), `tablero_${label}_ranking.csv`);

    // Sheet 2 — Mapa de calor
    const heatRows: (string | number)[][] = [
      ["Entidad", ...allTests.map((t) => t.name), "Promedio Global"],
      ...filteredEntities.map((e) => [
        e.name,
        ...allTests.map((t) => {
          const ts = e.testScores.find((s) => s.testId === t.id);
          return ts ? ts.avg : "";
        }),
        e.avg,
      ]),
    ];
    downloadCSV(toCSV(heatRows), `tablero_${label}_mapa_calor.csv`);

    toast("Archivos CSV exportados", "download");
  }

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Tablero comparativo</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Compara el desempeño de {modeConfig.groupNounPlural.toLowerCase()} en todos los cuestionarios.
        </p>
      </div>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: modeConfig.groupNounPlural, value: kpis.count, icon: modeConfig.icon, color: "var(--primary)" },
          { label: "Puntaje promedio", value: kpis.avg, icon: "gauge", color: SCORE_HEX[scoreBucket(kpis.avg)] },
          { label: "Saludables", value: kpis.pctHealthy + "%", icon: "check2", color: "var(--good)" },
          { label: "Críticos", value: kpis.pctCritical + "%", icon: "alert", color: "var(--bad)" },
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: k.color }}>
                <Icon name={k.icon} size={15} />
              </div>
              <span className="eyebrow" style={{ fontSize: 10 }}>{k.label}</span>
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.03em", lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 180px" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
          <input
            className="input"
            placeholder={`Buscar ${modeConfig.groupNounPlural.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 13 }}
          />
        </div>

        <select
          className="input"
          value={cuestionarioFilter}
          onChange={(e) => setCuestionarioFilter(e.target.value)}
          style={{ flex: "0 1 180px", fontSize: 13 }}
        >
          <option value="all">Todos los cuestionarios</option>
          {allTests.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <div className="seg" style={{ flex: "none" }}>
          {(["todos", "good", "warn", "bad"] as const).map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "on" : ""}
              onClick={() => setStatusFilter(s)}
            >
              {s === "todos" ? "Todos" : SCORE_LABEL[s]}
            </button>
          ))}
        </div>

        <span className="badge" style={{ flex: "none" }}>
          {filteredEntities.length} de {entities.length}
        </span>

        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <Icon name="x" size={14} /> Limpiar
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV}>
            <Icon name="download" size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {entities.length === 0 ? (
        <EmptyState
          icon={modeConfig.icon}
          title={modeConfig.emptyTitle}
          sub={modeConfig.emptyClients}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Distribution donut (CSS-based) */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Distribución de resultados</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 88, height: 88, flex: "none" }}>
                <svg width={88} height={88} viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
                  {(() => {
                    const r = 34;
                    const circ = 2 * Math.PI * r;
                    const cx = 44, cy = 44;
                    const segs = [
                      { pct: distrib.good.pct, color: SCORE_HEX.good },
                      { pct: distrib.warn.pct, color: SCORE_HEX.warn },
                      { pct: distrib.bad.pct, color: SCORE_HEX.bad },
                    ];
                    let offset = 0;
                    return segs.map((seg, i) => {
                      const dash = (seg.pct / 100) * circ;
                      const el = (
                        <circle
                          key={i}
                          cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={12}
                          strokeDasharray={`${dash} ${circ - dash}`}
                          strokeDashoffset={-offset}
                        />
                      );
                      offset += dash;
                      return el;
                    });
                  })()}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{filteredEntities.length}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["good", "warn", "bad"] as const).map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 99, background: SCORE_HEX[b], flex: "none" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", minWidth: 70 }}>{SCORE_LABEL[b]}</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{distrib[b].count}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>({distrib[b].pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking list */}
          <section>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Ranking de {modeConfig.groupNounPlural.toLowerCase()}</h2>
            {filteredEntities.length === 0 ? (
              <EmptyState icon="search" title="Sin resultados" sub="Cambia los filtros para ver entidades." />
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {filteredEntities.map((e, i) => (
                  <div
                    key={e.name}
                    style={{ padding: "12px 18px", borderBottom: i < filteredEntities.length - 1 ? "1px solid var(--line)" : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "background .12s" }}
                    onClick={() => nav("cliente", { company: e.name })}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                  >
                    <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 22, textAlign: "right", flex: "none" }}>
                      {i + 1}
                    </span>
                    <Avatar name={e.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 5 }}>{e.name}</div>
                      <ScoreBar value={e.avg} height={6} />
                    </div>
                    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {e.testScores.map((ts) => (
                        <span key={ts.testId} className={"badge badge-" + ts.bucket} style={{ fontSize: 10, padding: "2px 7px" }} title={ts.testName}>
                          {ts.avg}
                        </span>
                      ))}
                      <ScoreBadge value={e.avg} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Heatmap matrix */}
          {allTests.length > 0 && filteredEntities.length > 0 && (
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Mapa de calor</h2>
              <div className="card" style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700, fontSize: 11, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", minWidth: 140, whiteSpace: "nowrap" }}>
                        {modeConfig.groupNounCap}
                      </th>
                      {allTests.map((t) => (
                        <th key={t.id} style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, fontSize: 11, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap", maxWidth: 120 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{t.name}</div>
                        </th>
                      ))}
                      <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, fontSize: 11, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        Global
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntities.map((e, i) => (
                      <tr
                        key={e.name}
                        style={{ borderBottom: i < filteredEntities.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                        onClick={() => nav("cliente", { company: e.name })}
                        onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                        onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                      >
                        <td style={{ padding: "10px 16px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{e.name}</td>
                        {allTests.map((t) => {
                          const ts = e.testScores.find((s) => s.testId === t.id);
                          if (!ts) return (
                            <td key={t.id} style={{ textAlign: "center", padding: "10px 14px", color: "var(--ink-4)" }}>—</td>
                          );
                          return (
                            <td key={t.id} style={{ textAlign: "center", padding: "10px 14px" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 28, borderRadius: 6, background: SCORE_HEX[ts.bucket] + "22", color: SCORE_HEX[ts.bucket] }}>
                                <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{ts.avg}</span>
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", padding: "10px 14px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 28, borderRadius: 6, background: SCORE_HEX[e.bucket] + "33", color: SCORE_HEX[e.bucket] }}>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>{e.avg}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </PageWrap>
  );
}
