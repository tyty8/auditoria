"use client";
import React, { useMemo } from "react";
import { useStore } from "@/components/store";
import { Icon, ScoreRing, ScoreBar, ScoreBadge, Avatar, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, scoreBucket, SCORE_HEX, tierLabel } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;

export default function ClientesPage({ nav }: { nav: NavFn }) {
  const { tests, responses, modeConfig } = useStore();

  const groups = useMemo(() => {
    const map: Record<string, { name: string; responseIds: string[] }> = {};
    responses.forEach((r) => {
      const key = r.company || "Sin asignar";
      if (!map[key]) map[key] = { name: key, responseIds: [] };
      map[key].responseIds.push(r.id);
    });

    return Object.values(map).map((g) => {
      const rows = responses.filter((r) => g.responseIds.includes(r.id));
      let scoreSum = 0;
      let scoredCount = 0;
      rows.forEach((r) => {
        const test = tests.find((t) => t.id === r.testId);
        if (!test) return;
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        scoreSum += result.overall;
        scoredCount++;
      });
      const avg = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;
      return { name: g.name, count: rows.length, avg };
    }).sort((a, b) => a.avg - b.avg);
  }, [tests, responses]);

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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g, i) => {
            const bucket = scoreBucket(g.avg);
            const color = SCORE_HEX[bucket];
            return (
              <div
                key={g.name}
                className="card"
                onClick={() => nav("cliente", { company: g.name })}
                style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer", transition: "box-shadow .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--sh-pop)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
              >
                <div style={{ flex: "none", position: "relative" }}>
                  <ScoreRing value={g.avg} size={72} stroke={7} animate={false} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {g.name}
                    </span>
                    <span className={"badge badge-" + bucket} style={{ fontSize: 11, flex: "none" }}>{tierLabel(g.avg)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 8 }}>
                    {g.count} evaluaci{g.count === 1 ? "ón" : "ones"}
                  </div>
                  <ScoreBar value={g.avg} height={6} />
                </div>
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
                    #{i + 1}
                  </span>
                  <Icon name="chevronRight" size={16} style={{ color: "var(--ink-3)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageWrap>
  );
}
