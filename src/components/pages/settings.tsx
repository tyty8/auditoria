"use client";
import React, { useState } from "react";
import { PageWrap, Icon } from "@/components/ui";
import { MODE_CONFIG } from "@/lib/modes";
import type { ModeId } from "@/lib/modes";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

const MODES = Object.values(MODE_CONFIG) as (typeof MODE_CONFIG[ModeId])[];

const MODE_SEED_COUNTS: Record<string, { tests: number; responses: number }> = {
  clientes: { tests: 4, responses: 6 },
  tiendas:  { tests: 4, responses: 10 },
  empleados: { tests: 4, responses: 11 },
};

export default function SettingsPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const [seeding, setSeeding] = useState<string | null>(null);

  async function reseed(mode: ModeId | "all") {
    const label =
      mode === "all" ? "todos los modos de demostración" : `el modo «${MODE_CONFIG[mode as ModeId].label}»`;
    if (!confirm(`¿Restaurar ${label}?\n\nEsta acción borrará todos los datos actuales y los reemplazará con los datos de demostración. La acción es irreversible.`)) return;

    setSeeding(mode);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al restaurar");
      }
      toast(
        mode === "all" ? "Todos los modos restaurados" : `Datos de «${MODE_CONFIG[mode as ModeId].label}» restaurados`,
        "check2"
      );
      // Reload so the store picks up fresh data
      setTimeout(() => window.location.reload(), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast(msg, "alert");
    } finally {
      setSeeding(null);
    }
  }

  const busy = seeding !== null;

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Administración</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Configuración</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Herramientas de administración y gestión de datos de la plataforma.
        </p>
      </div>

      {/* Demo data section */}
      <section style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Datos de demostración</h2>
          <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
            Restaura uno o todos los modos al estado inicial con cuestionarios, respuestas e invitaciones de muestra.
            Ideal para reiniciar la demo después de que los usuarios hayan modificado o borrado datos.
          </p>
        </div>

        {/* Warning */}
        <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "#fef9ec", border: "1px solid #f5d97a", borderRadius: 10, marginBottom: 22 }}>
          <Icon name="alert" size={16} style={{ color: "#b07d18", flex: "none", marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "#7a5a0a", margin: 0, lineHeight: 1.5 }}>
            <strong>Acción irreversible.</strong> Al restaurar un modo se eliminan permanentemente todos los cuestionarios,
            respuestas, invitaciones y notas del modo seleccionado. Los datos de otros modos no se ven afectados
            (a menos que elijas «Restaurar todo»).
          </p>
        </div>

        {/* Per-mode cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
          {MODES.map((m) => {
            const counts = MODE_SEED_COUNTS[m.id] || { tests: 0, responses: 0 };
            const isLoading = seeding === m.id;
            return (
              <div key={m.id} className="card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flex: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--primary-soft)", color: "var(--primary)",
                  }}>
                    <Icon name={m.icon} size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{m.menuTitle}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{m.label}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--ink-2)" }}>{counts.tests}</span> tests
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--ink-2)" }}>{counts.responses}</span> respuestas
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-block btn-sm"
                  onClick={() => reseed(m.id as ModeId)}
                  disabled={busy}
                  style={{ gap: 7 }}
                >
                  <Icon
                    name="refresh"
                    size={14}
                    style={isLoading ? { animation: "spin 1s linear infinite" } : {}}
                  />
                  {isLoading ? "Restaurando…" : "Restaurar"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Restore all */}
        <div className="card" style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Restaurar todos los modos</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                Reinicia los tres modos (Clientes, Tiendas, Empleados) con datos frescos de una sola vez.
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => reseed("all")}
              disabled={busy}
              style={{ gap: 8, flex: "none" }}
            >
              <Icon
                name="refresh"
                size={15}
                style={seeding === "all" ? { animation: "spin 1s linear infinite" } : {}}
              />
              {seeding === "all" ? "Restaurando…" : "Restaurar todo"}
            </button>
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageWrap>
  );
}
