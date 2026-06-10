"use client";
import React, { useMemo, useState } from "react";
import { useStore } from "@/components/store";
import {
  PageWrap, EmptyState, ScoreBadge, Icon, Sparkline, DeltaBadge,
  Skeleton, SkeletonCard, timeAgo,
} from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, totalQuestions } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;

// ---- Time ranges ----
const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "7", label: "7d", days: 7 },
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "all", label: "Todo", days: null },
];

const BUCKETS = 8;
const DAY_MS = 86400000;

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Fill empty buckets by carrying the nearest known value (prev first, then next)
function fillSeries(vals: (number | null)[]): number[] {
  const out = vals.slice();
  let last: number | null = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) out[i] = last;
    else last = out[i];
  }
  let next: number | null = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] == null) out[i] = next;
    else next = out[i];
  }
  return out.map((v) => v ?? 0);
}

// ---- Horizontal bar ----
function HBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 8, background: "var(--surface-sunken)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color || "var(--primary)", borderRadius: 99, transition: "width .6s cubic-bezier(.2,.7,.3,1)" }} />
    </div>
  );
}

// ---- KPI card with sparkline + delta ----
function KpiCard({ label, value, icon, color, spark, delta, suffix, deltaNote }: {
  label: string; value: string | number; icon: string; color: string;
  spark: number[]; delta: number | null; suffix?: string; deltaNote?: string;
}) {
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, flex: "none" }}>
          <Icon name={icon} size={15} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{label}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div className="mono" style={{ fontSize: 27, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{value}</div>
        <Sparkline values={spark} width={86} height={28} color={color} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <DeltaBadge delta={delta} suffix={suffix || ""} size="sm" />
        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{deltaNote || "vs período anterior"}</span>
      </div>
    </div>
  );
}

// ---- Quick action card ----
function QuickAction({ icon, title, sub, color, onClick, disabled }: {
  icon: string; title: string; sub: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      className="card"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
        cursor: disabled ? "default" : "pointer", border: "1px solid var(--line)", background: "var(--surface)",
        opacity: disabled ? 0.6 : 1, transition: "background .13s, border-color .13s", width: "100%",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = "var(--surface-sunken)"; e.currentTarget.style.borderColor = color; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, flex: "none" }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
      </div>
      <Icon name="arrowRight" size={15} />
    </button>
  );
}

export default function HomePage({ nav }: { nav: NavFn }) {
  const { tests, responses, taskActions, modeConfig, me, loading, createTest } = useStore();
  const [range, setRange] = useState("30");
  const [creating, setCreating] = useState(false);

  // ---- Greeting + date ----
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateStr = useMemo(() => {
    const s = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  // ---- Non-archived tests ----
  const activeTests = useMemo(() => tests.filter((t) => !t.archived), [tests]);

  // ---- Scored responses (only for non-archived tests) ----
  const scored = useMemo(() => {
    const byId = new Map(activeTests.map((t) => [t.id, t]));
    return responses.flatMap((r) => {
      const test = byId.get(r.testId);
      if (!test) return [];
      const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      const total = totalQuestions(test.topics || []);
      const answered = Object.keys(r.answers || {}).length;
      const ts = r.submittedAt ? new Date(r.submittedAt).getTime() : 0;
      return [{ r, test, overall: result.overall, triggered: result.triggered, completed: total > 0 && answered >= total, ts }];
    });
  }, [activeTests, responses]);

  // ---- Range boundaries + filtered sets ----
  const rangeDef = RANGES.find((x) => x.key === range) || RANGES[1];
  const { current, previous, cutoff, hasPrev } = useMemo(() => {
    const now = Date.now();
    if (rangeDef.days == null) {
      return { current: scored, previous: [] as typeof scored, cutoff: 0, hasPrev: false };
    }
    const co = now - rangeDef.days * DAY_MS;
    const pco = co - rangeDef.days * DAY_MS;
    return {
      current: scored.filter((s) => s.ts >= co),
      previous: scored.filter((s) => s.ts >= pco && s.ts < co),
      cutoff: co,
      hasPrev: true,
    };
  }, [scored, rangeDef.days]);

  // ---- KPI cards data ----
  const kpis = useMemo(() => {
    const now = Date.now();
    // bucket window
    let start: number;
    if (rangeDef.days != null) start = cutoff;
    else {
      const tss = current.filter((s) => s.ts > 0).map((s) => s.ts);
      start = tss.length > 0 ? Math.min(...tss) : now - 56 * DAY_MS;
    }
    const span = Math.max(1, now - start);
    const idxOf = (ts: number) => Math.min(BUCKETS - 1, Math.max(0, Math.floor(((ts - start) / span) * BUCKETS)));

    const counts = Array(BUCKETS).fill(0) as number[];
    const scoreSums = Array(BUCKETS).fill(0) as number[];
    const scoreCounts = Array(BUCKETS).fill(0) as number[];
    const compSums = Array(BUCKETS).fill(0) as number[];

    current.forEach((s) => {
      const i = idxOf(s.ts);
      counts[i]++;
      scoreSums[i] += s.overall;
      scoreCounts[i]++;
      if (s.completed) compSums[i]++;
    });

    const sparkResponses = counts.slice();
    const sparkScore = fillSeries(counts.map((c, i) => (c > 0 ? scoreSums[i] / scoreCounts[i] : null)));
    const sparkCompletion = fillSeries(counts.map((c, i) => (c > 0 ? (compSums[i] / c) * 100 : null)));

    // published tests (cumulative by createdAt)
    const pub = activeTests.filter((t) => t.status === "publicado");
    const sparkActive = Array.from({ length: BUCKETS }, (_, i) => {
      const bEnd = start + (span * (i + 1)) / BUCKETS;
      return pub.filter((t) => new Date(t.createdAt).getTime() <= bEnd).length;
    });

    // current period values
    const curCount = current.length;
    const curAvg = Math.round(avg(current.map((s) => s.overall)));
    const curComp = curCount > 0 ? Math.round((current.filter((s) => s.completed).length / curCount) * 100) : 0;

    // previous period values
    const prevCount = previous.length;
    const prevAvg = previous.length > 0 ? Math.round(avg(previous.map((s) => s.overall))) : null;
    const prevComp = prevCount > 0 ? Math.round((previous.filter((s) => s.completed).length / prevCount) * 100) : null;

    const deltaResponses = !hasPrev ? null : prevCount > 0 ? Math.round(((curCount - prevCount) / prevCount) * 100) : curCount > 0 ? 100 : null;
    const deltaScore = !hasPrev || prevAvg == null ? null : curAvg - prevAvg;
    const deltaComp = !hasPrev || prevComp == null ? null : curComp - prevComp;
    const deltaActive = !hasPrev ? null : pub.filter((t) => new Date(t.createdAt).getTime() >= cutoff).length || null;

    return {
      curCount, curAvg, curComp,
      activePub: pub.length,
      sparkResponses, sparkScore, sparkCompletion, sparkActive,
      deltaResponses, deltaScore, deltaComp, deltaActive,
    };
  }, [current, previous, activeTests, cutoff, hasPrev, rangeDef.days]);

  // ---- Per-test stats (range-filtered) with trend ----
  const testStats = useMemo(() => {
    return activeTests.map((test) => {
      const list = current.filter((s) => s.test.id === test.id).sort((a, b) => a.ts - b.ts);
      const avgScore = list.length > 0 ? Math.round(avg(list.map((s) => s.overall))) : 0;
      let delta: number | null = null;
      if (list.length >= 2) {
        const mid = Math.floor(list.length / 2);
        const older = list.slice(0, mid);
        const recent = list.slice(mid);
        delta = Math.round(avg(recent.map((s) => s.overall)) - avg(older.map((s) => s.overall)));
      }
      return {
        id: test.id,
        name: test.name,
        status: test.status,
        accent: test.accent || "var(--primary)",
        responseCount: list.length,
        avgScore,
        delta,
      };
    }).sort((a, b) => b.responseCount - a.responseCount);
  }, [activeTests, current]);

  const maxResponses = Math.max(1, ...testStats.map((t) => t.responseCount));

  // ---- Requiere atención: critical entities or dropping ≥5 pts ----
  const attention = useMemo(() => {
    const groups = new Map<string, typeof current>();
    current.forEach((s) => {
      const c = (s.r.company || "").trim();
      if (!c) return;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(s);
    });
    const rows: { company: string; avgScore: number; delta: number | null; count: number }[] = [];
    groups.forEach((list, company) => {
      const sorted = list.slice().sort((a, b) => a.ts - b.ts);
      const avgScore = Math.round(avg(sorted.map((s) => s.overall)));
      let delta: number | null = null;
      if (sorted.length >= 2) {
        const mid = Math.floor(sorted.length / 2);
        const first = sorted.slice(0, mid);
        const second = sorted.slice(mid);
        delta = Math.round(avg(second.map((s) => s.overall)) - avg(first.map((s) => s.overall)));
      }
      if (scoreBucket(avgScore) === "bad" || (delta != null && delta <= -5)) {
        rows.push({ company, avgScore, delta, count: sorted.length });
      }
    });
    return rows.sort((a, b) => a.avgScore - b.avgScore).slice(0, 6);
  }, [current]);

  // ---- Activity feed ----
  const activity = useMemo(() => {
    type Ev = { id: string; ts: number; icon: string; color: string; title: string; sub?: string; onClick: () => void };
    const events: Ev[] = [];

    // new responses
    current.forEach((s) => {
      if (s.ts <= 0) return;
      events.push({
        id: "r-" + s.r.id,
        ts: s.ts,
        icon: "send",
        color: "var(--info)",
        title: `${s.r.respondent || s.r.company || "Anónimo"} respondió`,
        sub: s.test.name,
        onClick: () => nav("responses", { testId: s.test.id }),
      });
    });

    // completed invitations
    activeTests.forEach((t) => {
      (t.invitations || []).forEach((iv) => {
        if (iv.status !== "completada") return;
        const raw = iv.openedAt || iv.sentAt;
        if (!raw) return;
        const ts = new Date(raw).getTime();
        if (isNaN(ts) || (rangeDef.days != null && ts < cutoff)) return;
        events.push({
          id: "i-" + iv.id,
          ts,
          icon: "mail",
          color: "var(--good)",
          title: `${iv.name || iv.email || "Invitado"} completó una invitación`,
          sub: t.name,
          onClick: () => nav("responses", { testId: t.id }),
        });
      });
    });

    // task actions done
    const testById = new Map(activeTests.map((t) => [t.id, t]));
    taskActions.forEach((a) => {
      if (a.status !== "hecho" || !a.updatedAt) return;
      const ts = new Date(a.updatedAt).getTime();
      if (isNaN(ts) || (rangeDef.days != null && ts < cutoff)) return;
      const test = testById.get(a.testId);
      const sol = test?.solutions?.find((s) => s.id === a.solutionId);
      events.push({
        id: "a-" + a.id,
        ts,
        icon: "check2",
        color: "var(--good)",
        title: `Acción completada · ${a.entityName}`,
        sub: sol?.name || test?.name,
        onClick: () => nav("tablero"),
      });
    });

    return events.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [current, activeTests, taskActions, cutoff, rangeDef.days, nav]);

  // ---- Top solutions (range-filtered) ----
  const topSolutions = useMemo(() => {
    const counts: Record<string, { name: string; count: number; category: string }> = {};
    current.forEach((s) => {
      s.triggered.forEach((sol) => {
        if (!counts[sol.id]) counts[sol.id] = { name: sol.name, count: 0, category: sol.category || "" };
        counts[sol.id].count++;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }));
  }, [current]);

  const maxSolCount = Math.max(1, ...topSolutions.map((s) => s.count));

  // ---- Quick actions ----
  const handleNewTest = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createTest();
      nav("builder", { testId: id });
    } catch {
      nav("dashboard");
    } finally {
      setCreating(false);
    }
  };

  // ---- Skeleton state ----
  if (loading) {
    return (
      <PageWrap>
        <div style={{ marginBottom: 28 }}>
          <Skeleton width={160} height={12} style={{ marginBottom: 10 }} />
          <Skeleton width={300} height={28} style={{ marginBottom: 10 }} />
          <Skeleton width={220} height={13} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={66} radius="var(--r-md, 12px)" />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      {/* Header + range filter */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            {greeting}, {me?.name || "Admin"}
          </h1>
          <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
            {dateStr} · Resumen general de actividad en todos los cuestionarios
          </p>
        </div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? "on" : ""} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard
          label="Cuestionarios activos"
          value={kpis.activePub}
          icon="clipboard"
          color="var(--primary)"
          spark={kpis.sparkActive}
          delta={kpis.deltaActive}
          deltaNote={kpis.deltaActive ? "publicados en el período" : "vs período anterior"}
        />
        <KpiCard
          label="Respuestas"
          value={kpis.curCount}
          icon="users"
          color="var(--info)"
          spark={kpis.sparkResponses}
          delta={kpis.deltaResponses}
          suffix="%"
        />
        <KpiCard
          label="Puntaje promedio"
          value={kpis.curAvg}
          icon="gauge"
          color={SCORE_HEX[scoreBucket(kpis.curAvg)] || "var(--primary)"}
          spark={kpis.sparkScore}
          delta={kpis.deltaScore}
        />
        <KpiCard
          label="Tasa de completud"
          value={kpis.curComp + "%"}
          icon="check2"
          color="var(--good)"
          spark={kpis.sparkCompletion}
          delta={kpis.deltaComp}
          suffix="%"
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
        <QuickAction
          icon="plus"
          title={creating ? "Creando…" : "Nuevo cuestionario"}
          sub="Crear y abrir el editor"
          color="var(--primary)"
          onClick={handleNewTest}
          disabled={creating}
        />
        <QuickAction
          icon="kanban"
          title="Ver tablero"
          sub="Acciones y seguimiento"
          color="var(--info)"
          onClick={() => nav("tablero")}
        />
        <QuickAction
          icon="send"
          title="Invitar"
          sub="Enviar invitaciones a responder"
          color="var(--good)"
          onClick={() => nav("dashboard")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
        {/* Requiere atención */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="alert" size={16} stroke={2.2} /> Requiere atención
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => nav("clientes")}
              style={{ color: "var(--primary)", fontWeight: 600 }}
            >
              Ver {modeConfig.plural.toLowerCase()} <Icon name="arrowRight" size={14} />
            </button>
          </div>

          {attention.length === 0 ? (
            <EmptyState
              icon="check2"
              title="Todo en orden"
              sub={`Ningún ${modeConfig.singular.toLowerCase()} en estado crítico ni con caídas de puntaje en el período.`}
            />
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {attention.map((row, i) => (
                <div
                  key={row.company}
                  onClick={() => nav("cliente", { company: row.company })}
                  style={{
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: i < attention.length - 1 ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                    transition: "background .13s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div style={{ width: 8, height: 8, borderRadius: 99, background: SCORE_HEX[scoreBucket(row.avgScore)], flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clamp-1" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{row.company}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                      {row.count} {row.count === 1 ? "respuesta" : "respuestas"} en el período
                    </div>
                  </div>
                  <DeltaBadge delta={row.delta} size="sm" />
                  <ScoreBadge value={row.avgScore} withLabel={false} />
                  <Icon name="chevronRight" size={14} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actividad reciente */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="clock" size={16} stroke={2.2} /> Actividad reciente
            </h2>
          </div>

          {activity.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Sin actividad"
              sub="Las respuestas nuevas, invitaciones completadas y acciones cerradas aparecerán aquí."
            />
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {activity.map((ev, i) => (
                <div
                  key={ev.id}
                  onClick={ev.onClick}
                  style={{
                    padding: "10px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: i < activity.length - 1 ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                    transition: "background .13s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", color: ev.color, flex: "none" }}>
                    <Icon name={ev.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clamp-1" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{ev.title}</div>
                    {ev.sub && <div className="clamp-1" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{ev.sub}</div>}
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--ink-4)", flex: "none", whiteSpace: "nowrap" }}>{timeAgo(new Date(ev.ts))}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                      <DeltaBadge delta={test.delta} size="sm" />
                      <ScoreBadge value={test.avgScore} />
                    </div>
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
