"use client";
import React, { useMemo } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreBadge, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

export default function ReportesPage({ nav }: { nav: NavFn }) {
  const { tests, responses, modeConfig } = useStore();

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
    }).sort((a, b) => a.avg - b.avg);
  }, [tests, responses]);

  return (
    <PageWrap>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Reportes de clientes</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Genera y descarga reportes profesionales por cliente.
        </p>
      </div>

      {entities.length === 0 ? (
        <EmptyState icon="doc" title="Sin reportes disponibles" sub="Las evaluaciones con empresa asignada generarán reportes aquí." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entities.map((e) => {
            const bucket = scoreBucket(e.avg);
            return (
              <div key={e.name} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
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
                <ScoreBadge value={e.avg} />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => nav("reporte", { company: e.name })}
                >
                  <Icon name="doc" size={14} /> Ver reporte
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PageWrap>
  );
}
