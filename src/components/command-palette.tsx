"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useStore } from "./store";
import { Icon, Modal } from "./ui";

type NavFn = (name: string, params?: Record<string, string>) => void;

type PaletteItem = {
  id: string;
  label: string;
  sub?: string;
  icon: string;
  group: string;
  keywords?: string;
  run: () => void;
};

export const OPEN_PALETTE_EVENT = "auditoria:open-palette";

// ---- Global command palette (Ctrl/Cmd+K) ----
export function CommandPalette({ nav }: { nav: NavFn }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const go = useCallback((fn: () => void) => { setOpen(false); fn(); }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const cfg = store.modeConfig;
    const pages: PaletteItem[] = [
      { id: "p-inicio", label: "Inicio", icon: "home", group: "Páginas", run: () => nav("inicio") },
      { id: "p-cuestionarios", label: "Cuestionarios", icon: "clipboard", group: "Páginas", run: () => nav("dashboard") },
      { id: "p-clientes", label: cfg.plural, icon: cfg.icon, group: "Páginas", run: () => nav("clientes") },
      { id: "p-tablero", label: "Tablero", icon: "gauge", group: "Páginas", run: () => nav("tablero") },
      ...(store.mode !== "clientes" ? [{ id: "p-soluciones", label: "Soluciones", icon: "spark", group: "Páginas", run: () => nav("soluciones") }] : []),
      ...(store.mode === "clientes" ? [{ id: "p-reportes", label: "Reportes", icon: "doc", group: "Páginas", run: () => nav("reportes") }] : []),
      { id: "p-config", label: "Configuración", icon: "settings", group: "Páginas", run: () => nav("settings") },
    ];
    const tests: PaletteItem[] = store.tests.map((t) => ({
      id: "t-" + t.id,
      label: t.name,
      sub: `${t._responseCount ?? 0} respuestas · ${t.status === "publicado" ? "Publicado" : "Borrador"}`,
      icon: "clipboard",
      group: "Cuestionarios",
      keywords: (t.tags || []).join(" "),
      run: () => nav("builder", { testId: t.id }),
    }));
    const respItems: PaletteItem[] = store.tests.map((t) => ({
      id: "r-" + t.id,
      label: `Respuestas: ${t.name}`,
      icon: "users",
      group: "Respuestas",
      run: () => nav("responses", { testId: t.id }),
    }));
    const companies = Array.from(new Set(store.responses.map((r) => r.company).filter(Boolean))) as string[];
    const companyItems: PaletteItem[] = companies.map((c) => ({
      id: "c-" + c,
      label: c,
      icon: cfg.icon,
      group: cfg.plural,
      run: () => nav("cliente", { company: c }),
    }));
    return [...pages, ...tests, ...respItems, ...companyItems];
  }, [store.tests, store.responses, store.mode, store.modeConfig, nav]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter((it) => (it.label + " " + (it.sub || "") + " " + (it.keywords || "") + " " + it.group).toLowerCase().includes(q))
      .slice(0, 14);
  }, [items, query]);

  useEffect(() => { setActive(0); }, [filtered.length, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && filtered[active]) { e.preventDefault(); go(filtered[active].run); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div onMouseDown={close} className="no-print" style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--overlay)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", animation: "overlayIn .15s ease" }}>
      <div onMouseDown={(e) => e.stopPropagation()} className="card" style={{ width: 580, maxWidth: "92vw", overflow: "hidden", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-pop)", animation: "popIn .18s cubic-bezier(.2,.7,.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Icon name="search" size={17} style={{ color: "var(--ink-3)" }} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Buscar páginas, cuestionarios, clientes…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "var(--ink)" }} />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} style={{ maxHeight: 380, overflow: "auto", padding: 7 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {filtered.map((it, i) => {
            const showGroup = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <React.Fragment key={it.id}>
                {showGroup && <div className="eyebrow" style={{ padding: "9px 10px 5px" }}>{it.group}</div>}
                <button data-idx={i} onClick={() => go(it.run)} onMouseEnter={() => setActive(i)}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "9px 10px", border: "none", borderRadius: "var(--r-sm)", background: i === active ? "var(--surface-sunken)" : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", flex: "none" }}>
                    <Icon name={it.icon} size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clamp-1" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{it.label}</div>
                    {it.sub && <div className="clamp-1" style={{ fontSize: 12, color: "var(--ink-3)" }}>{it.sub}</div>}
                  </div>
                  {i === active && <Icon name="arrowRight" size={14} style={{ color: "var(--ink-4)" }} />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="hide-mobile" style={{ display: "flex", gap: 14, padding: "9px 16px", borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500 }}>
          <span><span className="kbd">↑↓</span> navegar</span>
          <span><span className="kbd">↵</span> abrir</span>
          <span><span className="kbd">esc</span> cerrar</span>
        </div>
      </div>
    </div>
  );
}

// ---- Global keyboard shortcuts (g+letter) + cheat sheet ----
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Búsqueda global" },
  { keys: ["g", "i"], label: "Ir a Inicio" },
  { keys: ["g", "c"], label: "Ir a Cuestionarios" },
  { keys: ["g", "e"], label: "Ir a Clientes / Tiendas / Empleados" },
  { keys: ["g", "t"], label: "Ir a Tablero" },
  { keys: ["g", "s"], label: "Ir a Soluciones" },
  { keys: ["g", "r"], label: "Ir a Reportes" },
  { keys: ["?"], label: "Ver atajos de teclado" },
];

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useGlobalShortcuts(nav: NavFn): [boolean, (v: boolean) => void] {
  const [cheatOpen, setCheatOpen] = useState(false);
  const pendingG = useRef<number>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      if (e.key === "?") { e.preventDefault(); setCheatOpen((o) => !o); return; }
      const now = Date.now();
      if (k === "g") { pendingG.current = now; return; }
      if (now - pendingG.current < 750) {
        pendingG.current = 0;
        const map: Record<string, string> = { i: "inicio", c: "dashboard", e: "clientes", t: "tablero", s: "soluciones", r: "reportes" };
        if (map[k]) { e.preventDefault(); nav(map[k]); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  return [cheatOpen, setCheatOpen];
}

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={420} title="Atajos de teclado">
      <div style={{ padding: "14px 24px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
        {SHORTCUTS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < SHORTCUTS.length - 1 ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{s.label}</span>
            <span style={{ display: "flex", gap: 4 }}>
              {s.keys.map((k, j) => <span key={j} className="kbd" style={{ fontSize: 12, padding: "2px 7px" }}>{k}</span>)}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
