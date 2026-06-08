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
export function ScoreBadge({ value, withLabel = true }: { value: number; withLabel?: boolean }) {
  const b = scoreBucket(value);
  return (
    <span className={"badge badge-" + b}>
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
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(24,33,28,.34)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "overlayIn .18s ease" }}>
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
