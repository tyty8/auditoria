"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useStore } from "@/components/store";
import {
  Icon, ScoreRing, ScoreBar, ScoreBadge, Avatar, EmptyState, PageWrap,
  Breadcrumbs, Modal, useToast, Skeleton, SkeletonCard, timeAgo,
} from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel, SCORE_LABEL } from "@/lib/scoring";
import { TrendChart, DeltaBadge, monthlyAverages } from "@/components/trend-chart";
import type { TrendPoint } from "@/components/trend-chart";
import { NotesPanel } from "@/components/notes-panel";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;

type TabId = "resumen" | "evolucion" | "soluciones" | "notas" | "historial";

// ---- Inline SVG radar/spider chart (no library) ----
function RadarChart({ axes }: { axes: { name: string; value: number }[] }) {
  const W = 560, H = 320;
  const cx = W / 2, cy = H / 2, R = 105;
  const n = axes.length;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const px = (i: number, r: number) => cx + Math.cos(ang(i)) * r;
  const py = (i: number, r: number) => cy + Math.sin(ang(i)) * r;
  const ring = (f: number) => axes.map((_, i) => `${px(i, R * f).toFixed(1)},${py(i, R * f).toFixed(1)}`).join(" ");
  const rOf = (v: number) => (R * Math.max(0, Math.min(100, v))) / 100;
  const poly = axes.map((a, i) => `${px(i, rOf(a.value)).toFixed(1)},${py(i, rOf(a.value)).toFixed(1)}`).join(" ");
  const trunc = (s: string) => (s.length > 16 ? s.slice(0, 15) + "…" : s);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Radar de temas">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--line)" strokeWidth={1} strokeDasharray={f === 1 ? "" : "3 4"} />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={px(i, R)} y2={py(i, R)} stroke="var(--line)" strokeWidth={1} />
      ))}
      <polygon points={poly} fill="var(--primary)" fillOpacity={0.16} stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => (
        <circle key={i} cx={px(i, rOf(a.value))} cy={py(i, rOf(a.value))} r={3.5}
          fill={SCORE_HEX[scoreBucket(a.value)]} stroke="var(--surface)" strokeWidth={1.5}>
          <title>{`${a.name}: ${a.value}`}</title>
        </circle>
      ))}
      {axes.map((a, i) => {
        const c = Math.cos(ang(i)), s = Math.sin(ang(i));
        const lx = cx + c * (R + 14), ly = cy + s * (R + 14);
        const anchor = Math.abs(c) < 0.35 ? "middle" : c > 0 ? "start" : "end";
        const dy = s > 0.35 ? 10 : s < -0.35 ? -2 : 4;
        return (
          <text key={i} x={lx} y={ly + dy} textAnchor={anchor} fontSize={11} fontWeight={600} fill="var(--ink-2)">
            {trunc(a.name)}
            <tspan fontFamily="var(--font-mono)" fontWeight={700} fill="var(--ink-3)"> {a.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

export default function ClienteDetailPage({ company, nav }: { company: string; nav: NavFn }) {
  const { tests, responses, modeConfig, mode, loading, taskActions, addInvitation, sendInvitation } = useStore();
  const [toastNode, toast] = useToast();

  const [tab, setTab] = useState<TabId>("resumen");

  // Sticky mini-header
  const headerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Evolución compare controls
  const [compareAvg, setCompareAvg] = useState(false);
  const [compareEntity, setCompareEntity] = useState("");

  // Historial controls
  const [histTest, setHistTest] = useState("");
  const [histSortAsc, setHistSortAsc] = useState(false);
  const [histTimeline, setHistTimeline] = useState(false);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTestId, setInviteTestId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSendNow, setInviteSendNow] = useState(true);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Note updatedAt for the timeline view
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!company) return;
    fetch(`/api/consultant-notes?company=${encodeURIComponent(company)}&mode=${mode}`)
      .then((r) => r.json())
      .then((d) => { if (d?.updatedAt) setNoteUpdatedAt(d.updatedAt); })
      .catch(() => {});
  }, [company, mode]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 60),
      { rootMargin: "-60px 0px 0px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

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

  // Radar axes: average per-topic grade across all of the entity's tests.
  const radarAxes = useMemo(
    () => testBreakdowns.flatMap((td) => td.topicAvgs.map((ta) => ({ name: ta.name, value: ta.avg }))),
    [testBreakdowns]
  );

  const triggeredSolutions = useMemo(() => {
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

  // Other entities (for the compare select).
  const otherEntities = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => set.add(r.company || "Sin asignar"));
    set.delete(company);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [responses, company]);

  // Portfolio average trend (all entities).
  const portfolioTrend = useMemo<TrendPoint[]>(() => {
    const scored: { submittedAt?: string | null; score: number }[] = [];
    responses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      scored.push({
        submittedAt: r.submittedAt,
        score: computeResult(test.topics || [], test.solutions || [], r.answers || {}).overall,
      });
    });
    return monthlyAverages(scored);
  }, [tests, responses]);

  // Specific-entity comparison trend.
  const compareEntityTrend = useMemo<TrendPoint[]>(() => {
    if (!compareEntity) return [];
    const scored: { submittedAt?: string | null; score: number }[] = [];
    responses.forEach((r) => {
      if ((r.company || "Sin asignar") !== compareEntity) return;
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      scored.push({
        submittedAt: r.submittedAt,
        score: computeResult(test.topics || [], test.solutions || [], r.answers || {}).overall,
      });
    });
    return monthlyAverages(scored);
  }, [tests, responses, compareEntity]);

  const compareSeries = useMemo(() => {
    if (compareEntity && compareEntityTrend.length > 0) return { label: compareEntity, points: compareEntityTrend };
    if (compareAvg && portfolioTrend.length > 0) return { label: "Promedio general", points: portfolioTrend };
    return undefined;
  }, [compareEntity, compareEntityTrend, compareAvg, portfolioTrend]);

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

  // Tests that appear in this entity's history (for the historial filter).
  const historyTests = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((h) => map.set(h.row.testId, h.testName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [history]);

  const filteredHistory = useMemo(() => {
    const rows = histTest ? history.filter((h) => h.row.testId === histTest) : history;
    return histSortAsc ? [...rows].reverse() : rows;
  }, [history, histTest, histSortAsc]);

  // Unified timeline: evaluations + note updates + completed tasks.
  const timeline = useMemo(() => {
    type Item = { key: string; date: string; icon: string; iconColor: string; title: string; sub?: string; score?: number };
    const items: Item[] = [];
    history.forEach((h) => {
      if (histTest && h.row.testId !== histTest) return;
      items.push({
        key: `ev-${h.row.id}`,
        date: h.row.submittedAt || "",
        icon: "doc",
        iconColor: "var(--primary)",
        title: `Evaluación completada · ${h.testName}`,
        sub: h.row.respondent || h.row.email || "Anónimo",
        score: h.overall,
      });
    });
    if (noteUpdatedAt && !histTest) {
      items.push({
        key: "note",
        date: noteUpdatedAt,
        icon: "comment",
        iconColor: "var(--ink-2)",
        title: "Notas del consultor actualizadas",
      });
    }
    taskActions
      .filter((a) => a.entityName === company && a.status === "hecho" && (!histTest || a.testId === histTest))
      .forEach((a) => {
        const t = tests.find((tt) => tt.id === a.testId);
        const sol = t?.solutions?.find((s) => s.id === a.solutionId);
        items.push({
          key: `ta-${a.id}`,
          date: a.updatedAt || "",
          icon: "check2",
          iconColor: "var(--good)",
          title: `Tarea completada · ${sol?.name || "Solución"}`,
          sub: a.assignee || undefined,
        });
      });
    const ts = (d: string) => (d ? new Date(d).getTime() : 0);
    items.sort((a, b) => (histSortAsc ? ts(a.date) - ts(b.date) : ts(b.date) - ts(a.date)));
    return items;
  }, [history, noteUpdatedAt, taskActions, tests, company, histTest, histSortAsc]);

  const bucket = scoreBucket(overallData.avg);
  const color = SCORE_HEX[bucket];

  // Published tests for invite / copy-link actions.
  const publishedTests = useMemo(
    () => tests.filter((t) => t.status === "publicado" && !t.archived),
    [tests]
  );

  // Latest published test among the entity's responses (fallback: first published).
  const defaultPublishedTest = useMemo(() => {
    for (const h of history) {
      const t = publishedTests.find((pt) => pt.id === h.row.testId);
      if (t) return t;
    }
    return publishedTests[0];
  }, [history, publishedTests]);

  const latestEmail = useMemo(() => {
    const withEmail = history.find((h) => h.row.email);
    return withEmail?.row.email || "";
  }, [history]);

  function openInvite() {
    setInviteTestId(defaultPublishedTest?.id || publishedTests[0]?.id || "");
    setInviteEmail(latestEmail);
    setInviteSendNow(Boolean(latestEmail));
    setInviteOpen(true);
  }

  async function submitInvite() {
    if (!inviteTestId) {
      toast("Selecciona un cuestionario", "alert");
      return;
    }
    setInviteBusy(true);
    try {
      const prevIds = new Set((tests.find((t) => t.id === inviteTestId)?.invitations || []).map((iv) => iv.id));
      await addInvitation(inviteTestId, {
        name: company,
        email: inviteEmail || undefined,
        company,
        status: "pendiente",
        sentAt: null,
      });
      if (inviteSendNow && inviteEmail) {
        // Re-fetch tests to locate the freshly created invitation id, then send it.
        const res = await fetch(`/api/tests?mode=${mode}`);
        const fresh: { id: string; invitations?: { id: string; email?: string; company?: string }[] }[] = res.ok ? await res.json() : [];
        const t = fresh.find((tt) => tt.id === inviteTestId);
        const newIv = (t?.invitations || []).find((iv) => !prevIds.has(iv.id) && iv.email === inviteEmail);
        if (newIv) {
          const r = await sendInvitation(newIv.id);
          toast(r.ok ? "Invitación enviada por correo" : r.error || "Invitación creada, pero no se pudo enviar", r.ok ? "send" : "alert");
        } else {
          toast("Invitación creada", "check2");
        }
      } else {
        toast("Invitación creada", "check2");
      }
      setInviteOpen(false);
    } catch {
      toast("No se pudo crear la invitación", "alert");
    } finally {
      setInviteBusy(false);
    }
  }

  function copyLink() {
    const t = defaultPublishedTest;
    if (!t) {
      toast("No hay cuestionarios publicados", "alert");
      return;
    }
    const url = `${location.origin}/q/${t.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast("Enlace copiado al portapapeles", "copy"))
        .catch(() => toast("No se pudo copiar el enlace", "alert"));
    } else {
      toast("No se pudo copiar el enlace", "alert");
    }
  }

  const actionButtons = (small: boolean) => (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {mode === "clientes" && (
        <button type="button" className={"btn btn-secondary" + (small ? " btn-sm" : "")} onClick={() => nav("reporte", { company })}>
          <Icon name="doc" size={14} /> Ver reporte
        </button>
      )}
      <button type="button" className={"btn btn-secondary" + (small ? " btn-sm" : "")} onClick={openInvite}>
        <Icon name="mail" size={14} /> Invitar a re-evaluar
      </button>
      <button type="button" className={"btn btn-secondary" + (small ? " btn-sm" : "")} onClick={copyLink}>
        <Icon name="link" size={14} /> Copiar enlace
      </button>
    </div>
  );

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <PageWrap>
        <Skeleton width={220} height={13} style={{ marginBottom: 20 }} />
        <div className="card" style={{ padding: "28px 32px", marginBottom: 24, display: "flex", alignItems: "center", gap: 28 }}>
          <Skeleton width={120} height={120} radius="50%" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton width="22%" height={11} />
            <Skeleton width="42%" height={22} />
            <Skeleton width="58%" height={14} />
          </div>
        </div>
        <Skeleton width={380} height={34} style={{ marginBottom: 22 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </PageWrap>
    );
  }

  const TABS: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "resumen", label: "Resumen", icon: "doc" },
    { id: "evolucion", label: "Evolución", icon: "trendUp" },
    { id: "soluciones", label: "Soluciones", icon: "spark", count: triggeredSolutions.length },
    { id: "notas", label: "Notas", icon: "comment" },
    { id: "historial", label: "Historial", icon: "history", count: history.length },
  ];

  return (
    <PageWrap>
      {/* Sticky mini-header (shown after scrolling past the main header card) */}
      {stuck && (
        <div
          className="no-print"
          style={{
            position: "fixed", top: 60, left: 0, right: 0, zIndex: 35,
            background: "var(--topbar-bg)", backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--line)", animation: "fadeUp .18s ease",
          }}
        >
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "8px 28px", display: "flex", alignItems: "center", gap: 12 }}>
            <ScoreRing value={overallData.avg} size={36} stroke={4} animate={false} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company}</strong>
              <span className={"badge badge-" + bucket} style={{ flex: "none" }}>{tierLabel(overallData.avg)}</span>
            </div>
            <div className="hide-mobile">{actionButtons(true)}</div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="no-print" style={{ marginBottom: 18 }}>
        <Breadcrumbs items={[{ label: modeConfig.plural, onClick: () => nav("clientes") }, { label: company }]} />
      </div>

      {/* Header */}
      <div ref={headerRef} className="card" style={{ padding: "28px 32px", marginBottom: 24, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <ScoreRing value={overallData.avg} size={120} stroke={10} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{modeConfig.groupNounCap}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 8 }}>{company}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <span className={"badge badge-" + bucket} style={{ fontSize: 13 }}>{tierLabel(overallData.avg)}</span>
            <span className="badge">{overallData.count} evaluaci{overallData.count === 1 ? "ón" : "ones"}</span>
            <span className="badge" style={{ color }}>{SCORE_LABEL[bucket]}</span>
            {trend.length >= 2 && <DeltaBadge delta={trendDelta} />}
          </div>
          {actionButtons(false)}
        </div>
      </div>

      {entityResponses.length === 0 ? (
        <EmptyState icon="clipboard" title="Sin evaluaciones" sub="Aún no hay evaluaciones para esta entidad." />
      ) : (
        <>
          {/* Tabs */}
          <div className="seg no-print" style={{ marginBottom: 22, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={13} /> {t.label}
                {typeof t.count === "number" && t.count > 0 && (
                  <span className="mono" style={{ marginLeft: 5, fontSize: 11, opacity: 0.75 }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ---- Resumen ---- */}
          {tab === "resumen" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-up">
              {/* Topic radar */}
              {radarAxes.length > 0 && (
                <section>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Radar de temas</h2>
                  <div className="card" style={{ padding: "18px 20px" }}>
                    {radarAxes.length >= 3 ? (
                      <>
                        <RadarChart axes={radarAxes} />
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
                          Promedio por tema de todas las evaluaciones de {company}.
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {radarAxes.map((a, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 140, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "none" }}>
                              {a.name}
                            </div>
                            <div style={{ flex: 1 }}>
                              <ScoreBar value={a.value} height={7} showVal />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                            {td.topicAvgs.map((ta) => (
                              <div key={ta.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 140, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "none" }}>
                                  {ta.name}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <ScoreBar value={ta.avg} height={7} showVal />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ---- Evolución ---- */}
          {tab === "evolucion" && (
            <section className="fade-up">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Evolución del puntaje</h2>
                {trend.length >= 2 && <DeltaBadge delta={trendDelta} />}
              </div>
              {trend.length === 0 ? (
                <div className="card">
                  <EmptyState icon="trendUp" title="Sin datos suficientes" sub="Se necesitan evaluaciones con fecha para graficar la evolución." />
                </div>
              ) : (
                <div className="card" style={{ padding: "18px 20px" }}>
                  <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={compareAvg}
                        onChange={(e) => { setCompareAvg(e.target.checked); if (e.target.checked) setCompareEntity(""); }}
                      />
                      Comparar con promedio general
                    </label>
                    <select
                      className="select"
                      value={compareEntity}
                      onChange={(e) => { setCompareEntity(e.target.value); if (e.target.value) setCompareAvg(false); }}
                      style={{ fontSize: 13, maxWidth: 260 }}
                      aria-label={`Comparar con otra ${modeConfig.groupNoun}`}
                    >
                      <option value="">Comparar con otra {modeConfig.groupNoun}…</option>
                      {otherEntities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <TrendChart points={trend} label={company} compare={compareSeries} />
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
                    Promedio mensual de todas las evaluaciones de {company}.
                    {compareSeries ? ` Línea punteada: ${compareSeries.label}.` : ""}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ---- Soluciones ---- */}
          {tab === "soluciones" && (
            <section className="fade-up">
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>
                Soluciones recomendadas
                {triggeredSolutions.length > 0 && (
                  <span className="badge" style={{ marginLeft: 10, fontSize: 12 }}>{triggeredSolutions.length}</span>
                )}
              </h2>
              {triggeredSolutions.length === 0 ? (
                <div className="card">
                  <EmptyState icon="spark" title="Sin soluciones activadas" sub="Las evaluaciones de esta entidad no activaron ninguna solución recomendada." />
                </div>
              ) : (
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
              )}
            </section>
          )}

          {/* ---- Notas ---- */}
          {tab === "notas" && (
            <section className="fade-up">
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Notas del consultor</h2>
              <NotesPanel company={company} mode={mode} />
            </section>
          )}

          {/* ---- Historial ---- */}
          {tab === "historial" && (
            <section className="fade-up">
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Historial de evaluaciones</h2>

              {/* Filters */}
              <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <select
                  className="select"
                  value={histTest}
                  onChange={(e) => setHistTest(e.target.value)}
                  style={{ fontSize: 13, maxWidth: 260 }}
                  aria-label="Filtrar por cuestionario"
                >
                  <option value="">Todos los cuestionarios</option>
                  {historyTests.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setHistSortAsc((v) => !v)}
                  title="Cambiar orden"
                >
                  <Icon name={histSortAsc ? "trendUp" : "trendDown"} size={13} />
                  {histSortAsc ? "Más antiguas primero" : "Más recientes primero"}
                </button>
                <div className="seg" style={{ flex: "none" }}>
                  <button type="button" className={!histTimeline ? "on" : ""} onClick={() => setHistTimeline(false)}>
                    <Icon name="doc" size={13} /> Lista
                  </button>
                  <button type="button" className={histTimeline ? "on" : ""} onClick={() => setHistTimeline(true)}>
                    <Icon name="clock" size={13} /> Línea de tiempo
                  </button>
                </div>
              </div>

              {histTimeline ? (
                timeline.length === 0 ? (
                  <div className="card">
                    <EmptyState icon="clock" title="Sin actividad" sub="No hay actividad registrada con los filtros actuales." />
                  </div>
                ) : (
                  <div className="card" style={{ padding: "6px 18px" }}>
                    {timeline.map((it, i) => (
                      <div key={it.key} style={{ display: "flex", gap: 14, position: "relative" }}>
                        {/* Rail + icon */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 30, flex: "none" }}>
                          <div style={{ width: 1.5, flex: 1, background: i === 0 ? "transparent" : "var(--line)" }} />
                          <div style={{ width: 28, height: 28, borderRadius: 99, flex: "none", background: "var(--surface-sunken)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: it.iconColor }}>
                            <Icon name={it.icon} size={13} />
                          </div>
                          <div style={{ width: 1.5, flex: 1, background: i === timeline.length - 1 ? "transparent" : "var(--line)" }} />
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, padding: "13px 0", borderBottom: i < timeline.length - 1 ? "1px solid var(--line)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{it.title}</div>
                            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>
                              {it.sub ? `${it.sub} · ` : ""}
                              {it.date ? `${timeAgo(it.date)} · ${new Date(it.date).toLocaleDateString("es")}` : "Sin fecha"}
                            </div>
                          </div>
                          {typeof it.score === "number" && <ScoreBadge value={it.score} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : filteredHistory.length === 0 ? (
                <div className="card">
                  <EmptyState icon="doc" title="Sin evaluaciones" sub="No hay evaluaciones para el cuestionario seleccionado." />
                </div>
              ) : (
                <div className="card" style={{ overflow: "hidden" }}>
                  {filteredHistory.map((h, i) => (
                    <div
                      key={h.row.id}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < filteredHistory.length - 1 ? "1px solid var(--line)" : "none" }}
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
              )}
            </section>
          )}
        </>
      )}

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        width={460}
        title="Invitar a re-evaluar"
        sub={`Crea una invitación para ${company}.`}
      >
        <div style={{ padding: "16px 24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {publishedTests.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>No hay cuestionarios publicados disponibles.</p>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>Cuestionario</label>
                <select className="select" value={inviteTestId} onChange={(e) => setInviteTestId(e.target.value)} style={{ width: "100%" }}>
                  {publishedTests.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>Correo (opcional)</label>
                <input
                  className="input"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  style={{ width: "100%" }}
                />
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: inviteEmail ? "var(--ink-2)" : "var(--ink-4)", cursor: inviteEmail ? "pointer" : "default" }}>
                <input
                  type="checkbox"
                  checked={inviteSendNow && Boolean(inviteEmail)}
                  disabled={!inviteEmail}
                  onChange={(e) => setInviteSendNow(e.target.checked)}
                />
                Enviar invitación por correo ahora
              </label>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setInviteOpen(false)}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={inviteBusy || publishedTests.length === 0 || !inviteTestId}
              onClick={submitInvite}
            >
              <Icon name="send" size={14} /> {inviteBusy ? "Creando…" : "Crear invitación"}
            </button>
          </div>
        </div>
      </Modal>

      {toastNode}
    </PageWrap>
  );
}
