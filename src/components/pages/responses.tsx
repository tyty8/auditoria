"use client";
import React, { useState, useMemo } from "react";
import { useStore } from "@/components/store";
import type { ResponseRow, InvitationRow } from "@/components/store";
import { Icon, EmptyState, PageWrap, ScoreRing, ScoreBadge, Avatar } from "@/components/ui";
import { computeResult, SCORE_HEX, scoreBucket } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type TabId = "resumen" | "personas" | "entidades" | "analisis" | "invitaciones";

// ---- Mini score ring ----
function MiniRing({ value, size = 52 }: { value: number; size?: number }) {
  const bucket = scoreBucket(value);
  const color = SCORE_HEX[bucket];
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.3,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="mono" style={{ fontSize: size * .28, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{value}</span>
      </div>
    </div>
  );
}

// ---- Horizontal distribution bar ----
function DistBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 130, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: "var(--surface-sunken)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 4, transition: "width .5s cubic-bezier(.2,.7,.3,1)" }} />
      </div>
      <span className="mono" style={{ width: 28, fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textAlign: "right" }}>{count}</span>
    </div>
  );
}

// ---- Resumen tab ----
function ResumenTab({ testId, responses }: { testId: string; responses: ResponseRow[] }) {
  const { tests } = useStore();
  const test = tests.find((t) => t.id === testId);

  const computed = useMemo(() => {
    if (!test) return null;
    return responses.map((r) => ({
      row: r,
      result: computeResult(test.topics || [], test.solutions || [], r.answers || {}),
    }));
  }, [test, responses]);

  if (!test || !computed) return <EmptyState icon="gauge" title="Sin datos" />;

  const count = computed.length;
  const avgOverall = count > 0 ? Math.round(computed.reduce((s, c) => s + c.result.overall, 0) / count) : 0;

  const dist = { good: 0, warn: 0, bad: 0 };
  computed.forEach((c) => { dist[c.result.overallBucket]++; });

  const pct = (n: number) => count > 0 ? Math.round((n / count) * 100) : 0;

  // Per-topic averages
  const topicAvgs = (test.topics || []).map((t) => {
    const grades = computed.map((c) => c.result.topicResults.find((tr) => tr.topicId === t.id)?.grade ?? 0);
    const avg = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0;
    return { id: t.id, name: t.name, avg };
  });

  // Recent 5
  const recent = [...computed].sort((a, b) => {
    const da = a.row.submittedAt ? new Date(a.row.submittedAt).getTime() : 0;
    const db = b.row.submittedAt ? new Date(b.row.submittedAt).getTime() : 0;
    return db - da;
  }).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "start" }}>
        {/* Score ring */}
        <div className="card" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Puntaje promedio</div>
          <ScoreRing value={avgOverall} size={140} />
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{count} respuesta{count !== 1 ? "s" : ""}</div>
        </div>

        {/* Distribution */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Distribución de resultados</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([["good", "Saludable"], ["warn", "Atención"], ["bad", "Crítico"]] as const).map(([bucket, label]) => (
              <div key={bucket} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: SCORE_HEX[bucket], flex: "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
                    <span className="mono" style={{ fontSize: 13, color: "var(--ink-3)" }}>{dist[bucket]} ({pct(dist[bucket])}%)</span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: pct(dist[bucket]) + "%", height: "100%", background: SCORE_HEX[bucket], borderRadius: 99, transition: "width .6s cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-topic */}
      {topicAvgs.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Promedio por tema</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {topicAvgs.map((t) => {
              const b = scoreBucket(t.avg);
              return (
                <div key={t.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <MiniRing value={t.avg} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                    <span className={"badge badge-" + b} style={{ fontSize: 11, marginTop: 4 }}>{t.avg}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent responses */}
      {recent.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Respuestas recientes</h3>
          <div className="card" style={{ overflow: "hidden" }}>
            {recent.map((c, i) => (
              <div key={c.row.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < recent.length - 1 ? "1px solid var(--line)" : "none" }}>
                <Avatar name={c.row.respondent || c.row.email || "?"} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.row.respondent || c.row.email || "Anónimo"}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                    {c.row.company && <span>{c.row.company} · </span>}
                    {c.row.submittedAt ? new Date(c.row.submittedAt).toLocaleDateString("es") : "Sin fecha"}
                  </div>
                </div>
                <ScoreBadge value={c.result.overall} />
              </div>
            ))}
          </div>
        </div>
      )}

      {count === 0 && <EmptyState icon="users" title="Sin respuestas aún" sub="Las respuestas aparecerán aquí cuando alguien complete el cuestionario." />}
    </div>
  );
}

// ---- Personas tab ----
const PAGE_SIZE = 25;

function PersonasTab({ testId, responses, nav }: { testId: string; responses: ResponseRow[]; nav: NavFn }) {
  const { tests, deleteResponse } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);

  const computed = useMemo(() => {
    if (!test) return [];
    return responses.map((r) => ({
      row: r,
      result: computeResult(test.topics || [], test.solutions || [], r.answers || {}),
    }));
  }, [test, responses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return computed.filter((c) => {
      if (q) {
        const hay = `${c.row.respondent || ""} ${c.row.email || ""} ${c.row.company || ""} ${c.row.role || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fromDate || toDate) {
        const d = c.row.submittedAt ? c.row.submittedAt.slice(0, 10) : "";
        if (fromDate && (!d || d < fromDate)) return false;
        if (toDate && (!d || d > toDate)) return false;
      }
      return true;
    });
  }, [computed, query, fromDate, toDate]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "score") return b.result.overall - a.result.overall;
      const da = a.row.submittedAt ? new Date(a.row.submittedAt).getTime() : 0;
      const db = b.row.submittedAt ? new Date(b.row.submittedAt).getTime() : 0;
      return db - da;
    });
  }, [filtered, sortBy]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function updateFilter(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(0); };
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta respuesta? Esta acción no se puede deshacer.")) return;
    await deleteResponse(id);
  }

  if (!test) return <EmptyState icon="users" title="Sin datos" />;
  const topics = test.topics || [];

  return (
    <div>
      {/* Search + filter controls */}
      {computed.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
            <input
              className="input"
              placeholder="Buscar por nombre, email o empresa…"
              value={query}
              onChange={(e) => updateFilter(setQuery)(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
          <input
            className="input"
            type="date"
            value={fromDate}
            onChange={(e) => updateFilter(setFromDate)(e.target.value)}
            title="Desde"
            style={{ fontSize: 13, flex: "0 1 140px" }}
          />
          <input
            className="input"
            type="date"
            value={toDate}
            onChange={(e) => updateFilter(setToDate)(e.target.value)}
            title="Hasta"
            style={{ fontSize: 13, flex: "0 1 140px" }}
          />
          <span className="badge">{sorted.length} de {computed.length}</span>
          <div className="seg" style={{ flex: "none" }}>
            <button className={sortBy === "date" ? "on" : ""} onClick={() => setSortBy("date")}><Icon name="calendar" size={13} /> Fecha</button>
            <button className={sortBy === "score" ? "on" : ""} onClick={() => setSortBy("score")}><Icon name="gauge" size={13} /> Puntaje</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        computed.length === 0
          ? <EmptyState icon="users" title="Sin respuestas" sub="Aún no hay respuestas para este cuestionario." />
          : <EmptyState icon="search" title="Sin resultados" sub="Ninguna respuesta coincide con los filtros." />
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" }}>Persona</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" }}>Empresa</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" }}>Fecha</th>
                <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" }}>Global</th>
                {topics.map((t) => (
                  <th key={t.id} style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)", maxWidth: 110 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{t.name}</div>
                  </th>
                ))}
                <th style={{ width: 36, borderBottom: "1px solid var(--line)" }} />
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr
                  key={c.row.id}
                  style={{ borderBottom: i < paged.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                  onClick={() => window.open(`/q/${testId}/result/${c.row.id}`, "_blank")}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar name={c.row.respondent || c.row.email || "?"} size={28} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{c.row.respondent || c.row.email || "Anónimo"}</div>
                        {c.row.role && <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.row.role}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--ink-2)" }}>{c.row.company || "—"}</td>
                  <td style={{ padding: "11px 14px", color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {c.row.submittedAt ? new Date(c.row.submittedAt).toLocaleDateString("es") : "—"}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <ScoreBadge value={c.result.overall} withLabel={false} />
                  </td>
                  {topics.map((t) => {
                    const tr = c.result.topicResults.find((r) => r.topicId === t.id);
                    return (
                      <td key={t.id} style={{ padding: "11px 12px", textAlign: "center" }}>
                        {tr ? <span className={"badge badge-" + tr.bucket} style={{ fontSize: 11 }}>{tr.grade}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "11px 10px" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm btn-icon"
                      onClick={() => handleDelete(c.row.id)}
                      style={{ padding: 5, width: 26, height: 26 }}
                      title="Eliminar respuesta"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            <Icon name="chevronLeft" size={14} /> Anterior
          </button>
          <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
            Página {safePage + 1} de {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            Siguiente <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Entidades tab (Empresas / Tiendas / Empleados) ----
function EntidadesTab({ testId, responses, groupLabel }: { testId: string; responses: ResponseRow[]; groupLabel: string }) {
  const { tests } = useStore();
  const test = tests.find((t) => t.id === testId);

  const groups = useMemo(() => {
    if (!test) return [];
    const map: Record<string, { name: string; rows: { row: ResponseRow; result: ReturnType<typeof computeResult> }[] }> = {};
    responses.forEach((r) => {
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, rows: [] };
      map[key].rows.push({ row: r, result: computeResult(test.topics || [], test.solutions || [], r.answers || {}) });
    });
    return Object.values(map).map((g) => {
      const avg = g.rows.length > 0 ? Math.round(g.rows.reduce((s, c) => s + c.result.overall, 0) / g.rows.length) : 0;
      return { ...g, avg };
    }).sort((a, b) => a.avg - b.avg); // lowest first
  }, [test, responses]);

  if (!test) return <EmptyState icon="building" title="Sin datos" />;

  if (groups.length === 0) {
    return <EmptyState icon="building" title={"Sin " + groupLabel.toLowerCase()} sub={"Cuando lleguen respuestas con " + groupLabel.toLowerCase() + " asignada, aparecerán aquí agrupadas."} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map((g) => (
        <div key={g.name} className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 16 }}>
            <MiniRing value={g.avg} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>{g.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
                {g.rows.length} respuesta{g.rows.length !== 1 ? "s" : ""} · {groupLabel}
              </div>
            </div>
            <ScoreBadge value={g.avg} />
          </div>
          <div>
            {g.rows.map((c, i) => (
              <div key={c.row.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderBottom: i < g.rows.length - 1 ? "1px solid var(--line)" : "none" }}>
                <Avatar name={c.row.respondent || c.row.email || "?"} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.row.respondent || c.row.email || "Anónimo"}</div>
                  {c.row.role && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{c.row.role}</div>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                  {c.row.submittedAt ? new Date(c.row.submittedAt).toLocaleDateString("es") : ""}
                </div>
                <ScoreBadge value={c.result.overall} withLabel={false} />
                <a
                  href={`/q/${testId}/result/${c.row.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm btn-icon"
                  title="Ver resultado"
                  style={{ padding: 5, width: 26, height: 26 }}
                >
                  <Icon name="external" size={13} />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Análisis tab ----
function AnalisisTab({ testId, responses }: { testId: string; responses: ResponseRow[] }) {
  const { tests } = useStore();
  const test = tests.find((t) => t.id === testId);

  if (!test) return <EmptyState icon="sliders" title="Sin datos" />;
  if (responses.length === 0) return <EmptyState icon="sliders" title="Sin respuestas" sub="Agrega respuestas para ver el análisis por pregunta." />;

  const topics = test.topics || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {topics.map((topic) => (
        <div key={topic.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{topic.name}</h3>
            <span className="badge">{topic.questions.length} preg.</span>
          </div>
          {topic.questions.map((q, qi) => {
            // Count answers per option
            const counts: Record<string, number> = {};
            q.options.forEach((o) => { counts[o.id] = 0; });
            responses.forEach((r) => {
              const sel = r.answers?.[q.id];
              if (sel && counts[sel] !== undefined) counts[sel]++;
            });
            const maxCount = Math.max(1, ...Object.values(counts));

            return (
              <div key={q.id} className="card" style={{ padding: "14px 18px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
                  <span className="eyebrow" style={{ marginTop: 2 }}>{qi + 1}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", lineHeight: 1.4 }}>{q.text}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt) => {
                    const n = counts[opt.id] || 0;
                    const pct = responses.length > 0 ? Math.round((n / responses.length) * 100) : 0;
                    const isCorrect = opt.correct;
                    const color = topic.scoring === "percent"
                      ? (isCorrect ? "var(--good)" : "var(--bad-soft)")
                      : (opt.points > 0 ? "var(--primary)" : "var(--surface-sunken)");
                    const barColor = topic.scoring === "percent"
                      ? (isCorrect ? "var(--good)" : "var(--line-strong)")
                      : (opt.points > 0 ? "var(--primary)" : "var(--line-strong)");

                    return (
                      <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 160, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.label}
                          {topic.scoring === "weighted" && opt.points > 0 && (
                            <span className="mono" style={{ fontSize: 11, color: "var(--primary)", marginLeft: 6 }}>{opt.points}p</span>
                          )}
                        </div>
                        <div style={{ flex: 1, height: 20, background: "var(--surface-sunken)", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                          <div style={{ width: pct + "%", height: "100%", background: barColor, borderRadius: 5, transition: "width .5s cubic-bezier(.2,.7,.3,1)" }} />
                          {pct > 12 && (
                            <span className="mono" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "#fff", mixBlendMode: "difference" }}>{pct}%</span>
                          )}
                        </div>
                        <span className="mono" style={{ width: 28, fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textAlign: "right" }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---- Inv status badge ----
function InvStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { completada: "badge-good", enviada: "badge-info", pendiente: "" };
  const labels: Record<string, string> = { completada: "Completada", enviada: "Enviada", pendiente: "Pendiente" };
  return <span className={"badge " + (map[status] || "")}><span className="dot" />{labels[status] || status}</span>;
}

// ---- Invitaciones tab ----
function InvitacionesTab({ testId, toast }: { testId: string; toast: ToastFn }) {
  const { tests, addInvitation, deleteInvitation, sendInvitation, sendPendingInvitations } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  const invitations: InvitationRow[] = test?.invitations || [];
  const pendingCount = invitations.filter((i) => i.status === "pendiente" && i.email).length;

  async function handleSend(inv: InvitationRow, reminder = false) {
    setSendingId(inv.id);
    try {
      const result = await sendInvitation(inv.id, reminder);
      if (result.ok) toast(reminder ? "Recordatorio enviado" : "Invitación enviada", "send");
      else toast(result.error || "Error al enviar", "alert");
    } finally {
      setSendingId(null);
    }
  }

  async function handleBulkSend() {
    setBulkSending(true);
    try {
      const result = await sendPendingInvitations(testId);
      if (result.ok) {
        toast(`${result.sent} enviada${result.sent !== 1 ? "s" : ""}${result.failed ? `, ${result.failed} con error` : ""}`, "send");
      } else {
        toast(result.error || "Error al enviar", "alert");
      }
    } finally {
      setBulkSending(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    try {
      await addInvitation(testId, { name, email, company, status: "pendiente", sentAt: null });
      setName(""); setEmail(""); setCompany("");
      toast("Invitación creada", "send");
    } catch {
      toast("Error al crear invitación", "alert");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ivId: string) {
    if (!confirm("¿Eliminar esta invitación?")) return;
    await deleteInvitation(testId, ivId);
    toast("Invitación eliminada", "trash");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Add form */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Agregar invitación</h3>
        <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label className="field-label">Nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="field-label">Email <span style={{ color: "var(--bad)" }}>*</span></label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.com" required style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="field-label">Empresa</label>
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa S.A." style={{ fontSize: 13 }} />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !email}>
              <Icon name="send" size={14} /> {saving ? "Guardando…" : "Agregar invitación"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Invitaciones</h3>
            <span className="badge">{invitations.length}</span>
          </div>
          {pendingCount > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleBulkSend} disabled={bulkSending}>
              <Icon name="send" size={13} /> {bulkSending ? "Enviando…" : `Enviar ${pendingCount} pendiente${pendingCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        {invitations.length === 0 ? (
          <EmptyState icon="send" title="Sin invitaciones" sub="Agrega emails arriba para enviar invitaciones directas." />
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {invitations.map((inv, i) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < invitations.length - 1 ? "1px solid var(--line)" : "none" }}>
                <Avatar name={inv.name || inv.email || "?"} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.name || inv.email}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                    {inv.email}{inv.company ? ` · ${inv.company}` : ""}
                    {inv.sentAt ? ` · ${new Date(inv.sentAt).toLocaleDateString("es")}` : ""}
                  </div>
                </div>
                <InvStatusBadge status={inv.status} />
                {inv.email && inv.status === "pendiente" && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSend(inv)} disabled={sendingId === inv.id} title="Enviar invitación por email">
                    <Icon name="send" size={13} /> {sendingId === inv.id ? "Enviando…" : "Enviar"}
                  </button>
                )}
                {inv.email && inv.status === "enviada" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSend(inv, true)} disabled={sendingId === inv.id} title="Enviar recordatorio">
                    <Icon name="refresh" size={13} /> {sendingId === inv.id ? "Enviando…" : "Recordar"}
                  </button>
                )}
                <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => handleDelete(inv.id)} style={{ padding: 5, width: 28, height: 28 }} title="Eliminar">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main responses page ----
export default function ResponsesPage({ testId, nav, toast }: { testId: string; nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [tab, setTab] = useState<TabId>("resumen");

  const testResponses = useMemo(
    () => responses.filter((r) => r.testId === testId),
    [responses, testId]
  );

  // Determine entity tab label from mode
  const entityTabLabel = modeConfig.id === "clientes"
    ? "Empresas"
    : modeConfig.id === "tiendas"
    ? "Tiendas"
    : "Empleados";

  const tabs: { id: TabId; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "personas", label: modeConfig.personPlural },
    { id: "entidades", label: entityTabLabel },
    { id: "analisis", label: "Análisis" },
    { id: "invitaciones", label: "Invitaciones" },
  ];

  return (
    <PageWrap maxWidth="var(--maxw)">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => nav("dashboard")} title="Volver">
          <Icon name="back" size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 3 }}>Respuestas</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
            {test?.name || "Cuestionario"}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <span className="badge badge-info">
            <Icon name="users" size={13} /> {testResponses.length} respuesta{testResponses.length !== 1 ? "s" : ""}
          </span>
          {test && (
            <span className={"badge " + (test.status === "publicado" ? "badge-good" : "")}>
              <span className="dot" />
              {test.status === "publicado" ? "Publicado" : "Borrador"}
            </span>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav("builder", { testId })}>
            <Icon name="edit" size={14} /> Editar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid var(--line)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-.01em",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: tab === t.id ? "var(--primary)" : "var(--ink-3)",
              borderBottom: tab === t.id ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2,
              transition: "color .13s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "resumen" && <ResumenTab testId={testId} responses={testResponses} />}
      {tab === "personas" && <PersonasTab testId={testId} responses={testResponses} nav={nav} />}
      {tab === "entidades" && <EntidadesTab testId={testId} responses={testResponses} groupLabel={entityTabLabel} />}
      {tab === "analisis" && <AnalisisTab testId={testId} responses={testResponses} />}
      {tab === "invitaciones" && <InvitacionesTab testId={testId} toast={toast} />}
    </PageWrap>
  );
}
