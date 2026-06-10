"use client";
import React, { useState, useEffect } from "react";
import { Icon, Modal } from "./ui";

const LS_KEY = "auditoria_tour_done";

const STEPS = [
  {
    icon: "clipboard",
    title: "Crea cuestionarios",
    body: "En Cuestionarios diseñas evaluaciones con temas, preguntas ponderadas y soluciones que se recomiendan automáticamente según el puntaje.",
  },
  {
    icon: "send",
    title: "Distribuye e invita",
    body: "Comparte el enlace público, genera un código QR o envía invitaciones por email con seguimiento de estado: enviada, abierta y completada.",
  },
  {
    icon: "gauge",
    title: "Analiza resultados",
    body: "El Tablero compara todas las entidades con ranking, mapa de calor y tendencias. Cada cliente tiene su detalle con evolución histórica.",
  },
  {
    icon: "spark",
    title: "Actúa y reporta",
    body: "Convierte las soluciones recomendadas en tareas con responsable y fecha, y genera reportes PDF profesionales para tus clientes. Pulsa Ctrl+K para buscar en cualquier momento.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY)) setOpen(true);
    } catch {}
  }, []);

  const finish = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal open={open} onClose={finish} width={460}>
      <div style={{ padding: "30px 30px 26px", textAlign: "center" }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon name={s.icon} size={26} />
        </div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Bienvenido a Auditoría · {step + 1} de {STEPS.length}</div>
        <h3 style={{ fontSize: 21, marginBottom: 10 }}>{s.title}</h3>
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>{s.body}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "22px 0" }}>
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`Paso ${i + 1}`}
              style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 99, border: "none", padding: 0, cursor: "pointer", background: i === step ? "var(--primary)" : "var(--line-strong)", transition: "width .25s cubic-bezier(.2,.7,.3,1), background .2s" }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
          <button className="btn btn-ghost" onClick={finish}>Saltar</button>
          {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Anterior</button>}
          <button className="btn btn-primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Empezar" : "Siguiente"} {!last && <Icon name="arrowRight" size={15} />}
          </button>
        </div>
      </div>
    </Modal>
  );
}
