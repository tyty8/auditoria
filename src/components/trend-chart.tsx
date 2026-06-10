"use client";
import React from "react";
import { scoreBucket, SCORE_HEX } from "@/lib/scoring";

export type TrendPoint = { label: string; value: number; count?: number };

// Lightweight SVG line chart for score-over-time (0–100 scale). No dependencies.
export function TrendChart({ points, height = 160 }: { points: TrendPoint[]; height?: number }) {
  if (points.length === 0) return null;

  const width = 640;
  const padX = 34, padTop = 16, padBottom = 30;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const x = (i: number) => padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const lineColor = SCORE_HEX[scoreBucket(last.value)];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Evolución del puntaje en el tiempo">
      {/* Reference gridlines at 0 / 60 / 80 / 100 (the bucket thresholds) */}
      {[0, 60, 80, 100].map((v) => (
        <g key={v}>
          <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} stroke="var(--line)" strokeWidth={1} strokeDasharray={v === 0 ? "" : "3 4"} />
          <text x={padX - 8} y={y(v) + 3.5} textAnchor="end" fontSize={10} fontFamily="var(--font-mono)" fill="var(--ink-4)">{v}</text>
        </g>
      ))}

      {/* Line + area */}
      <path
        d={`${path} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`}
        fill={lineColor}
        opacity={0.08}
      />
      <path d={path} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + value labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={4} fill={SCORE_HEX[scoreBucket(p.value)]} stroke="var(--surface)" strokeWidth={2} />
          <text x={x(i)} y={y(p.value) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--font-mono)" fill="var(--ink-2)">
            {p.value}
          </text>
          <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// Small ▲/▼ chip showing the change vs. the previous period.
export function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  const color = up ? "var(--good)" : "var(--bad)";
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        fontSize: 11.5, fontWeight: 700, color,
        padding: "2px 7px", borderRadius: "var(--r-full)",
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title="Cambio vs. periodo anterior"
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}{delta}
    </span>
  );
}

// Buckets responses by month (YYYY-MM) and averages their scores.
export function monthlyAverages(rows: { submittedAt?: string | null; score: number }[]): TrendPoint[] {
  const byMonth: Record<string, number[]> = {};
  rows.forEach((r) => {
    if (!r.submittedAt) return;
    const month = r.submittedAt.slice(0, 7);
    (byMonth[month] ||= []).push(r.score);
  });
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => {
      const [yy, mm] = month.split("-");
      return {
        label: `${MONTHS[Number(mm) - 1] || mm} ${yy.slice(2)}`,
        value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length,
      };
    });
}
