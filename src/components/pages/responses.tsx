"use client";
import React, { useState, useMemo, useRef } from "react";
import { useStore } from "@/components/store";
import type { ResponseRow, InvitationRow, TestSummary } from "@/components/store";
import {
  Icon, EmptyState, PageWrap, ScoreRing, ScoreBar, ScoreBadge, Avatar,
  Drawer, Modal, ConfirmModal, Skeleton, SkeletonCard, timeAgo,
} from "@/components/ui";
import { computeResult, SCORE_HEX, scoreBucket } from "@/lib/scoring";
import type { Topic, Question } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type TabId = "resumen" | "personas" | "entidades" | "analisis" | "invitaciones";

// ===========================================================================
// CSV helpers
// ===========================================================================
function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(s: string): string {
  return (s || "export").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "export";
}

// Client-side CSV parser (handles quoted fields, "" escapes, , or ; delimiter)
function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cur); cur = "";
    } else if (ch === "\n") {
      row.push(cur); rows.push(row); row = []; cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ===========================================================================
// Date range presets
// ===========================================================================
type DatePreset = "all" | "today" | "7d" | "month" | "30d" | "quarter" | "custom";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "today", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "month", label: "Este mes" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "quarter", label: "Trimestre actual" },
  { id: "custom", label: "Personalizado" },
];

function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = fmtDateISO(now);
  switch (preset) {
    case "today": return { from: today, to: today };
    case "7d": { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: fmtDateISO(d), to: today }; }
    case "month": return { from: fmtDateISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: fmtDateISO(d), to: today }; }
    case "quarter": return { from: fmtDateISO(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: today };
    default: return { from: "", to: "" };
  }
}

// ===========================================================================
// Small popover menu with a visible labelled button (keeps open for checkboxes)
// ===========================================================================
function PopMenu({ label, icon, width = 250, children }: {
  label: string; icon: string; width?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flex: "none" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} size={13} /> {label} <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div className="card" style={{ position: "absolute", right: 0, top: 36, width, padding: 8, boxShadow: "var(--sh-pop)", zIndex: 51, animation: "popIn .15s cubic-bezier(.2,.7,.3,1)" }}>
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

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

// ===========================================================================
// Response detail Drawer (shared by Personas + Análisis)
// ===========================================================================
function ResponseDetailDrawer({ test, row, onClose, toast }: {
  test: TestSummary; row: ResponseRow | null; onClose: () => void; toast: ToastFn;
}) {
  const { deleteResponse } = useStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const result = useMemo(() => {
    if (!row) return null;
    return computeResult(test.topics || [], test.solutions || [], row.answers || {});
  }, [test, row]);

  const topics = test.topics || [];

  return (
    <>
      <Drawer
        open={!!row}
        onClose={onClose}
        width={560}
        title={row ? (row.respondent || row.email || "Anónimo") : ""}
        sub={row ? [row.role, row.company].filter(Boolean).join(" · ") || undefined : undefined}
      >
        {row && result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Info + overall */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <ScoreRing value={result.overall} size={110} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={row.respondent || row.email || "?"} size={26} />
                  <span style={{ fontWeight: 700 }}>{row.respondent || row.email || "Anónimo"}</span>
                </div>
                {row.email && <div style={{ color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="mail" size={13} /> {row.email}</div>}
                {row.company && <div style={{ color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="building" size={13} /> {row.company}</div>}
                <div style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="calendar" size={13} />
                  {row.submittedAt ? `${new Date(row.submittedAt).toLocaleString("es")} · ${timeAgo(row.submittedAt)}` : "Sin fecha"}
                </div>
              </div>
            </div>

            {/* Per-topic */}
            {result.topicResults.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Resultados por tema</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.topicResults.map((tr) => (
                    <div key={tr.topicId}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{tr.name}</span>
                        <span className={"badge badge-" + tr.bucket} style={{ fontSize: 11 }}>{tr.grade}%</span>
                      </div>
                      <ScoreBar value={tr.grade} height={7} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="hr" />

            {/* Full questionnaire */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Cuestionario completo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {topics.map((topic) => {
                  const tr = result.topicResults.find((x) => x.topicId === topic.id);
                  return (
                    <div key={topic.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800 }}>{topic.name}</h4>
                        {tr && <span className={"badge badge-" + tr.bucket} style={{ fontSize: 10.5 }}>{tr.grade}%</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {topic.questions.map((q, qi) => {
                          const sel = row.answers?.[q.id];
                          return (
                            <div key={q.id}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6 }}>
                                <span className="eyebrow" style={{ marginTop: 2 }}>{qi + 1}</span>
                                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{q.text}</div>
                                {!sel && <span className="badge" style={{ fontSize: 10.5, flex: "none" }}>Sin respuesta</span>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {q.options.map((opt) => {
                                  const chosen = sel === opt.id;
                                  return (
                                    <div key={opt.id} style={{
                                      display: "flex", alignItems: "center", gap: 8,
                                      padding: "6px 10px", borderRadius: 8, fontSize: 12.5,
                                      border: chosen ? "1.5px solid var(--primary)" : "1px solid var(--line)",
                                      background: chosen ? "var(--surface-sunken)" : "transparent",
                                      fontWeight: chosen ? 700 : 500,
                                      color: chosen ? "var(--ink)" : "var(--ink-3)",
                                    }}>
                                      {chosen
                                        ? <Icon name="check2" size={13} stroke={2.6} style={{ color: "var(--primary)", flex: "none" }} />
                                        : <span style={{ width: 13, flex: "none" }} />}
                                      <span style={{ flex: 1 }}>{opt.label}</span>
                                      {topic.scoring === "weighted"
                                        ? <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: chosen ? "var(--primary)" : "var(--ink-4)" }}>{opt.points}p</span>
                                        : opt.correct && <Icon name="star" size={12} style={{ color: "var(--good)", flex: "none" }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
              <a
                className="btn btn-secondary btn-sm"
                href={`/q/${test.id}/result/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" size={13} /> Ver resultado público
              </a>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmOpen(true)}>
                <Icon name="trash" size={13} /> Eliminar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Drawer>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (!row) return;
          await deleteResponse(row.id);
          toast("Respuesta eliminada", "trash");
          onClose();
        }}
        title="Eliminar respuesta"
        message="Esta acción no se puede deshacer. ¿Eliminar esta respuesta definitivamente?"
      />
    </>
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

// ===========================================================================
// Personas tab
// ===========================================================================
const PAGE_SIZE = 25;

type SavedView = {
  id: string; name: string; query: string;
  preset: DatePreset; from: string; to: string;
  sort: "date" | "score";
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function PersonasTab({ testId, responses, toast }: { testId: string; responses: ResponseRow[]; toast: ToastFn }) {
  const { tests, deleteResponse } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [detailRow, setDetailRow] = useState<ResponseRow | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Column visibility (persisted per test)
  const colsKey = `auditoria_cols_${testId}`;
  const [hiddenTopics, setHiddenTopics] = useState<string[]>(() => loadJSON<string[]>(colsKey, []));
  function toggleTopic(id: string) {
    setHiddenTopics((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(colsKey, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  // Saved views (persisted per test)
  const viewsKey = `auditoria_views_${testId}`;
  const [views, setViews] = useState<SavedView[]>(() => loadJSON<SavedView[]>(viewsKey, []));
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  function persistViews(next: SavedView[]) {
    setViews(next);
    try { localStorage.setItem(viewsKey, JSON.stringify(next)); } catch { /* noop */ }
  }
  function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    const v: SavedView = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, query, preset: datePreset, from: fromDate, to: toDate, sort: sortBy,
    };
    persistViews([...views, v]);
    setSaveViewOpen(false);
    setViewName("");
    toast(`Vista «${name}» guardada`, "check2");
  }
  function applyView(v: SavedView) {
    setQuery(v.query);
    setDatePreset(v.preset);
    setFromDate(v.from);
    setToDate(v.to);
    setSortBy(v.sort);
    setPage(0);
    toast(`Vista «${v.name}» aplicada`, "filter");
  }

  const computed = useMemo(() => {
    if (!test) return [];
    return responses.map((r) => ({
      row: r,
      result: computeResult(test.topics || [], test.solutions || [], r.answers || {}),
    }));
  }, [test, responses]);

  // Effective date range from preset
  const range = useMemo(() => {
    if (datePreset === "custom") return { from: fromDate, to: toDate };
    return presetRange(datePreset);
  }, [datePreset, fromDate, toDate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return computed.filter((c) => {
      if (q) {
        const hay = `${c.row.respondent || ""} ${c.row.email || ""} ${c.row.company || ""} ${c.row.role || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (range.from || range.to) {
        const d = c.row.submittedAt ? c.row.submittedAt.slice(0, 10) : "";
        if (range.from && (!d || d < range.from)) return false;
        if (range.to && (!d || d > range.to)) return false;
      }
      return true;
    });
  }, [computed, query, range]);

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

  if (!test) return <EmptyState icon="users" title="Sin datos" />;
  const topics = test.topics || [];
  const visibleTopics = topics.filter((t) => !hiddenTopics.includes(t.id));

  function exportCSV() {
    if (!test) return;
    const header = ["Persona", "Email", "Empresa", "Rol", "Fecha", "Global", ...visibleTopics.map((t) => t.name)];
    const rows: (string | number)[][] = sorted.map((c) => [
      c.row.respondent || "",
      c.row.email || "",
      c.row.company || "",
      c.row.role || "",
      c.row.submittedAt ? new Date(c.row.submittedAt).toLocaleDateString("es") : "",
      c.result.overall,
      ...visibleTopics.map((t) => c.result.topicResults.find((r) => r.topicId === t.id)?.grade ?? ""),
    ]);
    downloadCSV(`respuestas_${slugify(test.name)}.csv`, [header, ...rows]);
    toast(`CSV exportado (${sorted.length} fila${sorted.length !== 1 ? "s" : ""})`, "download");
  }

  const thStyle: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" };

  return (
    <div>
      {/* Search + filter controls */}
      {computed.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
            <input
              className="input"
              placeholder="Buscar por nombre, email o empresa…"
              value={query}
              onChange={(e) => updateFilter(setQuery)(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
          <select
            className="select"
            value={datePreset}
            onChange={(e) => { setDatePreset(e.target.value as DatePreset); setPage(0); }}
            title="Rango de fechas"
            style={{ fontSize: 13, flex: "0 1 170px" }}
          >
            {DATE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {datePreset === "custom" && (
            <>
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
            </>
          )}
          <span className="badge">{sorted.length} de {computed.length}</span>
          <div className="seg" style={{ flex: "none" }}>
            <button className={sortBy === "date" ? "on" : ""} onClick={() => setSortBy("date")}><Icon name="calendar" size={13} /> Fecha</button>
            <button className={sortBy === "score" ? "on" : ""} onClick={() => setSortBy("score")}><Icon name="gauge" size={13} /> Puntaje</button>
          </div>

          {/* Saved views */}
          <PopMenu label="Vistas" icon="eye" width={260}>
            {(close) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {views.length === 0 && (
                  <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--ink-3)" }}>Sin vistas guardadas.</div>
                )}
                {views.map((v) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, justifyContent: "flex-start", gap: 8, padding: "7px 10px" }}
                      onClick={() => { applyView(v); close(); }}
                    >
                      <Icon name="filter" size={13} />
                      <span className="clamp-1" style={{ textAlign: "left" }}>{v.name}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm btn-icon"
                      style={{ width: 26, height: 26, padding: 4, flex: "none" }}
                      title="Eliminar vista"
                      onClick={() => persistViews(views.filter((x) => x.id !== v.id))}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
                <div className="hr" style={{ margin: "5px 0" }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: "flex-start", gap: 8, padding: "7px 10px" }}
                  onClick={() => { close(); setViewName(""); setSaveViewOpen(true); }}
                >
                  <Icon name="star" size={13} /> Guardar vista actual
                </button>
              </div>
            )}
          </PopMenu>

          {/* Column visibility */}
          {topics.length > 0 && (
            <PopMenu label="Columnas" icon="columns" width={240}>
              {() => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="eyebrow" style={{ padding: "4px 8px 6px" }}>Columnas por tema</div>
                  {topics.map((t) => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={!hiddenTopics.includes(t.id)}
                        onChange={() => toggleTopic(t.id)}
                      />
                      <span className="clamp-1">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </PopMenu>
          )}

          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCSV} title="Exportar tabla filtrada a CSV">
            <Icon name="download" size={13} /> CSV
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        computed.length === 0
          ? <EmptyState icon="users" title="Sin respuestas" sub="Aún no hay respuestas para este cuestionario." />
          : <EmptyState icon="search" title="Sin resultados" sub="Ninguna respuesta coincide con los filtros." />
      ) : (
        <div style={{ overflowX: "auto" }}>
        <div className="card" style={{ overflow: "auto", minWidth: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={thStyle}>Persona</th>
                <th style={thStyle}>Empresa</th>
                <th style={thStyle}>Fecha</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Global</th>
                {visibleTopics.map((t) => (
                  <th key={t.id} style={{ ...thStyle, textAlign: "center", padding: "10px 12px", maxWidth: 110 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{t.name}</div>
                  </th>
                ))}
                <th style={{ width: 64, borderBottom: "1px solid var(--line)" }} />
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr
                  key={c.row.id}
                  style={{ borderBottom: i < paged.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", transition: "background .12s" }}
                  onClick={() => setDetailRow(c.row)}
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
                  {visibleTopics.map((t) => {
                    const tr = c.result.topicResults.find((r) => r.topicId === t.id);
                    return (
                      <td key={t.id} style={{ padding: "11px 12px", textAlign: "center" }}>
                        {tr ? <span className={"badge badge-" + tr.bucket} style={{ fontSize: 11 }}>{tr.grade}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "11px 10px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`/q/${testId}/result/${c.row.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Ver resultado público"
                      style={{ padding: 5, width: 26, height: 26, marginRight: 4 }}
                    >
                      <Icon name="external" size={13} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm btn-icon"
                      onClick={() => setConfirmId(c.row.id)}
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

      {/* Detail drawer */}
      <ResponseDetailDrawer test={test} row={detailRow} onClose={() => setDetailRow(null)} toast={toast} />

      {/* Delete confirm (table row) */}
      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          if (!confirmId) return;
          await deleteResponse(confirmId);
          toast("Respuesta eliminada", "trash");
          setConfirmId(null);
        }}
        title="Eliminar respuesta"
        message="Esta acción no se puede deshacer. ¿Eliminar esta respuesta definitivamente?"
      />

      {/* Save view modal */}
      <Modal open={saveViewOpen} onClose={() => setSaveViewOpen(false)} width={400} title="Guardar vista" sub="Guarda los filtros y el orden actuales para reutilizarlos.">
        <div style={{ padding: "14px 24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            className="input"
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveCurrentView(); }}
            placeholder="Nombre de la vista (ej. «Críticos del mes»)"
            style={{ fontSize: 13.5 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSaveViewOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!viewName.trim()} onClick={saveCurrentView}>
              <Icon name="star" size={13} /> Guardar
            </button>
          </div>
        </div>
      </Modal>
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

// ===========================================================================
// Análisis tab
// ===========================================================================
type QStat = {
  topic: Topic; q: Question; qi: number;
  counts: Record<string, number>; answered: number; avg: number;
};

function QuestionCard({ stat, responses, showTopic, expandedKey, onToggle, onPick }: {
  stat: QStat; responses: ResponseRow[]; showTopic: boolean;
  expandedKey: string | null; onToggle: (key: string) => void; onPick: (r: ResponseRow) => void;
}) {
  const { topic, q, qi, counts, answered, avg } = stat;
  return (
    <div className="card" style={{ padding: "14px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
        <span className="eyebrow" style={{ marginTop: 2 }}>{qi + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", lineHeight: 1.4 }}>{q.text}</div>
          {showTopic && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>{topic.name}</div>}
        </div>
        {answered > 0 && (
          <span className={"badge badge-" + scoreBucket(avg)} style={{ fontSize: 11, flex: "none" }} title={`Puntaje promedio · ${answered} respuesta${answered !== 1 ? "s" : ""}`}>
            {avg}%
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.options.map((opt) => {
          const n = counts[opt.id] || 0;
          const pct = responses.length > 0 ? Math.round((n / responses.length) * 100) : 0;
          const isCorrect = opt.correct;
          const barColor = topic.scoring === "percent"
            ? (isCorrect ? "var(--good)" : "var(--line-strong)")
            : (opt.points > 0 ? "var(--primary)" : "var(--line-strong)");
          const key = q.id + "::" + opt.id;
          const isExpanded = expandedKey === key;
          const choosers = isExpanded ? responses.filter((r) => r.answers?.[q.id] === opt.id) : [];

          return (
            <div key={opt.id}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderRadius: 6 }}
                onClick={() => onToggle(key)}
                title="Ver quiénes eligieron esta opción"
              >
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
                <Icon name={isExpanded ? "chevronDown" : "chevronRight"} size={12} style={{ color: "var(--ink-4)", flex: "none" }} />
              </div>

              {/* Who chose this option */}
              {isExpanded && (
                <div style={{ margin: "6px 0 4px", padding: "8px 10px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
                  {choosers.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "2px 4px" }}>Nadie eligió esta opción.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {choosers.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="btn btn-ghost btn-sm btn-block"
                          style={{ justifyContent: "flex-start", gap: 8, padding: "6px 8px", fontWeight: 600 }}
                          onClick={(e) => { e.stopPropagation(); onPick(r); }}
                          title="Ver respuesta completa"
                        >
                          <Avatar name={r.respondent || r.email || "?"} size={20} />
                          <span className="clamp-1" style={{ textAlign: "left" }}>{r.respondent || r.email || "Anónimo"}</span>
                          {r.company && <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 500 }}>{r.company}</span>}
                          <span style={{ marginLeft: "auto", color: "var(--ink-4)", fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap" }}>
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("es") : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalisisTab({ testId, responses, toast }: { testId: string; responses: ResponseRow[]; toast: ToastFn }) {
  const { tests } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [order, setOrder] = useState<"quiz" | "worst">("quiz");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ResponseRow | null>(null);

  // Per-question stats (counts + weighted/percent average)
  const stats = useMemo<QStat[]>(() => {
    if (!test) return [];
    return (test.topics || []).flatMap((topic) =>
      topic.questions.map((q, qi) => {
        const counts: Record<string, number> = {};
        q.options.forEach((o) => { counts[o.id] = 0; });
        let answered = 0;
        let sum = 0;
        const maxPts = Math.max(0, ...q.options.map((o) => o.points));
        responses.forEach((r) => {
          const sel = r.answers?.[q.id];
          if (!sel || counts[sel] === undefined) return;
          counts[sel]++;
          answered++;
          const opt = q.options.find((o) => o.id === sel);
          if (!opt) return;
          sum += topic.scoring === "percent"
            ? (opt.correct ? 100 : 0)
            : (maxPts > 0 ? (opt.points / maxPts) * 100 : 0);
        });
        return { topic, q, qi, counts, answered, avg: answered > 0 ? Math.round(sum / answered) : 0 };
      })
    );
  }, [test, responses]);

  if (!test) return <EmptyState icon="sliders" title="Sin datos" />;
  if (responses.length === 0) return <EmptyState icon="sliders" title="Sin respuestas" sub="Agrega respuestas para ver el análisis por pregunta." />;

  const topics = test.topics || [];
  const top5 = stats.filter((s) => s.answered > 0).sort((a, b) => a.avg - b.avg).slice(0, 5);
  const worstFirst = [...stats].sort((a, b) => a.avg - b.avg);

  function toggleExpand(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function exportCSV() {
    if (!test) return;
    const header = ["Tema", "Pregunta", "Opción", "Respuestas", "%"];
    const rows: (string | number)[][] = [];
    stats.forEach((s) => {
      s.q.options.forEach((opt) => {
        const n = s.counts[opt.id] || 0;
        const pct = responses.length > 0 ? Math.round((n / responses.length) * 100) : 0;
        rows.push([s.topic.name, s.q.text, opt.label, n, pct]);
      });
    });
    downloadCSV(`analisis_${slugify(test.name)}.csv`, [header, ...rows]);
    toast("CSV de análisis exportado", "download");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="seg" style={{ flex: "none" }}>
          <button className={order === "quiz" ? "on" : ""} onClick={() => setOrder("quiz")}><Icon name="doc" size={13} /> Orden del cuestionario</button>
          <button className={order === "worst" ? "on" : ""} onClick={() => setOrder("worst")}><Icon name="trendDown" size={13} /> Peor primero</button>
        </div>
        <span className="badge">{responses.length} respuesta{responses.length !== 1 ? "s" : ""}</span>
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={exportCSV} title="Exportar distribución por pregunta a CSV">
          <Icon name="download" size={13} /> CSV
        </button>
      </div>

      {/* Top 5 problemas */}
      {top5.length > 0 && (
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Icon name="alert" size={15} style={{ color: "var(--bad)" }} />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Top 5 problemas</h3>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Las preguntas con peor puntaje promedio</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {top5.map((s, i) => (
              <div key={s.q.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mono" style={{ width: 20, fontSize: 13, fontWeight: 800, color: "var(--ink-4)", textAlign: "right", flex: "none" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clamp-1" style={{ fontSize: 13.5, fontWeight: 600 }}>{s.q.text}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                    {s.topic.name} · {s.answered} respuesta{s.answered !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ width: 120, flex: "none" }} className="hide-mobile">
                  <ScoreBar value={s.avg} height={7} />
                </div>
                <span className={"badge badge-" + scoreBucket(s.avg)} style={{ flex: "none" }}>{s.avg}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown */}
      {order === "quiz" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {topics.map((topic) => (
            <div key={topic.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{topic.name}</h3>
                <span className="badge">{topic.questions.length} preg.</span>
              </div>
              {stats.filter((s) => s.topic.id === topic.id).map((s) => (
                <QuestionCard
                  key={s.q.id}
                  stat={s}
                  responses={responses}
                  showTopic={false}
                  expandedKey={expandedKey}
                  onToggle={toggleExpand}
                  onPick={setDetailRow}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {worstFirst.map((s) => (
            <QuestionCard
              key={s.q.id}
              stat={s}
              responses={responses}
              showTopic={true}
              expandedKey={expandedKey}
              onToggle={toggleExpand}
              onPick={setDetailRow}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <ResponseDetailDrawer test={test} row={detailRow} onClose={() => setDetailRow(null)} toast={toast} />
    </div>
  );
}

// ---- Inv status badge ----
function InvStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { completada: "badge-good", enviada: "badge-info", pendiente: "" };
  const labels: Record<string, string> = { completada: "Completada", enviada: "Enviada", pendiente: "Pendiente" };
  return <span className={"badge " + (map[status] || "")}><span className="dot" />{labels[status] || status}</span>;
}

// ---- Invitation status timeline (Creada → Enviada → Abierta → Completada) ----
function InvTimeline({ inv }: { inv: InvitationRow }) {
  const steps: { label: string; done: boolean; at?: string | null }[] = [
    { label: "Creada", done: true },
    { label: "Enviada", done: !!inv.sentAt || inv.status === "enviada" || inv.status === "completada", at: inv.sentAt },
    { label: "Abierta", done: !!inv.openedAt || inv.status === "completada", at: inv.openedAt },
    { label: "Completada", done: inv.status === "completada" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginTop: 8 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && (
            <div style={{ flex: "0 0 24px", height: 2, background: s.done ? "var(--primary)" : "var(--line)", margin: "0 4px", marginTop: 5, borderRadius: 2 }} />
          )}
          <div
            title={s.done ? (s.at ? `${s.label} ${timeAgo(s.at)}` : s.label) : `${s.label} (pendiente)`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: 99, flex: "none",
              background: s.done ? "var(--primary)" : "var(--surface)",
              border: "2px solid " + (s.done ? "var(--primary)" : "var(--line-strong)"),
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: s.done ? "var(--ink-2)" : "var(--ink-4)", whiteSpace: "nowrap" }}>{s.label}</span>
            {s.done && s.at && <span style={{ fontSize: 9.5, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{timeAgo(s.at)}</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
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
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<{ name: string; email: string; company: string }[] | null>(null);
  const [importing, setImporting] = useState(false);

  const invitations: InvitationRow[] = test?.invitations || [];
  const pendingCount = invitations.filter((i) => i.status === "pendiente" && i.email).length;
  const pendingAll = invitations.filter((i) => i.status === "pendiente");

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

  // ---- CSV import ----
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch {
      toast("No se pudo leer el archivo", "alert");
      return;
    }
    const rows = parseCSV(text);
    if (rows.length === 0) {
      toast("El CSV está vacío o no es legible", "alert");
      return;
    }
    // Header detection (name/nombre, email/correo, company/empresa)
    const header = rows[0].map((c) => c.trim().toLowerCase());
    const hName = header.findIndex((h) => ["name", "nombre"].includes(h));
    const hEmail = header.findIndex((h) => ["email", "correo", "e-mail", "mail"].includes(h));
    const hComp = header.findIndex((h) => ["company", "empresa", "compañía", "compania"].includes(h));
    const hasHeader = hName >= 0 || hEmail >= 0 || hComp >= 0;

    let nameIdx: number, emailIdx: number, compIdx: number;
    if (hasHeader) {
      nameIdx = hName; emailIdx = hEmail; compIdx = hComp;
    } else {
      // No header: locate the email column by "@" in the first row, rest = name, company
      const probe = rows[0];
      emailIdx = probe.findIndex((c) => c.includes("@"));
      if (emailIdx < 0) emailIdx = 1;
      const others = probe.map((_, i) => i).filter((i) => i !== emailIdx);
      nameIdx = others[0] ?? -1;
      compIdx = others[1] ?? -1;
    }

    const data = (hasHeader ? rows.slice(1) : rows)
      .map((r) => ({
        name: nameIdx >= 0 ? (r[nameIdx] || "").trim() : "",
        email: emailIdx >= 0 ? (r[emailIdx] || "").trim() : "",
        company: compIdx >= 0 ? (r[compIdx] || "").trim() : "",
      }))
      .filter((r) => r.email.includes("@"));

    if (data.length === 0) {
      toast("No se encontraron emails válidos en el CSV", "alert");
      return;
    }
    setImportRows(data);
  }

  async function runImport() {
    if (!importRows) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const r of importRows) {
      try {
        await addInvitation(testId, { name: r.name, email: r.email, company: r.company, status: "pendiente", sentAt: null });
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false);
    setImportRows(null);
    toast(`${ok} invitación${ok !== 1 ? "es" : ""} importada${ok !== 1 ? "s" : ""}${fail ? `, ${fail} con error` : ""}`, "check2");
  }

  // ---- Copy pending links ----
  async function copyPendingLinks() {
    if (pendingAll.length === 0) {
      toast("No hay invitaciones pendientes", "alert");
      return;
    }
    const lines = pendingAll.map((i) => `${i.name || i.email || "Invitado"}: ${location.origin}/q/${testId}?inv=${i.id}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast(`${pendingAll.length} enlace${pendingAll.length !== 1 ? "s" : ""} copiado${pendingAll.length !== 1 ? "s" : ""}`, "copy");
    } catch {
      toast("No se pudo copiar al portapapeles", "alert");
    }
  }

  // ---- Export CSV ----
  function exportCSV() {
    const header = ["Nombre", "Email", "Empresa", "Estado", "Enviada", "Abierta", "Último recordatorio"];
    const rows: (string | number)[][] = invitations.map((i) => [
      i.name || "",
      i.email || "",
      i.company || "",
      i.status,
      i.sentAt ? new Date(i.sentAt).toLocaleString("es") : "",
      i.openedAt ? new Date(i.openedAt).toLocaleString("es") : "",
      i.lastReminderAt ? new Date(i.lastReminderAt).toLocaleString("es") : "",
    ]);
    downloadCSV(`invitaciones_${slugify(test?.name || testId)}.csv`, [header, ...rows]);
    toast(`CSV exportado (${invitations.length} invitación${invitations.length !== 1 ? "es" : ""})`, "download");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Add form */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Agregar invitación</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} title="Importar invitaciones desde un archivo CSV (columnas: nombre, email, empresa)">
            <Icon name="upload" size={13} /> Importar CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleFile} />
        </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {invitations.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={exportCSV} title="Exportar invitaciones a CSV">
                <Icon name="download" size={13} /> CSV
              </button>
            )}
            {pendingAll.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyPendingLinks} title="Copiar un enlace por invitación pendiente">
                <Icon name="link" size={13} /> Copiar enlaces pendientes
              </button>
            )}
            {pendingCount > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleBulkSend} disabled={bulkSending}>
                <Icon name="send" size={13} /> {bulkSending ? "Enviando…" : `Enviar ${pendingCount} pendiente${pendingCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
        {invitations.length === 0 ? (
          <EmptyState icon="send" title="Sin invitaciones" sub="Agrega emails arriba o importa un CSV para enviar invitaciones directas." />
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {invitations.map((inv, i) => (
              <div key={inv.id} style={{ padding: "12px 18px", borderBottom: i < invitations.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
                  <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => setConfirmDelId(inv.id)} style={{ padding: 5, width: 28, height: 28 }} title="Eliminar">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {/* Status timeline */}
                <div style={{ paddingLeft: 46, overflowX: "auto" }}>
                  <InvTimeline inv={inv} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import preview modal */}
      <Modal
        open={!!importRows}
        onClose={() => { if (!importing) setImportRows(null); }}
        width={460}
        title="Importar invitaciones"
        sub={importRows ? `Se encontraron ${importRows.length} invitación${importRows.length !== 1 ? "es" : ""} con email válido.` : undefined}
      >
        <div style={{ padding: "14px 24px 22px" }}>
          {importRows && (
            <>
              <div className="card" style={{ maxHeight: 220, overflow: "auto", marginBottom: 16 }}>
                {importRows.slice(0, 8).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < Math.min(importRows.length, 8) - 1 ? "1px solid var(--line)" : "none", fontSize: 13 }}>
                    <Avatar name={r.name || r.email} size={24} />
                    <span style={{ fontWeight: 600 }}>{r.name || "—"}</span>
                    <span style={{ color: "var(--ink-3)" }}>{r.email}</span>
                    {r.company && <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 12 }}>{r.company}</span>}
                  </div>
                ))}
                {importRows.length > 8 && (
                  <div style={{ padding: "8px 12px", fontSize: 12.5, color: "var(--ink-3)" }}>… y {importRows.length - 8} más</div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={importing} onClick={() => setImportRows(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={importing} onClick={runImport}>
                  <Icon name="upload" size={13} /> {importing ? "Importando…" : `Importar ${importRows.length}`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!confirmDelId}
        onClose={() => setConfirmDelId(null)}
        onConfirm={async () => {
          if (!confirmDelId) return;
          await deleteInvitation(testId, confirmDelId);
          toast("Invitación eliminada", "trash");
          setConfirmDelId(null);
        }}
        title="Eliminar invitación"
        message="¿Eliminar esta invitación? El enlace asociado dejará de funcionar."
      />
    </div>
  );
}

// ---- Loading skeleton ----
function PageSkeleton() {
  return (
    <PageWrap maxWidth="var(--maxw)">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <Skeleton width={34} height={34} radius={9} />
        <div style={{ flex: 1 }}>
          <Skeleton width={90} height={11} style={{ marginBottom: 8 }} />
          <Skeleton width={260} height={22} />
        </div>
        <Skeleton width={130} height={28} radius={99} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={110} height={32} radius={9} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, marginBottom: 20 }}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
      <SkeletonCard lines={6} />
    </PageWrap>
  );
}

// ---- Main responses page ----
export default function ResponsesPage({ testId, nav, toast }: { testId: string; nav: NavFn; toast: ToastFn }) {
  const { tests, responses, modeConfig, loading } = useStore();
  const test = tests.find((t) => t.id === testId);
  const [tab, setTab] = useState<TabId>("resumen");

  const testResponses = useMemo(
    () => responses.filter((r) => r.testId === testId),
    [responses, testId]
  );

  const entityCount = useMemo(() => {
    const s = new Set<string>();
    testResponses.forEach((r) => s.add(r.company || "Sin asignar"));
    return s.size;
  }, [testResponses]);

  // Determine entity tab label from mode
  const entityTabLabel = modeConfig.id === "clientes"
    ? "Empresas"
    : modeConfig.id === "tiendas"
    ? "Tiendas"
    : "Empleados";

  const invitations = test?.invitations || [];
  const pendingInv = invitations.filter((i) => i.status === "pendiente").length;
  const invLabel = pendingInv > 0
    ? `Invitaciones (${pendingInv} pendiente${pendingInv !== 1 ? "s" : ""})`
    : `Invitaciones (${invitations.length})`;

  const tabs: { id: TabId; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "personas", label: `${modeConfig.personPlural} (${testResponses.length})` },
    { id: "entidades", label: `${entityTabLabel} (${entityCount})` },
    { id: "analisis", label: "Análisis" },
    { id: "invitaciones", label: invLabel },
  ];

  if (loading) return <PageSkeleton />;

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
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid var(--line)", overflowX: "auto" }}>
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
              whiteSpace: "nowrap",
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
      {tab === "personas" && <PersonasTab testId={testId} responses={testResponses} toast={toast} />}
      {tab === "entidades" && <EntidadesTab testId={testId} responses={testResponses} groupLabel={entityTabLabel} />}
      {tab === "analisis" && <AnalisisTab testId={testId} responses={testResponses} toast={toast} />}
      {tab === "invitaciones" && <InvitacionesTab testId={testId} toast={toast} />}
    </PageWrap>
  );
}
