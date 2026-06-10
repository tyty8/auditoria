"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreBar, ScoreBadge, Avatar, EmptyState, PageWrap, Drawer, Sparkline, Skeleton, SkeletonCard, MenuButton, timeAgo } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, SCORE_LABEL, tierLabel } from "@/lib/scoring";
import { DeltaBadge, monthlyAverages } from "@/components/trend-chart";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type StatusFilter = "todos" | "good" | "warn" | "bad";
type PeriodId = "all" | "30d" | "qtr" | "prevQtr" | "year";

const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "qtr", label: "Este trimestre" },
  { id: "prevQtr", label: "Trimestre anterior" },
  { id: "year", label: "Este año" },
];

type EntityRow = {
  name: string;
  avg: number;
  bucket: "good" | "warn" | "bad";
  totalResponses: number;
  delta: number | null; // recent half vs. older half of the period, null when <2 dated responses
  trendValues: number[]; // monthly average scores
  testScores: { testId: string; testName: string; avg: number; bucket: "good" | "warn" | "bad" }[];
};

export default function TableroPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig, loading, refreshTests, refreshResponses } = useStore();
  const [search, setSearch] = useState("");
  const [cuestionarioFilter, setCuestionarioFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [period, setPeriod] = useState<PeriodId>("all");
  const [sortKey, setSortKey] = useState<string | null>(null); // null | "name" | "__global" | testId
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drill, setDrill] = useState<{ company: string; testId: string } | null>(null);
  const [tv, setTv] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [, setTick] = useState(0); // re-render ticker for the "Actualizado hace X" stamp
  const wrapRef = useRef<HTMLDivElement>(null);

  // Archived questionnaires are excluded everywhere on this screen.
  const activeTests = useMemo(() => tests.filter((t) => !t.archived), [tests]);

  // ---- Period filtering (affects KPIs, donut, ranking, heatmap, movers, exports) ----
  const periodRange = useMemo((): { from: Date; to: Date | null } | null => {
    const now = new Date();
    if (period === "30d") return { from: new Date(now.getTime() - 30 * 864e5), to: null };
    if (period === "qtr") {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to: null };
    }
    if (period === "prevQtr") {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), (q - 1) * 3, 1), to: new Date(now.getFullYear(), q * 3, 1) };
    }
    if (period === "year") return { from: new Date(now.getFullYear(), 0, 1), to: null };
    return null;
  }, [period]);

  const periodResponses = useMemo(() => {
    if (!periodRange) return responses;
    return responses.filter((r) => {
      if (!r.submittedAt) return false;
      const d = new Date(r.submittedAt);
      if (isNaN(d.getTime())) return false;
      if (d < periodRange.from) return false;
      if (periodRange.to && d >= periodRange.to) return false;
      return true;
    });
  }, [responses, periodRange]);

  const entities = useMemo((): EntityRow[] => {
    const map: Record<string, { name: string; testScoreMap: Record<string, number[]>; totalResponses: number; scored: { submittedAt?: string | null; score: number }[] }> = {};
    periodResponses.forEach((r) => {
      const test = activeTests.find((t) => t.id === r.testId);
      if (!test) return; // skip archived / unknown questionnaires
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, testScoreMap: {}, totalResponses: 0, scored: [] };
      map[key].totalResponses++;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      if (!map[key].testScoreMap[r.testId]) map[key].testScoreMap[r.testId] = [];
      map[key].testScoreMap[r.testId].push(result.overall);
      map[key].scored.push({ submittedAt: r.submittedAt, score: result.overall });
    });

    return Object.values(map).map((e) => {
      const testScores = Object.entries(e.testScoreMap).map(([testId, scores]) => {
        const test = activeTests.find((t) => t.id === testId);
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { testId, testName: test?.name || testId, avg, bucket: scoreBucket(avg) };
      });
      const allScores = testScores.map((t) => t.avg);
      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
      const trendValues = monthlyAverages(e.scored).map((p) => p.value);
      // Recent half vs. older half within the selected period
      const dated = e.scored
        .filter((s) => s.submittedAt)
        .sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
      let delta: number | null = null;
      if (dated.length >= 2) {
        const mid = Math.floor(dated.length / 2);
        const older = dated.slice(0, mid);
        const recent = dated.slice(mid);
        const avgOf = (arr: { score: number }[]) => Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length);
        delta = avgOf(recent) - avgOf(older);
      }
      return { name: e.name, avg, bucket: scoreBucket(avg), totalResponses: e.totalResponses, delta, trendValues, testScores };
    }).sort((a, b) => a.avg - b.avg);
  }, [activeTests, periodResponses]);

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
    periodResponses.forEach((r) => {
      if (!seen.has(r.testId)) {
        const test = activeTests.find((t) => t.id === r.testId);
        if (test) { seen.add(r.testId); result.push({ id: r.testId, name: test.name }); }
      }
    });
    return result;
  }, [activeTests, periodResponses]);

  // ---- Movers: biggest improvement / biggest drop within the period ----
  const movers = useMemo(() => {
    let best: EntityRow | null = null;
    let worst: EntityRow | null = null;
    entities.forEach((e) => {
      if (e.delta == null) return;
      if (e.delta > 0 && (!best || e.delta > (best.delta as number))) best = e;
      if (e.delta < 0 && (!worst || e.delta < (worst.delta as number))) worst = e;
    });
    return { best: best as EntityRow | null, worst: worst as EntityRow | null };
  }, [entities]);

  // ---- Heatmap sorting ----
  const heatRows = useMemo(() => {
    if (!sortKey) return filteredEntities;
    const rows = [...filteredEntities];
    if (sortKey === "name") {
      rows.sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortKey === "__global") {
      rows.sort((a, b) => (sortDir === "asc" ? a.avg - b.avg : b.avg - a.avg));
    } else {
      rows.sort((a, b) => {
        const av = a.testScores.find((s) => s.testId === sortKey)?.avg ?? -1;
        const bv = b.testScores.find((s) => s.testId === sortKey)?.avg ?? -1;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return rows;
  }, [filteredEntities, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }
  const sortArrow = (key: string) => sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  // ---- Drill-down drawer data ----
  const drillData = useMemo(() => {
    if (!drill) return null;
    const test = activeTests.find((t) => t.id === drill.testId);
    if (!test) return null;
    const rows = periodResponses
      .filter((r) => (r.company || "Sin asignar") === drill.company && r.testId === drill.testId)
      .map((r) => ({ ...r, score: computeResult(test.topics || [], test.solutions || [], r.answers || {}).overall }))
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    return { test, rows };
  }, [drill, activeTests, periodResponses]);

  // ---- TV mode ----
  function enterTv() {
    setTv(true);
    setLastRefresh(Date.now());
    const el = wrapRef.current;
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function exitTv() {
    setTv(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setTv(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!tv) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitTv(); };
    window.addEventListener("keydown", onKey);
    const refresh = setInterval(() => {
      refreshResponses();
      refreshTests();
      setLastRefresh(Date.now());
    }, 60000);
    const ticker = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearInterval(refresh);
      clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv, refreshResponses, refreshTests]);

  // Font-size helper: scales typography up in TV mode.
  const fz = (n: number) => (tv ? Math.round(n * 1.35) : n);

  function clearFilters() {
    setSearch("");
    setCuestionarioFilter("all");
    setStatusFilter("todos");
    setPeriod("all");
    setSortKey(null);
  }

  // ---- Exports ----
  function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

    const label = modeConfig.label.toLowerCase();

    // Sheet 1 — Ranking
    const rankRows: (string | number)[][] = [
      ["Entidad", "Puntaje", "Nivel", "Estado", "Respuestas"],
      ...filteredEntities.map((e) => [e.name, e.avg, tierLabel(e.avg), SCORE_LABEL[e.bucket], e.totalResponses]),
    ];
    downloadBlob("﻿" + toCSV(rankRows), `tablero_${label}_ranking.csv`, "text/csv;charset=utf-8;");

    // Sheet 2 — Mapa de calor
    const heatExportRows: (string | number)[][] = [
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
    downloadBlob("﻿" + toCSV(heatExportRows), `tablero_${label}_mapa_calor.csv`, "text/csv;charset=utf-8;");

    toast("Archivos CSV exportados", "download");
  }

  function exportExcel() {
    const esc = (v: string | number) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const th = (s: string | number) => `<th style="background:#f0efe9;border:1px solid #ccc;padding:6px 10px;text-align:left">${esc(s)}</th>`;
    const td = (s: string | number) => `<td style="border:1px solid #ddd;padding:5px 10px">${esc(s)}</td>`;

    const rankTable = `
      <h2>Ranking — ${esc(PERIOD_OPTIONS.find((p) => p.id === period)?.label || "Todo")}</h2>
      <table>
        <tr>${["Entidad", "Puntaje", "Nivel", "Estado", "Respuestas"].map(th).join("")}</tr>
        ${filteredEntities.map((e) =>
          `<tr>${[e.name, e.avg, tierLabel(e.avg), SCORE_LABEL[e.bucket], e.totalResponses].map(td).join("")}</tr>`
        ).join("")}
      </table>`;

    const heatTable = `
      <h2>Mapa de calor</h2>
      <table>
        <tr>${["Entidad", ...allTests.map((t) => t.name), "Promedio Global"].map(th).join("")}</tr>
        ${filteredEntities.map((e) =>
          `<tr>${[
            e.name,
            ...allTests.map((t) => {
              const ts = e.testScores.find((s) => s.testId === t.id);
              return ts ? ts.avg : "";
            }),
            e.avg,
          ].map(td).join("")}</tr>`
        ).join("")}
      </table>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /><title>Tablero</title></head><body>${rankTable}<br/>${heatTable}</body></html>`;
    downloadBlob("﻿" + html, `tablero_${modeConfig.label.toLowerCase()}.xls`, "application/vnd.ms-excel");
    toast("Archivo Excel exportado", "download");
  }

  // ---- Loading skeletons ----
  if (loading) {
    return (
      <PageWrap>
        <div style={{ marginBottom: 24 }}>
          <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
          <Skeleton width={280} height={26} style={{ marginBottom: 10 }} />
          <Skeleton width={360} height={13} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} lines={1} height={92} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <SkeletonCard lines={3} height={140} />
          <SkeletonCard lines={6} height={300} />
        </div>
      </PageWrap>
    );
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.id === period)?.label || "Todo";

  return (
    <PageWrap>
      {/* Page-specific print tweaks */}
      <style>{`@media print {
        .tablero-heatwrap { overflow: visible !important; max-height: none !important; }
        .tablero-heatwrap th, .tablero-heatwrap td { position: static !important; }
        .tablero-root section { break-inside: avoid; }
      }`}</style>

      <div
        ref={wrapRef}
        className="tablero-root"
        style={tv ? { background: "var(--surface-sunken)", overflow: "auto", padding: "28px 36px", minHeight: "100%" } : undefined}
      >
        {/* TV-mode status bar */}
        {tv && (
          <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Actualizado {timeAgo(new Date(lastRefresh)) || "hace un momento"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={exitTv}>
              <Icon name="x" size={14} /> Salir (Esc)
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
          <h1 style={{ fontSize: fz(28), fontWeight: 800 }}>Tablero comparativo</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: fz(14) }}>
            Compara el desempeño de {modeConfig.groupNounPlural.toLowerCase()} en todos los cuestionarios.
            {period !== "all" && <span style={{ fontWeight: 600 }}> Periodo: {periodLabel}.</span>}
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
            <div key={k.label} className="card" style={{ padding: tv ? "22px 24px" : "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: k.color }}>
                  <Icon name={k.icon} size={15} />
                </div>
                <span className="eyebrow" style={{ fontSize: fz(10) }}>{k.label}</span>
              </div>
              <div className="mono" style={{ fontSize: fz(26) * (tv ? 1.3 : 1), fontWeight: 700, color: "var(--ink)", letterSpacing: "-.03em", lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar (hidden in TV mode and on print) */}
        {!tv && (
          <div className="card no-print" style={{ padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

            {/* Period selector — affects the whole tablero */}
            <select
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodId)}
              style={{ flex: "0 1 170px", fontSize: 13 }}
              aria-label="Periodo"
              title="Periodo"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
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

            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <Icon name="x" size={14} /> Limpiar
              </button>
              <button className="btn btn-ghost btn-sm" onClick={enterTv} title="Pantalla completa con actualización automática">
                <Icon name="play" size={14} /> Modo TV
              </button>
              <MenuButton
                icon="download"
                label="Exportar"
                items={[
                  { label: "CSV", icon: "download", onClick: exportCSV },
                  { label: "Excel", icon: "grid", onClick: exportExcel },
                  "divider",
                  { label: "Imprimir / PDF", icon: "printer", onClick: () => window.print() },
                ]}
              />
            </div>
          </div>
        )}

        {entities.length === 0 ? (
          <EmptyState
            icon={modeConfig.icon}
            title={period === "all" ? modeConfig.emptyTitle : "Sin datos en este periodo"}
            sub={period === "all" ? modeConfig.emptyClients : "Prueba con otro periodo o restablece los filtros."}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Distribution donut (CSS-based) */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <h3 style={{ fontSize: fz(14), fontWeight: 700, marginBottom: 14 }}>Distribución de resultados</h3>
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
                      <span style={{ fontSize: fz(13), fontWeight: 600, color: "var(--ink-2)", minWidth: 70 }}>{SCORE_LABEL[b]}</span>
                      <span className="mono" style={{ fontSize: fz(13), fontWeight: 700, color: "var(--ink)" }}>{distrib[b].count}</span>
                      <span style={{ fontSize: fz(12), color: "var(--ink-3)" }}>({distrib[b].pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Movers — biggest improvement / drop within the period */}
            {(movers.best || movers.worst) && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {movers.best && (
                  <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flex: "1 1 240px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--good-soft, #1f8a5b18)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--good)", flex: "none" }}>
                      <Icon name="star" size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>Mayor mejora</div>
                      <div className="clamp-1" style={{ fontSize: fz(13.5), fontWeight: 700, color: "var(--ink)" }}>
                        {movers.best.name}{" "}
                        <span className="mono" style={{ color: "var(--good)", fontWeight: 700 }}>(+{movers.best.delta})</span>
                      </div>
                    </div>
                  </div>
                )}
                {movers.worst && (
                  <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flex: "1 1 240px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bad-soft, #c0492f18)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bad)", flex: "none" }}>
                      <Icon name="alert" size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>Mayor caída</div>
                      <div className="clamp-1" style={{ fontSize: fz(13.5), fontWeight: 700, color: "var(--ink)" }}>
                        {movers.worst.name}{" "}
                        <span className="mono" style={{ color: "var(--bad)", fontWeight: 700 }}>(−{Math.abs(movers.worst.delta as number)})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ranking list */}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <h2 style={{ fontSize: fz(17), fontWeight: 700 }}>Ranking de {modeConfig.groupNounPlural.toLowerCase()}</h2>
                {/* One-time legend for the benchmark tick */}
                <span style={{ fontSize: fz(11.5), color: "var(--ink-3)" }}>
                  <span style={{ color: "var(--ink-2)", fontWeight: 700 }}>▏</span>promedio general: <span className="mono" style={{ fontWeight: 700 }}>{kpis.avg}</span>
                </span>
              </div>
              {filteredEntities.length === 0 ? (
                <EmptyState icon="search" title="Sin resultados" sub="Cambia los filtros para ver entidades." />
              ) : (
                <div className="card" style={{ overflow: "hidden" }}>
                  {filteredEntities.map((e, i) => (
                    <div
                      key={e.name}
                      style={{ padding: tv ? "16px 22px" : "12px 18px", borderBottom: i < filteredEntities.length - 1 ? "1px solid var(--line)" : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "background .12s" }}
                      onClick={() => nav("cliente", { company: e.name })}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                    >
                      <span className="mono" style={{ fontSize: fz(12), color: "var(--ink-3)", width: 22, textAlign: "right", flex: "none" }}>
                        {i + 1}
                      </span>
                      <Avatar name={e.name} size={tv ? 38 : 32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: fz(14), color: "var(--ink)", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="clamp-1">{e.name}</span>
                          {movers.best && e.name === movers.best.name && (
                            <span title={`Mayor mejora del periodo (+${movers.best.delta})`} style={{ color: "var(--good)", display: "inline-flex", flex: "none" }}>
                              <Icon name="star" size={13} />
                            </span>
                          )}
                          {movers.worst && e.name === movers.worst.name && (
                            <span title={`Mayor caída del periodo (${movers.worst.delta})`} style={{ color: "var(--bad)", display: "inline-flex", flex: "none" }}>
                              <Icon name="alert" size={13} />
                            </span>
                          )}
                        </div>
                        {/* ScoreBar + benchmark tick at the portfolio average */}
                        <div style={{ position: "relative" }}>
                          <ScoreBar value={e.avg} height={6} />
                          <div
                            title={`Promedio general: ${kpis.avg}`}
                            style={{ position: "absolute", left: `calc(${Math.max(0, Math.min(100, kpis.avg))}% - 1px)`, top: -3, bottom: -3, width: 2, borderRadius: 2, background: "var(--ink-2)", opacity: 0.75, pointerEvents: "none" }}
                          />
                        </div>
                      </div>
                      {/* Trend: monthly sparkline + recent-vs-older delta */}
                      <div className="hide-mobile" style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }} title="Tendencia mensual del periodo">
                        <Sparkline values={e.trendValues} width={tv ? 96 : 72} height={tv ? 30 : 24} color={SCORE_HEX[e.bucket]} />
                        {e.delta != null && e.delta !== 0 && <DeltaBadge delta={e.delta} />}
                      </div>
                      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {e.testScores.map((ts) => (
                          <span key={ts.testId} className={"badge badge-" + ts.bucket} style={{ fontSize: fz(10), padding: "2px 7px" }} title={ts.testName}>
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
                <h2 style={{ fontSize: fz(17), fontWeight: 700, marginBottom: 14 }}>Mapa de calor</h2>
                <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                  <div className="tablero-heatwrap" style={{ overflow: "auto", maxHeight: 520, position: "relative" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: fz(12) }}>
                      <thead>
                        <tr>
                          <th
                            onClick={() => toggleSort("name")}
                            title="Ordenar por nombre"
                            style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: "var(--surface-2)", textAlign: "left", padding: "10px 16px", fontWeight: 700, fontSize: fz(11), color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", minWidth: 140, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                          >
                            {modeConfig.groupNounCap}{sortArrow("name")}
                          </th>
                          {allTests.map((t) => (
                            <th
                              key={t.id}
                              onClick={() => toggleSort(t.id)}
                              title={`Ordenar por ${t.name}`}
                              style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface-2)", textAlign: "center", padding: "10px 14px", fontWeight: 700, fontSize: fz(11), color: sortKey === t.id ? "var(--ink)" : "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap", maxWidth: 120, cursor: "pointer", userSelect: "none" }}
                            >
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{t.name}{sortArrow(t.id)}</div>
                            </th>
                          ))}
                          <th
                            onClick={() => toggleSort("__global")}
                            title="Ordenar por promedio global"
                            style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface-2)", textAlign: "center", padding: "10px 14px", fontWeight: 700, fontSize: fz(11), color: sortKey === "__global" ? "var(--ink)" : "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                          >
                            Global{sortArrow("__global")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatRows.map((e, i) => (
                          <tr key={e.name}>
                            <td
                              onClick={() => nav("cliente", { company: e.name })}
                              title={`Ver ficha de ${e.name}`}
                              onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                              onMouseLeave={(ev) => (ev.currentTarget.style.background = "var(--surface)")}
                              style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--surface)", padding: "10px 16px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", borderBottom: i < heatRows.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                            >
                              {e.name}
                            </td>
                            {allTests.map((t) => {
                              const ts = e.testScores.find((s) => s.testId === t.id);
                              if (!ts) return (
                                <td key={t.id} style={{ textAlign: "center", padding: "10px 14px", color: "var(--ink-4)", borderBottom: i < heatRows.length - 1 ? "1px solid var(--line)" : "none" }}>—</td>
                              );
                              return (
                                <td
                                  key={t.id}
                                  onClick={() => setDrill({ company: e.name, testId: t.id })}
                                  title={`Ver respuestas de ${e.name} — ${t.name}`}
                                  onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                                  style={{ textAlign: "center", padding: "10px 14px", borderBottom: i < heatRows.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                                >
                                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 28, borderRadius: 6, background: SCORE_HEX[ts.bucket] + "22", color: SCORE_HEX[ts.bucket] }}>
                                    <span className="mono" style={{ fontSize: fz(12), fontWeight: 700 }}>{ts.avg}</span>
                                  </div>
                                </td>
                              );
                            })}
                            <td
                              onClick={() => nav("cliente", { company: e.name })}
                              title={`Ver ficha de ${e.name}`}
                              onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-sunken)")}
                              onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                              style={{ textAlign: "center", padding: "10px 14px", borderBottom: i < heatRows.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                            >
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 28, borderRadius: 6, background: SCORE_HEX[e.bucket] + "33", color: SCORE_HEX[e.bucket] }}>
                                <span className="mono" style={{ fontSize: fz(13), fontWeight: 800 }}>{e.avg}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Heatmap drill-down drawer */}
      <Drawer
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.company || ""}
        sub={drillData ? drillData.test.name : undefined}
      >
        {drillData && drill && (
          <div style={{ padding: "14px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span className="eyebrow" style={{ fontSize: 10 }}>
                {drillData.rows.length} {drillData.rows.length === 1 ? "respuesta" : "respuestas"}{period !== "all" ? ` · ${periodLabel}` : ""}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { const id = drill.testId; setDrill(null); nav("responses", { testId: id }); }}
              >
                <Icon name="external" size={13} /> Ver todas
              </button>
            </div>
            {drillData.rows.length === 0 ? (
              <EmptyState icon="search" title="Sin respuestas" sub="No hay respuestas en el periodo seleccionado." />
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {drillData.rows.map((r, i) => (
                  <div
                    key={r.id}
                    style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < drillData.rows.length - 1 ? "1px solid var(--line)" : "none" }}
                  >
                    <Avatar name={r.respondent || "Anónimo"} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="clamp-1" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{r.respondent || "Anónimo"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon name="calendar" size={11} />
                        {r.submittedAt
                          ? `${new Date(r.submittedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} · ${timeAgo(r.submittedAt)}`
                          : "Sin fecha"}
                      </div>
                    </div>
                    <ScoreBadge value={r.score} />
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => { const c = drill.company; setDrill(null); nav("cliente", { company: c }); }}
            >
              <Icon name="eye" size={13} /> Ver ficha de {drill.company}
            </button>
          </div>
        )}
      </Drawer>
    </PageWrap>
  );
}
