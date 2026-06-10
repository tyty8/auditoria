"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreRing, ScoreBar, EmptyState, PageWrap, DeltaBadge, timeAgo, Skeleton, Sparkline } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, SCORE_LABEL, tierLabel } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;

type Bucket = "good" | "warn" | "bad";
type View = "list" | "cards" | "table";
type SortKey = "score" | "name" | "count" | "last" | "delta";
type SortDir = "asc" | "desc";

type Entity = {
  name: string;
  count: number;
  avg: number;
  bucket: Bucket;
  scores: number[]; // chronological
  last: Date | null;
  delta: number | null;
  staleDays: number | null; // days since last response when > 60
};

const VIEW_LS = "auditoria_clientes_view";
const PAGE_SIZE = 30;
const STALE_DAYS = 60;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "score-asc", label: "Peor puntaje" },
  { value: "score-desc", label: "Mejor puntaje" },
  { value: "name-asc", label: "Nombre A-Z" },
  { value: "last-desc", label: "Última evaluación" },
  { value: "count-desc", label: "Más evaluaciones" },
];

const TABLE_COLS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "name", label: "Nombre", defaultDir: "asc" },
  { key: "score", label: "Puntaje", defaultDir: "asc" },
  { key: "count", label: "Evaluaciones", defaultDir: "desc" },
  { key: "last", label: "Última evaluación", defaultDir: "desc" },
  { key: "delta", label: "Tendencia", defaultDir: "desc" },
];

function loadView(): View {
  try {
    const v = localStorage.getItem(VIEW_LS);
    if (v === "list" || v === "cards" || v === "table") return v;
  } catch {}
  return "list";
}

function StaleIcon({ entity }: { entity: Entity }) {
  if (entity.staleDays == null) return null;
  return (
    <span
      title={`Sin evaluar ${timeAgo(entity.last)} (${entity.staleDays} días)`}
      style={{ display: "inline-flex", alignItems: "center", color: "var(--warn)", flex: "none" }}
    >
      <Icon name="clock" size={14} stroke={2} />
    </span>
  );
}

export default function ClientesPage({ nav }: { nav: NavFn }) {
  const { tests, responses, modeConfig, mode, loading } = useStore();

  // ---- controls state ----
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | Bucket>("all");
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [view, setViewState] = useState<View>(loadView);
  const [page, setPage] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_LS, v); } catch {}
  };

  // reset page when any filter/sort changes
  useEffect(() => { setPage(1); }, [query, sortKey, sortDir, statusFilter, groupByStatus, view]);

  // ---- entities (grouped responses + score + trend + staleness) ----
  const groups = useMemo<Entity[]>(() => {
    const map: Record<string, { name: string; responseIds: string[] }> = {};
    responses.forEach((r) => {
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, responseIds: [] };
      map[key].responseIds.push(r.id);
    });

    const now = Date.now();
    return Object.values(map).map((g) => {
      const rows = responses.filter((r) => g.responseIds.includes(r.id));
      // chronological by submittedAt (missing dates first)
      const sortedRows = [...rows].sort((a, b) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return ta - tb;
      });

      const scores: number[] = [];
      sortedRows.forEach((r) => {
        const test = tests.find((t) => t.id === r.testId);
        if (!test) return; // missing/removed test → skip gracefully
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        scores.push(result.overall);
      });

      const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

      // delta: most recent half vs older half (by submittedAt)
      let delta: number | null = null;
      if (scores.length >= 2) {
        const mid = Math.floor(scores.length / 2);
        const older = scores.slice(0, mid);
        const recent = scores.slice(mid);
        const avgOf = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        delta = Math.round(avgOf(recent) - avgOf(older));
      }

      // latest response date + staleness
      let last: Date | null = null;
      rows.forEach((r) => {
        if (!r.submittedAt) return;
        const d = new Date(r.submittedAt);
        if (!isNaN(d.getTime()) && (!last || d.getTime() > last.getTime())) last = d;
      });
      let staleDays: number | null = null;
      if (last) {
        const days = Math.floor((now - (last as Date).getTime()) / 86400000);
        if (days > STALE_DAYS) staleDays = days;
      }

      return { name: g.name, count: rows.length, avg, bucket: scoreBucket(avg), scores, last, delta, staleDays };
    });
  }, [tests, responses]);

  // ---- search ----
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  // ---- status counts (over the searched set) ----
  const counts = useMemo(() => {
    const c = { all: searched.length, good: 0, warn: 0, bad: 0 };
    searched.forEach((g) => { c[g.bucket]++; });
    return c;
  }, [searched]);

  // ---- status filter + sort ----
  const sorted = useMemo(() => {
    const list = statusFilter === "all" ? [...searched] : searched.filter((g) => g.bucket === statusFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "score": cmp = a.avg - b.avg; break;
        case "name": cmp = a.name.localeCompare(b.name, "es"); break;
        case "count": cmp = a.count - b.count; break;
        case "last": cmp = (a.last ? a.last.getTime() : 0) - (b.last ? b.last.getTime() : 0); break;
        case "delta": cmp = (a.delta ?? -Infinity) - (b.delta ?? -Infinity); break;
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, "es");
      return cmp * dir;
    });
    return list;
  }, [searched, statusFilter, sortKey, sortDir]);

  // ---- optional grouping by status (Crítico → Atención → Saludable) ----
  const BUCKET_ORDER: Bucket[] = ["bad", "warn", "good"];
  const ordered = useMemo(() => {
    if (!groupByStatus) return sorted;
    return BUCKET_ORDER.flatMap((b) => sorted.filter((g) => g.bucket === b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, groupByStatus]);

  // ---- pagination ----
  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const startIdx = (cur - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageRows = ordered.slice(startIdx, endIdx).map((g, i) => ({ g, rank: startIdx + i + 1 }));

  const sortValue = `${sortKey}-${sortDir}`;
  const isStandardSort = SORT_OPTIONS.some((o) => o.value === sortValue);

  const onSelectSort = (v: string) => {
    const [k, d] = v.split("-") as [SortKey, SortDir];
    setSortKey(k); setSortDir(d);
  };

  const onHeaderSort = (col: { key: SortKey; defaultDir: SortDir }) => {
    if (sortKey === col.key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(col.key); setSortDir(col.defaultDir); }
  };

  const goDetail = (name: string) => nav("cliente", { company: name });

  // ---- quick actions (hover) ----
  const quickActions = (g: Entity, visible: boolean) => (
    <span
      className="hide-mobile"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: visible ? 1 : 0, transition: "opacity .15s", pointerEvents: visible ? "auto" : "none" }}
    >
      <button
        className="btn btn-ghost btn-icon"
        title="Ver detalle"
        onClick={(e) => { e.stopPropagation(); goDetail(g.name); }}
      >
        <Icon name="eye" size={15} />
      </button>
      {mode === "clientes" && (
        <button
          className="btn btn-ghost btn-icon"
          title="Ver reporte"
          onClick={(e) => { e.stopPropagation(); nav("reporte", { company: g.name }); }}
        >
          <Icon name="doc" size={15} />
        </button>
      )}
    </span>
  );

  // ---- renderers per view ----
  const renderListRows = (rows: { g: Entity; rank: number }[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map(({ g, rank }) => {
        const color = SCORE_HEX[g.bucket];
        const isHover = hovered === g.name;
        return (
          <div
            key={g.name}
            className="card"
            onClick={() => goDetail(g.name)}
            style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer", transition: "box-shadow .15s" }}
            onMouseEnter={(e) => { setHovered(g.name); e.currentTarget.style.boxShadow = "var(--sh-pop)"; }}
            onMouseLeave={(e) => { setHovered((h) => (h === g.name ? null : h)); e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ flex: "none", position: "relative" }}>
              <ScoreRing value={g.avg} size={72} stroke={7} animate={false} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.name}
                </span>
                <span className={"badge badge-" + g.bucket} style={{ fontSize: 11, flex: "none" }}>{tierLabel(g.avg)}</span>
                <DeltaBadge delta={g.delta} size="sm" />
                <StaleIcon entity={g} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 8 }}>
                {g.count} evaluaci{g.count === 1 ? "ón" : "ones"}
                {g.last ? <span> · última {timeAgo(g.last)}</span> : null}
              </div>
              <ScoreBar value={g.avg} height={6} />
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
              {quickActions(g, isHover)}
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
                #{rank}
              </span>
              <Icon name="chevronRight" size={16} style={{ color: "var(--ink-3)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCards = (rows: { g: Entity; rank: number }[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
      {rows.map(({ g }) => {
        const isHover = hovered === g.name;
        return (
          <div
            key={g.name}
            className="card"
            onClick={() => goDetail(g.name)}
            style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, cursor: "pointer", transition: "box-shadow .15s", position: "relative" }}
            onMouseEnter={(e) => { setHovered(g.name); e.currentTarget.style.boxShadow = "var(--sh-pop)"; }}
            onMouseLeave={(e) => { setHovered((h) => (h === g.name ? null : h)); e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ position: "absolute", top: 8, right: 8 }}>{quickActions(g, isHover)}</div>
            {g.staleDays != null && (
              <div style={{ position: "absolute", top: 12, left: 12 }}><StaleIcon entity={g} /></div>
            )}
            <ScoreRing value={g.avg} size={68} stroke={7} animate={false} />
            <div style={{ minWidth: 0, width: "100%" }}>
              <div className="clamp-1" style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>{g.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <span className={"badge badge-" + g.bucket} style={{ fontSize: 11 }}>{tierLabel(g.avg)}</span>
              <DeltaBadge delta={g.delta} size="sm" />
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {g.count} evaluaci{g.count === 1 ? "ón" : "ones"}
            </div>
          </div>
        );
      })}
    </div>
  );

  const thStyle: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", fontSize: 11.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)",
    borderBottom: "1px solid var(--line)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: 13.5, verticalAlign: "middle" };

  const renderTable = (rows: { g: Entity; rank: number }[]) => (
    <div className="card" style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {TABLE_COLS.map((col) => (
              <th key={col.key} style={thStyle} onClick={() => onHeaderSort(col)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ color: "var(--primary)", fontSize: 11 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
            ))}
            <th style={{ ...thStyle, cursor: "default" }} className="hide-mobile"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g }) => {
            const isHover = hovered === g.name;
            return (
              <tr
                key={g.name}
                onClick={() => goDetail(g.name)}
                onMouseEnter={() => setHovered(g.name)}
                onMouseLeave={() => setHovered((h) => (h === g.name ? null : h))}
                style={{ cursor: "pointer", background: isHover ? "var(--surface-sunken)" : "transparent", transition: "background .1s" }}
              >
                <td style={{ ...tdStyle, fontWeight: 700, color: "var(--ink)", maxWidth: 260 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                    <span className="clamp-1">{g.name}</span>
                    <StaleIcon entity={g} />
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 700, color: SCORE_HEX[g.bucket] }}>{g.avg}</span>
                    <span className={"badge badge-" + g.bucket} style={{ fontSize: 10.5 }}>{tierLabel(g.avg)}</span>
                  </span>
                </td>
                <td style={{ ...tdStyle }} className="mono">{g.count}</td>
                <td style={{ ...tdStyle, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{g.last ? timeAgo(g.last) : "—"}</td>
                <td style={tdStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {g.scores.length >= 2 && <Sparkline values={g.scores} width={64} height={20} color={SCORE_HEX[g.bucket]} />}
                    <DeltaBadge delta={g.delta} size="sm" />
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }} className="hide-mobile">
                  {quickActions(g, isHover)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderView = (rows: { g: Entity; rank: number }[]) => {
    if (view === "cards") return renderCards(rows);
    if (view === "table") return renderTable(rows);
    return renderListRows(rows);
  };

  // ---- skeleton loading ----
  if (loading) {
    return (
      <PageWrap>
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>{modeConfig.groupTitle}</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>{modeConfig.clientsDesc}</p>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Skeleton width={260} height={36} />
          <Skeleton width={160} height={36} />
          <Skeleton width={180} height={36} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18 }}>
              <Skeleton width={72} height={72} radius="50%" style={{ flex: "none" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton width="34%" height={15} />
                <Skeleton width="22%" height={11} />
                <Skeleton width="100%" height={6} />
              </div>
            </div>
          ))}
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{modeConfig.groupTitle}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>{modeConfig.clientsDesc}</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={modeConfig.icon}
          title={modeConfig.emptyTitle}
          sub={modeConfig.emptyClients}
        />
      ) : (
        <>
          {/* toolbar: search + sort + view toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, maxWidth: 340 }}>
              <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
              <input
                className="input"
                placeholder={`Buscar ${modeConfig.singular ? modeConfig.singular.toLowerCase() : "nombre"}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 34, width: "100%" }}
              />
            </div>
            <select
              className="select"
              value={sortValue}
              onChange={(e) => onSelectSort(e.target.value)}
              style={{ width: "auto" }}
              title="Ordenar por"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              {!isStandardSort && <option value={sortValue}>Personalizado</option>}
            </select>
            <div className="seg" style={{ marginLeft: "auto" }}>
              <button className={view === "list" ? "on" : ""} onClick={() => setView("list")} title="Lista">
                <Icon name="list" size={14} /><span className="hide-mobile">Lista</span>
              </button>
              <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} title="Tarjetas">
                <Icon name="grid" size={14} /><span className="hide-mobile">Tarjetas</span>
              </button>
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} title="Tabla">
                <Icon name="columns" size={14} /><span className="hide-mobile">Tabla</span>
              </button>
            </div>
          </div>

          {/* status filter chips + group toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {([["all", "Todos"], ["good", SCORE_LABEL.good], ["warn", SCORE_LABEL.warn], ["bad", SCORE_LABEL.bad]] as const).map(([k, label]) => (
              <button
                key={k}
                className={"tagchip" + (statusFilter === k ? " on" : "")}
                onClick={() => setStatusFilter(k as "all" | Bucket)}
              >
                {label} <span className="n">{counts[k as keyof typeof counts]}</span>
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
            <button
              className={"tagchip" + (groupByStatus ? " on" : "")}
              onClick={() => setGroupByStatus((v) => !v)}
              title="Mostrar secciones por estado"
            >
              Agrupar por estado
            </button>
          </div>

          {total === 0 ? (
            <EmptyState
              icon="search"
              title="Sin resultados"
              sub="Ajusta la búsqueda o los filtros para ver resultados."
            />
          ) : (
            <>
              {groupByStatus ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {BUCKET_ORDER.map((b) => {
                    const items = pageRows.filter(({ g }) => g.bucket === b);
                    if (items.length === 0) return null;
                    const bucketTotal = ordered.filter((g) => g.bucket === b).length;
                    return (
                      <section key={b}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: SCORE_HEX[b], flex: "none" }} />
                          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{SCORE_LABEL[b]}</span>
                          <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>({bucketTotal})</span>
                        </div>
                        {renderView(items)}
                      </section>
                    );
                  })}
                </div>
              ) : (
                renderView(pageRows)
              )}

              {/* pagination */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                  {startIdx + 1}–{endIdx} de {total}
                </span>
                {pageCount > 1 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
                      Anterior
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>
                      Siguiente
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </PageWrap>
  );
}
