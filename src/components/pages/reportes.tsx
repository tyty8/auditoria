"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreBadge, EmptyState, PageWrap, SkeletonCard, useToast, timeAgo } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;

type SortKey = "recent" | "name" | "worst" | "best";

function pdfFilename(company: string): string {
  return `reporte_${company.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50)}.pdf`;
}

export default function ReportesPage({ nav }: { nav: NavFn }) {
  const { tests, responses, modeConfig, mode, loading } = useStore();
  const [toastNode, toast] = useToast();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Latest report send per company → "Enviado hace X" badge
  const [sends, setSends] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/all/send?mode=${mode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        (data.sends || []).forEach((s: { company: string; sentAt?: string | null }) => {
          if (s.sentAt) map[s.company] = s.sentAt;
        });
        setSends(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mode]);

  const entities = useMemo(() => {
    const map: Record<string, { name: string; responseIds: string[]; lastDate: string }> = {};
    responses.forEach((r) => {
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, responseIds: [], lastDate: "" };
      map[key].responseIds.push(r.id);
      if (r.submittedAt && (!map[key].lastDate || r.submittedAt > map[key].lastDate)) {
        map[key].lastDate = r.submittedAt;
      }
    });

    return Object.values(map).map((e) => {
      const rows = responses.filter((r) => e.responseIds.includes(r.id));
      let sum = 0;
      let count = 0;
      rows.forEach((r) => {
        const test = tests.find((t) => t.id === r.testId);
        if (!test) return;
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        sum += result.overall;
        count++;
      });
      const avg = count > 0 ? Math.round(sum / count) : 0;
      return { name: e.name, avg, lastDate: e.lastDate, count };
    });
  }, [tests, responses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? entities.filter((e) => e.name.toLowerCase().includes(q)) : [...entities];
    switch (sort) {
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
        break;
      case "worst":
        filtered.sort((a, b) => a.avg - b.avg);
        break;
      case "best":
        filtered.sort((a, b) => b.avg - a.avg);
        break;
      default: // recent — última evaluación desc
        filtered.sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
    }
    return filtered;
  }, [entities, query, sort]);

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function downloadSelected() {
    const names = Array.from(selected);
    if (names.length === 0 || progress) return;
    setProgress({ done: 0, total: names.length });
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < names.length; i++) {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(names[i])}/pdf?mode=${mode}`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdfFilename(names[i]);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        ok++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: names.length });
      // Small pause so the browser registers each download separately.
      if (i < names.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    setProgress(null);
    if (failed > 0) toast(`${ok} PDF${ok === 1 ? "" : "s"} descargado${ok === 1 ? "" : "s"} · ${failed} con error`, "alert");
    else toast(`${ok} PDF${ok === 1 ? "" : "s"} descargado${ok === 1 ? "" : "s"}`, "download");
    exitSelectMode();
  }

  return (
    <PageWrap>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Reportes de clientes</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Genera y descarga reportes profesionales por cliente.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <EmptyState icon="doc" title="Sin reportes disponibles" sub="Las evaluaciones con empresa asignada generarán reportes aquí." />
      ) : (
        <>
          {/* Toolbar: search + sort + batch select */}
          <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Icon name="search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
              <input
                className="input"
                placeholder="Buscar cliente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 36 }}
                aria-label="Buscar cliente"
              />
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar reportes" style={{ width: "auto" }}>
              <option value="recent">Última evaluación</option>
              <option value="name">Nombre A-Z</option>
              <option value="worst">Peor puntaje</option>
              <option value="best">Mejor puntaje</option>
            </select>
            <button
              type="button"
              className={"btn btn-sm " + (selectMode ? "btn-secondary" : "btn-ghost")}
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              <Icon name={selectMode ? "minus" : "check2"} size={14} /> {selectMode ? "Cancelar" : "Seleccionar"}
            </button>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="search" title="Sin resultados" sub={`Ningún cliente coincide con "${query}".`} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visible.map((e) => {
                const bucket = scoreBucket(e.avg);
                const isSelected = selected.has(e.name);
                return (
                  <div
                    key={e.name}
                    className="card"
                    onClick={selectMode ? () => toggleSelect(e.name) : undefined}
                    style={{
                      padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                      cursor: selectMode ? "pointer" : undefined,
                      outline: isSelected ? "2px solid var(--primary)" : undefined,
                      outlineOffset: -2,
                    }}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(e.name)}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Seleccionar ${e.name}`}
                        style={{ width: 18, height: 18, accentColor: "var(--primary)", flex: "none", cursor: "pointer" }}
                      />
                    )}
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: SCORE_HEX[bucket] + "18", display: "flex", alignItems: "center", justifyContent: "center", color: SCORE_HEX[bucket], flex: "none" }}>
                      <Icon name="building" size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>{e.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                        {e.count} evaluaci{e.count === 1 ? "ón" : "ones"}
                        {e.lastDate ? ` · ${new Date(e.lastDate).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      </div>
                    </div>
                    {sends[e.name] && (
                      <span className="badge hide-mobile" title={`Reporte enviado por email ${timeAgo(sends[e.name])}`} style={{ gap: 5 }}>
                        <Icon name="mail" size={11} /> Enviado {timeAgo(sends[e.name])}
                      </span>
                    )}
                    <ScoreBadge value={e.avg} />
                    {!selectMode && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => nav("reporte", { company: e.name })}
                      >
                        <Icon name="doc" size={14} /> Ver reporte
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Batch download bar */}
          {selectMode && (
            <div
              className="no-print"
              style={{
                position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 60,
                background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 99,
                boxShadow: "var(--sh-pop)", padding: "9px 12px 9px 18px",
                display: "flex", alignItems: "center", gap: 12, maxWidth: "calc(100vw - 32px)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(new Set(visible.map((e) => e.name)))}
                disabled={!!progress}
              >
                Todos
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={selected.size === 0 || !!progress}
                onClick={downloadSelected}
              >
                <Icon name="download" size={14} />
                {progress
                  ? ` Descargando ${progress.done}/${progress.total}…`
                  : ` Descargar ${selected.size} PDF${selected.size === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </>
      )}
      {toastNode}
    </PageWrap>
  );
}
