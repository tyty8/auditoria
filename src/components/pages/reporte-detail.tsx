"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreRing, ScoreBar, ScoreBadge, EmptyState, PageWrap, Modal, DeltaBadge, Skeleton, SkeletonCard, timeAgo } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel, SCORE_LABEL } from "@/lib/scoring";
import { NotesPanel } from "@/components/notes-panel";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Customizable sections (persisted per company) ----
type SectionKey = "portada" | "resumen" | "comparacion" | "soluciones" | "notas";
const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  portada: true,
  resumen: true,
  comparacion: true,
  soluciones: true,
  notas: true,
};
const SECTION_LABELS: { key: SectionKey; label: string; sub: string }[] = [
  { key: "portada", label: "Portada", sub: "Página de portada (solo impresión)" },
  { key: "resumen", label: "Resumen ejecutivo", sub: "Síntesis automática del desempeño" },
  { key: "comparacion", label: "Comparación de período", sub: "Trimestre actual vs anterior" },
  { key: "soluciones", label: "Soluciones recomendadas", sub: "Acciones sugeridas por los resultados" },
  { key: "notas", label: "Notas del consultor", sub: "Observaciones internas" },
];
const LS_PREFIX = "auditoria_report_secciones_";

function quarterLabel(d: Date): string {
  return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

export default function ReporteDetailPage({ company, nav, toast }: { company: string; nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig, mode, me, loading } = useStore();

  // Section visibility — loaded from localStorage after mount (avoids hydration mismatch).
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(DEFAULT_SECTIONS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PREFIX + company);
      if (raw) setSections({ ...DEFAULT_SECTIONS, ...JSON.parse(raw) });
      else setSections(DEFAULT_SECTIONS);
    } catch {
      setSections(DEFAULT_SECTIONS);
    }
  }, [company]);

  function toggleSection(key: SectionKey) {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LS_PREFIX + company, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [customizeOpen, setCustomizeOpen] = useState(false);

  // ---- Email send ----
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendAt, setLastSendAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/${encodeURIComponent(company)}/send?mode=${mode}&company=${encodeURIComponent(company)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const s = (data.sends || [])[0];
        if (s?.sentAt) setLastSendAt(s.sentAt);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [company, mode]);

  const entityResponses = useMemo(
    () => responses.filter((r) => (r.company || "Sin asignar") === company),
    [responses, company]
  );

  const prefillEmail = useMemo(() => {
    const sorted = [...entityResponses].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    return sorted.find((r) => r.email)?.email || "";
  }, [entityResponses]);

  function openEmailModal() {
    setEmailValue(prefillEmail);
    setEmailOpen(true);
  }

  async function sendReport() {
    const email = emailValue.trim();
    if (!EMAIL_RE.test(email)) {
      toast("Email inválido. Verifica la dirección.", "alert");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(company)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo enviar el email");
      setLastSendAt(data?.sentAt || new Date().toISOString());
      setEmailOpen(false);
      toast(`Reporte enviado a ${email}`, "send");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al enviar el email", "alert");
    } finally {
      setSending(false);
    }
  }

  // ---- Aggregations ----
  const overallData = useMemo(() => {
    let sum = 0;
    let count = 0;
    let lastDate = "";
    let firstDate = "";
    entityResponses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      sum += result.overall;
      count++;
      if (r.submittedAt) {
        if (!lastDate || r.submittedAt > lastDate) lastDate = r.submittedAt;
        if (!firstDate || r.submittedAt < firstDate) firstDate = r.submittedAt;
      }
    });
    return { avg: count > 0 ? Math.round(sum / count) : 0, count, lastDate, firstDate };
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

  // Worst topic (lowest average) across this company's tests — for the executive summary.
  const worstTopic = useMemo<{ name: string; avg: number; testName: string } | null>(() => {
    let worst: { name: string; avg: number; testName: string } | null = null;
    testBreakdowns.forEach((td) => {
      td.topicAvgs.forEach((ta) => {
        if (!worst || ta.avg < worst.avg) worst = { name: ta.name, avg: ta.avg, testName: td.testName };
      });
    });
    return worst;
  }, [testBreakdowns]);

  // Most frequently triggered solution — top recommendation.
  const topSolution = useMemo(() => {
    if (recommendedSolutions.length === 0) return null;
    return [...recommendedSolutions].sort((a, b) => b.count - a.count)[0];
  }, [recommendedSolutions]);

  // ---- Period comparison: current quarter vs previous quarter ----
  const comparison = useMemo(() => {
    const now = new Date();
    const curStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const prevStart = new Date(curStart.getFullYear(), curStart.getMonth() - 3, 1);
    let curSum = 0, curCount = 0, prevSum = 0, prevCount = 0;
    const byTest: Record<string, { name: string; cs: number; cc: number; ps: number; pc: number }> = {};
    entityResponses.forEach((r) => {
      if (!r.submittedAt) return;
      const d = new Date(r.submittedAt);
      if (isNaN(d.getTime())) return;
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const overall = computeResult(test.topics || [], test.solutions || [], r.answers || {}).overall;
      const bt = (byTest[r.testId] ||= { name: test.name, cs: 0, cc: 0, ps: 0, pc: 0 });
      if (d >= curStart) {
        curSum += overall; curCount++; bt.cs += overall; bt.cc++;
      } else if (d >= prevStart) {
        prevSum += overall; prevCount++; bt.ps += overall; bt.pc++;
      }
    });
    if (curCount === 0 || prevCount === 0) return null;
    const cur = Math.round(curSum / curCount);
    const prev = Math.round(prevSum / prevCount);
    const rows = Object.values(byTest)
      .filter((b) => b.cc > 0 && b.pc > 0)
      .map((b) => {
        const c = Math.round(b.cs / b.cc);
        const p = Math.round(b.ps / b.pc);
        return { name: b.name, prev: p, cur: c, delta: c - p };
      });
    return {
      cur, prev, delta: cur - prev,
      curLabel: quarterLabel(curStart), prevLabel: quarterLabel(prevStart),
      curCount, prevCount, rows,
    };
  }, [entityResponses, tests]);

  // ---- TOC + active-section highlight ----
  const tocItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    if (sections.resumen) items.push({ id: "sec-resumen", label: "Resumen ejecutivo" });
    if (testBreakdowns.length > 0) items.push({ id: "sec-resultados", label: "Resultados por cuestionario" });
    if (sections.comparacion && comparison) items.push({ id: "sec-comparacion", label: "Comparación de período" });
    if (sections.soluciones && recommendedSolutions.length > 0) items.push({ id: "sec-soluciones", label: "Soluciones recomendadas" });
    if (sections.notas) items.push({ id: "sec-notas", label: "Notas del consultor" });
    return items;
  }, [sections, testBreakdowns.length, comparison, recommendedSolutions.length]);

  const [activeSection, setActiveSection] = useState("");
  const tocKey = tocItems.map((t) => t.id).join(",");
  useEffect(() => {
    if (loading || entityResponses.length === 0) return;
    const ids = tocKey ? tocKey.split(",") : [];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [tocKey, loading, entityResponses.length]);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#reporte/${encodeURIComponent(company)}`;
    navigator.clipboard.writeText(url).then(() => toast("Enlace copiado", "link")).catch(() => toast("Error al copiar", "alert"));
  }

  const bucket = scoreBucket(overallData.avg);
  const color = SCORE_HEX[bucket];
  const dateStr = overallData.lastDate
    ? new Date(overallData.lastDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  const todayStr = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  const rangeStr = useMemo(() => {
    if (!overallData.firstDate) return "";
    const fmt = (s: string) => new Date(s).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    if (!overallData.lastDate || overallData.firstDate === overallData.lastDate) return fmt(overallData.firstDate);
    return `${fmt(overallData.firstDate)} – ${fmt(overallData.lastDate)}`;
  }, [overallData.firstDate, overallData.lastDate]);

  // ---- Loading skeletons ----
  if (loading) {
    return (
      <PageWrap maxWidth="860px">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Skeleton width={150} height={32} radius="var(--r-sm)" />
          <div style={{ flex: 1 }} />
          <Skeleton width={110} height={32} radius="var(--r-sm)" />
          <Skeleton width={130} height={32} radius="var(--r-sm)" />
        </div>
        <div className="card" style={{ padding: "36px 40px", display: "flex", gap: 32, alignItems: "center", marginBottom: 28 }}>
          <Skeleton width={130} height={130} radius="50%" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="55%" height={26} />
            <Skeleton width="40%" height={14} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </PageWrap>
    );
  }

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

      <PageWrap maxWidth="1150px">
        {/* Back + actions — hidden on print */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap", maxWidth: 860 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav("reportes")}>
            <Icon name="back" size={16} /> Volver a reportes
          </button>
          {lastSendAt && (
            <span className="badge hide-mobile" title={`Último envío por email ${timeAgo(lastSendAt)}`} style={{ gap: 5 }}>
              <Icon name="mail" size={11} /> Último envío {timeAgo(lastSendAt)}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomizeOpen(true)}>
            <Icon name="eye" size={14} /> Personalizar
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
            <Icon name="link" size={14} /> Copiar enlace
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={openEmailModal}>
            <Icon name="mail" size={14} /> Enviar por email
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
          <div style={{ display: "flex", gap: 36, alignItems: "flex-start" }}>
            {/* Report content — capped at ~860px */}
            <div style={{ flex: "1 1 860px", maxWidth: 860, minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>
              {/* Print cover page */}
              {sections.portada && (
                <div
                  className="print-only"
                  style={{
                    pageBreakAfter: "always",
                    textAlign: "center",
                    padding: "120px 40px 60px",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "#1f8a5b", marginBottom: 48 }}>
                    Auditoría
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#9aa39d", marginBottom: 14 }}>
                    Reporte de evaluación · {modeConfig.singular}
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "#1c2420", marginBottom: 28, lineHeight: 1.15 }}>
                    {company}
                  </div>
                  <div style={{ fontSize: 56, fontWeight: 800, color, lineHeight: 1, marginBottom: 8 }} className="mono">
                    {overallData.avg}<span style={{ fontSize: 22, color: "#9aa39d" }}>/100</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#3d4742", marginBottom: 56 }}>
                    Nivel {tierLabel(overallData.avg)} · {SCORE_LABEL[bucket]}
                  </div>
                  <div style={{ fontSize: 14, color: "#3d4742", marginBottom: 6 }}>{todayStr}</div>
                  <div style={{ fontSize: 14, color: "#9aa39d" }}>
                    Preparado por {me?.name || "Consultor"}
                  </div>
                </div>
              )}

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

              {/* Executive summary */}
              {sections.resumen && (
                <section id="sec-resumen" style={{ scrollMarginTop: 20 }}>
                  <div className="card" style={{ padding: "24px 28px", borderLeft: `4px solid ${color}` }}>
                    <div className="eyebrow" style={{ marginBottom: 12 }}>Resumen ejecutivo</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "var(--ink)" }}>{company}</strong> obtiene un puntaje promedio de{" "}
                        <strong className="mono" style={{ color }}>{overallData.avg}/100</strong>, lo que corresponde al nivel{" "}
                        <strong style={{ color: "var(--ink)" }}>{tierLabel(overallData.avg)}</strong> ({SCORE_LABEL[bucket].toLowerCase()}).
                      </p>
                      <p style={{ margin: 0 }}>
                        El análisis se basa en <strong style={{ color: "var(--ink)" }}>{overallData.count} evaluaci{overallData.count === 1 ? "ón" : "ones"}</strong>
                        {rangeStr ? <> realizadas entre el <strong style={{ color: "var(--ink)" }}>{rangeStr}</strong></> : null}.
                      </p>
                      {worstTopic && (
                        <p style={{ margin: 0 }}>
                          El mayor riesgo detectado es <strong style={{ color: "var(--ink)" }}>{worstTopic.name}</strong>{" "}
                          ({worstTopic.testName}), con un promedio de{" "}
                          <strong className="mono" style={{ color: SCORE_HEX[scoreBucket(worstTopic.avg)] }}>{worstTopic.avg}/100</strong>.
                        </p>
                      )}
                      {topSolution ? (
                        <p style={{ margin: 0 }}>
                          La recomendación prioritaria es <strong style={{ color: "var(--ink)" }}>{topSolution.name}</strong>
                          {topSolution.count > 1 ? <>, activada en {topSolution.count} evaluaciones</> : null}.
                        </p>
                      ) : (
                        <p style={{ margin: 0 }}>No se activaron soluciones recomendadas en este período.</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Per-test breakdowns */}
              {testBreakdowns.length > 0 && (
                <section id="sec-resultados" style={{ scrollMarginTop: 20 }}>
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

              {/* Period comparison — only when both quarters have data */}
              {sections.comparacion && comparison && (
                <section id="sec-comparacion" style={{ scrollMarginTop: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: "-.01em" }}>
                    Comparación de período
                  </h2>
                  <div className="card" style={{ overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ flex: 1, padding: "22px 24px", textAlign: "center", borderRight: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
                          {comparison.prevLabel} · {comparison.prevCount} evaluaci{comparison.prevCount === 1 ? "ón" : "ones"}
                        </div>
                        <div className="mono" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: SCORE_HEX[scoreBucket(comparison.prev)] }}>
                          {comparison.prev}
                        </div>
                      </div>
                      <div style={{ flex: 1, padding: "22px 24px", textAlign: "center", borderRight: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
                          {comparison.curLabel} · {comparison.curCount} evaluaci{comparison.curCount === 1 ? "ón" : "ones"}
                        </div>
                        <div className="mono" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: SCORE_HEX[scoreBucket(comparison.cur)] }}>
                          {comparison.cur}
                        </div>
                      </div>
                      <div style={{ flex: "none", padding: "22px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 110 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                          Cambio
                        </div>
                        <DeltaBadge delta={comparison.delta} suffix=" pts" />
                      </div>
                    </div>
                    {comparison.rows.length > 0 && (
                      <div style={{ padding: "6px 0" }}>
                        {comparison.rows.map((row) => (
                          <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 24px", borderTop: "1px solid var(--line)" }}>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }} className="clamp-1">
                              {row.name}
                            </div>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: SCORE_HEX[scoreBucket(row.prev)] }}>{row.prev}</span>
                            <span style={{ fontSize: 12, color: "var(--ink-4)" }}>→</span>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: SCORE_HEX[scoreBucket(row.cur)] }}>{row.cur}</span>
                            <div style={{ width: 64, display: "flex", justifyContent: "flex-end" }}>
                              <DeltaBadge delta={row.delta} size="sm" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Recommended solutions */}
              {sections.soluciones && recommendedSolutions.length > 0 && (
                <section id="sec-soluciones" style={{ scrollMarginTop: 20 }}>
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
              {sections.notas && (
                <section id="sec-notas" style={{ scrollMarginTop: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, letterSpacing: "-.01em" }}>
                    Notas del consultor
                  </h2>
                  <NotesPanel company={company} mode={mode} />
                </section>
              )}

              {/* Footer */}
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-3)", padding: "16px 0 8px", borderTop: "1px solid var(--line)" }}>
                Reporte generado por Auditoría · {company} · {dateStr}
              </div>
            </div>

            {/* Table of contents — wide screens only, never printed */}
            {tocItems.length > 0 && (
              <aside
                className="no-print hide-mobile"
                style={{ width: 210, flex: "none", position: "sticky", top: 24 }}
                aria-label="Índice del reporte"
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10, paddingLeft: 12 }}>
                  Contenido
                </div>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {tocItems.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        style={{
                          textAlign: "left",
                          border: "none",
                          background: active ? "var(--primary-soft)" : "transparent",
                          color: active ? "var(--primary)" : "var(--ink-2)",
                          fontWeight: active ? 700 : 500,
                          fontSize: 13,
                          padding: "7px 12px",
                          borderRadius: "var(--r-sm)",
                          cursor: "pointer",
                          borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                          transition: "background .14s, color .14s",
                          lineHeight: 1.35,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </aside>
            )}
          </div>
        )}
      </PageWrap>

      {/* Customize sections modal */}
      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Personalizar reporte"
        sub="Elige qué secciones incluir en pantalla y al imprimir."
        width={440}
      >
        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 4 }}>
          {SECTION_LABELS.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{s.sub}</div>
              </div>
              <button
                type="button"
                className={"switch" + (sections[s.key] ? " on" : "")}
                role="switch"
                aria-checked={sections[s.key]}
                aria-label={`Mostrar ${s.label}`}
                onClick={() => toggleSection(s.key)}
                style={{ cursor: "pointer" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCustomizeOpen(false)}>
              <Icon name="check2" size={14} /> Listo
            </button>
          </div>
        </div>
      </Modal>

      {/* Send by email modal */}
      <Modal
        open={emailOpen}
        onClose={() => !sending && setEmailOpen(false)}
        title="Enviar reporte por email"
        sub={`Se enviará un resumen del reporte de ${company} con enlace al reporte completo.`}
        width={460}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); sendReport(); }}
          style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label htmlFor="report-send-email" style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>
              Email del destinatario
            </label>
            <input
              id="report-send-email"
              className="input"
              type="email"
              required
              placeholder="nombre@empresa.com"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              autoFocus
              disabled={sending}
            />
          </div>
          {lastSendAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-3)" }}>
              <Icon name="clock" size={13} /> Último envío {timeAgo(lastSendAt)}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEmailOpen(false)} disabled={sending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !emailValue.trim()}>
              <Icon name="send" size={14} /> {sending ? "Enviando…" : "Enviar reporte"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
