"use client";
import React, { useState } from "react";
import { useStore } from "./store";
import { Icon, Avatar } from "./ui";
import { MODE_CONFIG } from "@/lib/modes";
import type { ModeId } from "@/lib/modes";

export function Brand({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: size, height: size, borderRadius: 7, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "var(--sh-sm)" }}>
        <svg width={size * .62} height={size * .62} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </div>
      <span style={{ fontSize: size * .66, fontWeight: 800, letterSpacing: "-.03em" }}>Auditoría</span>
    </div>
  );
}

type RouteName = string;

export function AdminTopbar({ route, onNav }: { route: RouteName; onNav: (r: string, params?: Record<string, string>) => void }) {
  const store = useStore();
  const cfg = store.modeConfig;
  const [menu, setMenu] = useState(false);

  const navBtn = (label: string, target: string, active: boolean) => (
    <button className="btn btn-ghost btn-sm" onClick={() => onNav(target)}
      style={{ color: active ? "var(--ink)" : "var(--ink-3)", fontWeight: 700, background: active ? "var(--surface-sunken)" : "transparent" }}>
      {label}
    </button>
  );

  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(244,243,238,.82)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px", height: 60, display: "flex", alignItems: "center", gap: 22 }}>
        <button onClick={() => onNav("inicio")} style={{ background: "none", border: "none", padding: 0 }}>
          <Brand />
        </button>
        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {navBtn("Inicio", "inicio", route === "inicio")}
          {navBtn("Cuestionarios", "dashboard", route === "dashboard" || route === "builder" || route === "responses")}
          {navBtn(cfg.plural, "clientes", route === "clientes" || route === "cliente")}
          {navBtn("Tablero", "tablero", route === "tablero")}
          {(store.mode === "empleados" || store.mode === "tiendas") && navBtn("Soluciones", "soluciones", route === "soluciones")}
          {store.mode === "clientes" && navBtn("Reportes", "reportes", route === "reportes" || route === "reporte")}
        </nav>
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ gap: 6 }}>
          <Icon name={cfg.icon} size={13} /> {cfg.label}
        </span>
        <div style={{ position: "relative" }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setMenu(!menu)} style={{ width: 38, height: 38 }}>
            <Icon name="settings" size={18} />
          </button>
          {menu && (
            <>
              <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
              <div className="card" style={{ position: "absolute", right: 0, top: 44, width: 290, padding: 8, boxShadow: "var(--sh-pop)", zIndex: 2 }}>
                <div className="eyebrow" style={{ padding: "6px 8px 8px" }}>Modo de demostración</div>
                {(Object.values(MODE_CONFIG) as typeof MODE_CONFIG[ModeId][]).map((m) => {
                  const on = m.id === store.mode;
                  return (
                    <button key={m.id} className="btn btn-ghost btn-block"
                      style={{ justifyContent: "flex-start", gap: 11, alignItems: "center", padding: "9px 10px", background: on ? "var(--primary-soft)" : "transparent", height: "auto" }}
                      onClick={() => { if (!on) store.setMode(m.id); setMenu(false); onNav("inicio"); }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--primary)" : "var(--surface-sunken)", color: on ? "#fff" : "var(--ink-2)" }}>
                        <Icon name={m.icon} size={17} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{m.menuTitle}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500, whiteSpace: "normal", lineHeight: 1.3 }}>{m.menuSub}</div>
                      </div>
                      {on && <Icon name="check2" size={16} stroke={2.6} style={{ color: "var(--primary)", flex: "none" }} />}
                    </button>
                  );
                })}
                <div className="hr" style={{ margin: "6px 0" }} />
                <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }}
                  onClick={() => { setMenu(false); onNav("settings"); }}>
                  <Icon name="settings" size={16} /> Configuración y datos demo
                </button>
                <div className="hr" style={{ margin: "6px 0" }} />
                <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start", color: "var(--bad)" }}
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}>
                  <Icon name="x" size={16} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
        <Avatar name="Admin" color="#1f8a5b" />
      </div>
    </div>
  );
}
