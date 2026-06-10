"use client";
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "./store";
import { Icon, Avatar, useTheme, timeAgo } from "./ui";
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
const SEEN_KEY = "auditoria_seen_responses_at";

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", consultor: "Consultor", viewer: "Solo lectura" };

export function AdminTopbar({ route, onNav }: { route: RouteName; onNav: (r: string, params?: Record<string, string>) => void }) {
  const store = useStore();
  const cfg = store.modeConfig;
  const [menu, setMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [seenAt, setSeenAt] = useState<number>(0);

  useEffect(() => {
    try { setSeenAt(Number(localStorage.getItem(SEEN_KEY) || 0)); } catch {}
  }, []);

  // ---- notifications: overdue actions + new responses since last visit ----
  const today = new Date().toISOString().slice(0, 10);
  const overdue = useMemo(
    () => store.taskActions.filter((a) => a.status !== "hecho" && a.dueDate && a.dueDate < today),
    [store.taskActions, today]
  );
  const newResponses = useMemo(
    () => store.responses.filter((r) => r.submittedAt && new Date(r.submittedAt).getTime() > seenAt),
    [store.responses, seenAt]
  );
  const notifCount = overdue.length + newResponses.length;

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch {}
  };

  const links: { label: string; target: string; active: boolean }[] = [
    { label: "Inicio", target: "inicio", active: route === "inicio" },
    { label: "Cuestionarios", target: "dashboard", active: route === "dashboard" || route === "builder" || route === "responses" },
    { label: cfg.plural, target: "clientes", active: route === "clientes" || route === "cliente" },
    { label: "Tablero", target: "tablero", active: route === "tablero" },
    ...(store.mode === "empleados" || store.mode === "tiendas" ? [{ label: "Soluciones", target: "soluciones", active: route === "soluciones" }] : []),
    ...(store.mode === "clientes" ? [{ label: "Reportes", target: "reportes", active: route === "reportes" || route === "reporte" }] : []),
  ];

  const navBtn = (l: { label: string; target: string; active: boolean }) => (
    <button key={l.target} className={"btn btn-ghost btn-sm navlink" + (l.active ? " active" : "")} onClick={() => { onNav(l.target); setMobileOpen(false); }}
      style={{ color: l.active ? "var(--ink)" : "var(--ink-3)", fontWeight: 700, background: l.active ? "var(--surface-sunken)" : "transparent" }}>
      {l.label}
    </button>
  );

  const userName = store.me?.name || (store.me?.role === "admin" ? "Admin" : store.me?.sub) || "Admin";

  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--topbar-bg)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", gap: 14 }}>
        {/* mobile hamburger */}
        <button className="btn btn-ghost btn-icon show-mobile" aria-label="Menú" onClick={() => setMobileOpen(true)} style={{ width: 38, height: 38 }}>
          <Icon name="menu" size={19} />
        </button>

        <button onClick={() => onNav("inicio")} style={{ background: "none", border: "none", padding: 0 }}>
          <Brand />
        </button>

        <nav className="hide-mobile" style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {links.map(navBtn)}
        </nav>

        <div style={{ flex: 1 }} />

        {/* global search */}
        <button className="btn btn-secondary btn-sm hide-mobile" style={{ gap: 8, color: "var(--ink-3)", fontWeight: 500 }}
          onClick={() => window.dispatchEvent(new Event("auditoria:open-palette"))}>
          <Icon name="search" size={14} /> Buscar… <span className="kbd">Ctrl K</span>
        </button>
        <button className="btn btn-ghost btn-icon show-mobile" aria-label="Buscar" style={{ width: 38, height: 38 }}
          onClick={() => window.dispatchEvent(new Event("auditoria:open-palette"))}>
          <Icon name="search" size={17} />
        </button>

        {/* dark mode */}
        <button className="btn btn-ghost btn-icon" aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          onClick={toggleTheme} style={{ width: 38, height: 38 }}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>

        {/* notifications */}
        <div style={{ position: "relative" }}>
          <button className="btn btn-ghost btn-icon" aria-label="Notificaciones" onClick={() => setBellOpen(!bellOpen)} style={{ width: 38, height: 38, position: "relative" }}>
            <Icon name="bell" size={17} />
            {notifCount > 0 && (
              <span className="mono" style={{ position: "absolute", top: 3, right: 2, minWidth: 16, height: 16, borderRadius: 99, background: "var(--bad)", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <div onClick={() => setBellOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
              <div className="card" style={{ position: "absolute", right: 0, top: 44, width: 330, padding: 8, boxShadow: "var(--sh-pop)", zIndex: 2, maxHeight: 420, overflow: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px" }}>
                  <span className="eyebrow">Notificaciones</span>
                  {newResponses.length > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={markSeen}>Marcar visto</button>
                  )}
                </div>
                {notifCount === 0 && (
                  <div style={{ padding: "18px 12px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                    Todo al día ✦ sin pendientes
                  </div>
                )}
                {overdue.length > 0 && (
                  <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start", gap: 10, padding: "10px 10px", height: "auto" }}
                    onClick={() => { setBellOpen(false); onNav("soluciones"); }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bad-soft)", color: "var(--bad)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Icon name="alert" size={15} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{overdue.length} {overdue.length === 1 ? "acción vencida" : "acciones vencidas"}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Ver en Soluciones</div>
                    </div>
                  </button>
                )}
                {newResponses.slice(0, 6).map((r) => (
                  <button key={r.id} className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start", gap: 10, padding: "10px 10px", height: "auto" }}
                    onClick={() => { setBellOpen(false); onNav("responses", { testId: r.testId }); }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Icon name="check2" size={15} />
                    </div>
                    <div style={{ textAlign: "left", minWidth: 0 }}>
                      <div className="clamp-1" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Nueva respuesta{r.respondent ? `: ${r.respondent}` : ""}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{timeAgo(r.submittedAt)}</div>
                    </div>
                  </button>
                ))}
                {newResponses.length > 6 && (
                  <div style={{ padding: "6px 12px", fontSize: 12, color: "var(--ink-3)" }}>y {newResponses.length - 6} más…</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* settings / mode menu */}
        <div style={{ position: "relative" }}>
          <button className="btn btn-ghost btn-icon" aria-label="Configuración" onClick={() => setMenu(!menu)} style={{ width: 38, height: 38 }}>
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
              </div>
            </>
          )}
        </div>

        {/* user */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setUserMenu(!userMenu)} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", padding: 2 }}>
            <Avatar name={userName} color="#1f8a5b" />
            <div className="hide-mobile" style={{ textAlign: "left", lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{userName}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>{ROLE_LABEL[store.me?.role || ""] || "Sesión activa"}</div>
            </div>
          </button>
          {userMenu && (
            <>
              <div onClick={() => setUserMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
              <div className="card" style={{ position: "absolute", right: 0, top: 46, width: 220, padding: 8, boxShadow: "var(--sh-pop)", zIndex: 2 }}>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{userName}</div>
                  {store.me?.sub && <div className="clamp-1" style={{ fontSize: 12, color: "var(--ink-3)" }}>{store.me.sub}</div>}
                </div>
                <div className="hr" style={{ margin: "4px 0" }} />
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
      </div>

      {/* mobile nav drawer */}
      {mobileOpen && (
        <div className="show-mobile" onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--overlay)", animation: "overlayIn .15s ease" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 270, background: "var(--surface)", borderRight: "1px solid var(--line)", boxShadow: "var(--sh-pop)", padding: 18, display: "flex", flexDirection: "column", gap: 6, animation: "popIn .2s cubic-bezier(.2,.7,.3,1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Brand size={24} />
              <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={() => setMobileOpen(false)}>
                <Icon name="x" size={17} />
              </button>
            </div>
            {links.map((l) => (
              <button key={l.target} className="btn btn-ghost btn-block" onClick={() => { onNav(l.target); setMobileOpen(false); }}
                style={{ justifyContent: "flex-start", fontWeight: 700, fontSize: 15, padding: "12px 12px", color: l.active ? "var(--primary)" : "var(--ink)", background: l.active ? "var(--primary-soft)" : "transparent" }}>
                {l.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span className="badge" style={{ gap: 6, alignSelf: "flex-start" }}>
              <Icon name={cfg.icon} size={13} /> {cfg.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
