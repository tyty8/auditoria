"use client";
import React, { useState, useEffect, useCallback } from "react";
import { scoreBucket, SCORE_HEX, SCORE_LABEL } from "@/lib/scoring";

// ---- Icons ----
const ICONS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  check: "M4 12.5l5 5L20 6.5",
  x: "M6 6l12 12M18 6L6 18",
  tag: "M3 7v4.6a2 2 0 00.6 1.4l7.4 7.4a2 2 0 002.8 0l4.6-4.6a2 2 0 000-2.8L11 5.6A2 2 0 009.6 5H5a2 2 0 00-2 2zM7.5 7.5h.01",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  trash: "M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13",
  copy: "M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
  edit: "M4 20h4l10-10a2 2 0 00-3-3L5 17v3zM13.5 6.5l3 3",
  share: "M12 15V3M8 7l4-4 4 4M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6",
  link: "M10 13a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5M14 11a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 100 6 3 3 0 000-6z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  sliders: "M4 8h10M18 8h2M4 16h2M10 16h10M14 5v6M6 13v6",
  users: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM22 19v-1a4 4 0 00-3-3.8M16 4.2a4 4 0 010 7.6",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h0",
  gauge: "M12 13l4-4M21 12a9 9 0 10-18 0M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  clipboard: "M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  dots: "M12 6h.01M12 12h.01M12 18h.01",
  grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  download: "M12 3v12M8 11l4 4 4-4M5 21h14",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01",
  alert: "M12 9v4M12 17h.01M10.3 4.3L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z",
  spark: "M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z",
  back: "M19 12H5M11 18l-6-6 6-6",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 2 2 0 11-3.8 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004.6 13a2 2 0 010-3.8 1.6 1.6 0 00.7-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 2 2 0 013.8 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.7 2.7 2 2 0 010 3.8z",
  doc: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  check2: "M20 6L9 17l-5-5",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  refresh: "M3 12a9 9 0 0115.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.3L3 16M3 21v-5h5",
  home: "M3 11l9-8 9 8M5 9v11a1 1 0 001 1h12a1 1 0 001-1V9",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  building: "M3 21h18M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16M15 21V9h3a1 1 0 011 1v11M8 8h.01M8 12h.01M11 8h.01M11 12h.01M8 16h3",
  store: "M4 9.5L5.2 4.5a1 1 0 01.97-.75h11.66a1 1 0 01.97.75L20 9.5M4 9.5h16M4 9.5v1a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0v-1M5.5 13.5V20a1 1 0 001 1h11a1 1 0 001-1v-6.5M9.5 21v-5h5v5",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1",
  external: "M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  archive: "M3 4h18v4H3zM5 8v12a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4",
  star: "M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2-5.6 3.2 1.3-6.2L3 9.5l6.3-.7L12 3z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  mail: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3.5 6.5l8.5 7 8.5-7",
  filter: "M4 5h16M7 12h10M10 19h4",
  columns: "M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM12 4v16",
  kanban: "M5 4h4v16H5zM10.5 4h4v10h-4zM16 4h4v7h-4z",
  comment: "M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",
  trendUp: "M3 17l6-6 4 4 7-7M14 8h6v6",
  trendDown: "M3 7l6 6 4-4 7 7M14 16h6v-6",
  minus: "M5 12h14",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  history: "M3 3v5h5M3.05 13a9 9 0 102.13-7.36L3 8M12 7v5l4 2",
  printer: "M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6z",
  keyboard: "M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6",
  upload: "M12 15V3M8 7l4-4 4 4M5 21h14",
  flag: "M5 21V4a1 1 0 011-1h12l-3 4 3 4H6",
  play: "M7 4l13 8-13 8V4",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v.01M17 20h.01M20 17v.01M20 20h.01",
  command: "M9 9V6a3 3 0 10-3 3h3zM9 15v3a3 3 0 11-3-3h3zM15 9h3a3 3 0 10-3-3v3zM15 15h3a3 3 0 11-3 3v-3zM9 9h6v6H9z",
};

export function Icon({ name, size = 18, stroke = 1.7, className = "", style = {} }: {
  name: string; size?: number; stroke?: number; className?: string; style?: React.CSSProperties;
}) {
  const d = ICONS[name] || "";
  return (
    <svg className={"ic " + className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// ---- Score Ring ----
export function ScoreRing({ value, size = 132, stroke = 11, label, animate = true }: {
  value: number; size?: number; stroke?: number; label?: string; animate?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const bucket = scoreBucket(value);
  const color = SCORE_HEX[bucket];
  const [mounted, setMounted] = useState(!animate);
  useEffect(() => { const id = setTimeout(() => setMounted(true), 30); return () => clearTimeout(id); }, []);
  const off = mounted ? c - (value / 100) * c : c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.7,.3,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
        <div className="mono" style={{ fontSize: size * .3, fontWeight: 600, color: "var(--ink)", lineHeight: 1, letterSpacing: "-.03em" }}>{value}</div>
        {label && <div className="eyebrow" style={{ marginTop: 4, color }}>{label}</div>}
      </div>
    </div>
  );
}

// ---- Score Bar ----
export function ScoreBar({ value, height = 8, showVal = false }: { value: number; height?: number; showVal?: boolean }) {
  const bucket = scoreBucket(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height, background: "var(--surface-sunken)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: value + "%", height: "100%", background: SCORE_HEX[bucket], borderRadius: 99, transition: "width .6s cubic-bezier(.2,.7,.3,1)" }} />
      </div>
      {showVal && <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: SCORE_HEX[bucket], minWidth: 34, textAlign: "right" }}>{value}</div>}
    </div>
  );
}

// ---- Score Badge ----
// Includes a shape icon per bucket (✓ / ! / ✕) so the state is readable
// without relying on color alone (colorblind-safe).
const BUCKET_ICON: Record<string, string> = { good: "check2", warn: "alert", bad: "x" };
export function ScoreBadge({ value, withLabel = true }: { value: number; withLabel?: boolean }) {
  const b = scoreBucket(value);
  return (
    <span className={"badge badge-" + b}>
      <Icon name={BUCKET_ICON[b]} size={11} stroke={2.6} />
      <span className="mono" style={{ fontWeight: 700 }}>{value}</span>
      {withLabel && <span>{SCORE_LABEL[b]}</span>}
    </span>
  );
}

// ---- Modal ----
export function Modal({ open, onClose, children, width = 520, title, sub }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
  width?: number; title?: string; sub?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--overlay)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "overlayIn .18s ease" }}>
      <div onMouseDown={(e) => e.stopPropagation()} className="card" style={{ width, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "var(--sh-pop)", animation: "popIn .2s cubic-bezier(.2,.7,.3,1)", borderRadius: "var(--r-xl)" }}>
        {(title || sub) && <div style={{ padding: "22px 24px 0" }}>
          {title && <h3 style={{ fontSize: 20 }}>{title}</h3>}
          {sub && <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>{sub}</p>}
        </div>}
        {children}
      </div>
    </div>
  );
}

// ---- Avatar ----
export function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const initials = (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hues = ["#1f8a5b", "#2f6b8f", "#9c6b1f", "#7a4f9c", "#b0563f"];
  const c = color || hues[(name || "").length % hues.length];
  return (
    <div style={{ width: size, height: size, borderRadius: 99, background: c + "1f", color: c, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * .38, flex: "none", letterSpacing: ".01em" }}>
      {initials}
    </div>
  );
}

// ---- EmptyState ----
export function EmptyState({ icon = "doc", title, sub, action }: { icon?: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", marginBottom: 8 }}>
        <Icon name={icon} size={24} />
      </div>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      {sub && <p style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 360 }}>{sub}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

// ---- Toast ----
export function useToast(): [React.ReactNode, (msg: string, icon?: string) => void] {
  const [toast, setToast] = useState<{ msg: string; icon: string; key: number } | null>(null);
  const show = useCallback((msg: string, icon = "check2") => {
    setToast({ msg, icon, key: Math.random() });
    setTimeout(() => setToast(null), 2400);
  }, []);
  const node = toast && (
    <div key={toast.key} style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 120, background: "var(--ink)", color: "#fff", padding: "11px 18px", borderRadius: 99, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 9, boxShadow: "var(--sh-pop)", animation: "fadeUp .25s cubic-bezier(.2,.7,.3,1)" }}>
      <Icon name={toast.icon} size={17} style={{ color: "var(--mint)" }} />
      {toast.msg}
    </div>
  );
  return [node, show];
}

// ---- Stat card ----
export function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        {icon && <div style={{ width: 32, height: 32, borderRadius: 9, background: (color || "var(--primary)") + "18", display: "flex", alignItems: "center", justifyContent: "center", color: color || "var(--primary)" }}>
          <Icon name={icon} size={16} />
        </div>}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.03em", color: "var(--ink)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ---- Page wrapper ----
export function PageWrap({ children, maxWidth = "var(--maxw)" }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <div style={{ maxWidth, margin: "0 auto", padding: "32px 28px" }}>
      {children}
    </div>
  );
}

// ---- Relative time ("hace 2 h") ----
export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return days === 1 ? "hace 1 día" : `hace ${days} días`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return mo === 1 ? "hace 1 mes" : `hace ${mo} meses`;
  const y = Math.floor(mo / 12);
  return y === 1 ? "hace 1 año" : `hace ${y} años`;
}

// ---- Sparkline ----
export function Sparkline({ values, width = 84, height = 26, color = "var(--primary)", strokeWidth = 1.8, fill = true }: {
  values: number[]; width?: number; height?: number; color?: string; strokeWidth?: number; fill?: boolean;
}) {
  if (!values || values.length < 2) {
    return <svg width={width} height={height} aria-hidden="true"><line x1={2} y1={height / 2} x2={width - 2} y2={height / 2} stroke="var(--line-strong)" strokeWidth={1.5} strokeDasharray="3 3" /></svg>;
  }
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
      {fill && <polygon points={area} fill={color} opacity={0.12} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
}

// ---- Delta badge (▲ +4 / ▼ -3 vs previous period) ----
export function DeltaBadge({ delta, suffix = "", size = "md" }: { delta: number | null | undefined; suffix?: string; size?: "sm" | "md" }) {
  const fs = size === "sm" ? 11 : 12.5;
  if (delta == null || delta === 0) {
    return (
      <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: fs, fontWeight: 600, color: "var(--ink-3)" }} title="Sin cambio">
        <Icon name="minus" size={fs - 1} stroke={2.4} /> {delta === 0 ? "0" + suffix : "—"}
      </span>
    );
  }
  const up = delta > 0;
  const color = up ? "var(--good)" : "var(--bad)";
  return (
    <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: fs, fontWeight: 700, color }}>
      <Icon name={up ? "trendUp" : "trendDown"} size={fs} stroke={2.2} />
      {up ? "+" : ""}{delta}{suffix}
    </span>
  );
}

// ---- Skeleton loader ----
export function Skeleton({ width = "100%", height = 14, radius = "var(--r-sm)", style = {} }: {
  width?: number | string; height?: number | string; radius?: string | number; style?: React.CSSProperties;
}) {
  return <div className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, height }}>
      <Skeleton width="42%" height={16} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${88 - i * 16}%`} height={12} />
      ))}
    </div>
  );
}

// ---- Drawer (right slide-in panel) ----
export function Drawer({ open, onClose, children, width = 480, title, sub }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
  width?: number; title?: string; sub?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onMouseDown={onClose} className="no-print" style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--overlay)", backdropFilter: "blur(2px)", animation: "overlayIn .18s ease" }}>
      <div onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, width, maxWidth: "94vw", background: "var(--surface)", borderLeft: "1px solid var(--line)", boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", animation: "drawerIn .24s cubic-bezier(.2,.7,.3,1)" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <h3 style={{ fontSize: 18 }}>{title}</h3>}
            {sub && <p style={{ color: "var(--ink-2)", marginTop: 4, fontSize: 13.5 }}>{sub}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

// ---- Context menu button (⋯) ----
export type MenuItem = { label: string; icon?: string; danger?: boolean; onClick: () => void } | "divider";
export function MenuButton({ items, icon = "dots", size = 34, align = "right", label }: {
  items: MenuItem[]; icon?: string; size?: number; align?: "left" | "right"; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button className="btn btn-ghost btn-icon" aria-label={label || "Más acciones"} title={label || "Más acciones"}
        style={{ width: size, height: size }} onClick={() => setOpen(!open)}>
        <Icon name={icon} size={17} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div className="card" style={{ position: "absolute", [align]: 0, top: size + 6, minWidth: 190, padding: 6, boxShadow: "var(--sh-pop)", zIndex: 51, animation: "popIn .15s cubic-bezier(.2,.7,.3,1)" }}>
            {items.map((it, i) =>
              it === "divider" ? (
                <div key={i} className="hr" style={{ margin: "5px 0" }} />
              ) : (
                <button key={i} className="btn btn-ghost btn-block btn-sm"
                  style={{ justifyContent: "flex-start", gap: 9, padding: "8px 10px", color: it.danger ? "var(--bad)" : undefined }}
                  onClick={() => { setOpen(false); it.onClick(); }}>
                  {it.icon && <Icon name={it.icon} size={15} />}
                  {it.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Confirm modal (named destructive confirmation) ----
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Eliminar", danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message?: React.ReactNode; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} width={420} title={title}>
      <div style={{ padding: "14px 24px 22px" }}>
        {message && <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55 }}>{message}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={danger ? { background: "var(--bad)" } : undefined}
            onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Breadcrumbs ----
export function Breadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevronRight" size={13} style={{ color: "var(--ink-4)" }} />}
            {it.onClick && !last ? (
              <button onClick={it.onClick} style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--ink-3)", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-3)")}>
                {it.label}
              </button>
            ) : (
              <span style={{ color: last ? "var(--ink)" : undefined }}>{it.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ---- Theme (dark mode) ----
export function useTheme(): ["light" | "dark", () => void] {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auditoria_theme");
      if (stored === "dark") setTheme("dark");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("auditoria_theme", next); } catch {}
      return next;
    });
  }, []);
  return [theme, toggle];
}
