"use client";
import React, { useEffect, useState } from "react";
import type { Test, Topic } from "@/lib/schema";
import type { ComputedResult } from "@/lib/scoring";
import { SCORE_HEX, SCORE_LABEL, tierLabel, isQuestionActive } from "@/lib/scoring";
import { Icon, ScoreRing, ScoreBar, ScoreBadge, DeltaBadge } from "@/components/ui";

type Props = {
  test: Test;
  result: ComputedResult;
  respondent?: string | null;
  company?: string | null;
  onRestart?: () => void;
  /** Respondent's answers — enables the expandable per-question topic detail. */
  answers?: Record<string, string> | null;
  /** Stored response id — enables "Recibir mis resultados por correo". */
  responseId?: string | null;
  /** Email stored with the response (one-click send when present). */
  responseEmail?: string | null;
  /** Average overall score of all responses (benchmark, when branding.showBenchmark). */
  average?: number | null;
};

// Animated 0 → target count-up (~800ms ease-out). Respects prefers-reduced-motion.
function useCountUp(target: number, duration = 800): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const SOLUTIONS_PREVIEW = 3;

export default function ResultView({
  test,
  result,
  respondent,
  company,
  onRestart,
  answers,
  responseId,
  responseEmail,
  average,
}: Props) {
  const branding = test.branding;
  const accent = branding?.accent || test.accent || "var(--primary)";
  const thankYou = branding?.thankYou || "¡Gracias por completar la evaluación!";
  const orgName = branding?.orgName || test.name;
  const topicsArr = (test.topics as Topic[]) || [];

  const rootStyle: React.CSSProperties = {
    "--brand": accent,
  } as React.CSSProperties;

  const overallBucketColor = SCORE_HEX[result.overallBucket];
  const overallTier = tierLabel(result.overall);
  const animatedOverall = useCountUp(result.overall);

  // ---- Email-my-results state ----
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function sendResultEmail(address?: string) {
    if (!responseId || emailBusy) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/public/result-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseId, email: address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setEmailError(data.error || "No se pudo enviar el correo. Intenta de nuevo.");
      } else {
        setSentTo(data.to || address || responseEmail || "");
        setEmailOpen(false);
      }
    } catch {
      setEmailError("No se pudo enviar el correo. Verifica tu conexión.");
    } finally {
      setEmailBusy(false);
    }
  }

  // ---- Expandable topic rows ----
  const canExpand = !!answers;
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // ---- Collapsible solutions ----
  const [showAllSols, setShowAllSols] = useState(false);
  const hiddenSolCount = Math.max(0, result.triggered.length - SOLUTIONS_PREVIEW);
  const collapseSols = hiddenSolCount > 0 && !showAllSols;

  const showBenchmark = !!branding?.showBenchmark && average != null;

  return (
    <div style={{ ...rootStyle, maxWidth: 720, margin: "0 auto", padding: "48px 24px 64px" }}>
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 40,
          animation: "fadeUp .4s cubic-bezier(.2,.7,.3,1) both",
        }}
      >
        {branding?.logoUrl && (
          <div
            style={{
              display: "inline-flex",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "8px 14px",
              marginBottom: 14,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt={orgName}
              style={{ maxHeight: 36, maxWidth: 180, objectFit: "contain", display: "block" }}
            />
          </div>
        )}
        <div className="eyebrow" style={{ marginBottom: 8, color: "var(--brand)" }}>
          {orgName}
        </div>
        <h1
          style={{
            fontSize: "clamp(22px, 4vw, 30px)",
            fontWeight: 800,
            letterSpacing: "-.02em",
            color: "var(--ink)",
            marginBottom: 6,
          }}
        >
          {thankYou}
        </h1>
        {(respondent || company) && (
          <p style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 6 }}>
            {respondent && <strong style={{ color: "var(--ink-2)" }}>{respondent}</strong>}
            {respondent && company && " · "}
            {company && <span>{company}</span>}
          </p>
        )}
      </div>

      {/* Overall score card */}
      <div
        className="card"
        style={{
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          marginBottom: 20,
          animation: "fadeUp .45s .06s cubic-bezier(.2,.7,.3,1) both",
          textAlign: "center",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 4 }}>Calificación global</div>
        <ScoreRing value={animatedOverall} size={160} animate={false} />
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: overallBucketColor,
              letterSpacing: "-.015em",
            }}
          >
            {overallTier}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--ink-3)",
              marginTop: 4,
            }}
          >
            {SCORE_LABEL[result.overallBucket]}
          </div>
        </div>
      </div>

      {/* Actions: PDF + email (never printed) */}
      <div
        className="no-print"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          marginBottom: 28,
          animation: "fadeUp .45s .09s cubic-bezier(.2,.7,.3,1) both",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="download" size={15} />
            Descargar PDF
          </button>
          {responseId && !sentTo && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={emailBusy}
              onClick={() => {
                if (responseEmail) sendResultEmail();
                else {
                  setEmailError(null);
                  setEmailOpen((v) => !v);
                }
              }}
            >
              <Icon name="mail" size={15} />
              {emailBusy ? "Enviando…" : "Recibir mis resultados por correo"}
            </button>
          )}
        </div>

        {emailOpen && !sentTo && !responseEmail && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emailInput.trim()) sendResultEmail(emailInput.trim());
            }}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <input
              className="input"
              type="email"
              required
              autoFocus
              placeholder="tu@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              style={{ width: 240 }}
            />
            <button
              type="submit"
              className="btn"
              disabled={emailBusy}
              style={{ background: "var(--brand)", color: "#fff", border: "none", fontWeight: 700 }}
            >
              <Icon name="send" size={14} />
              Enviar
            </button>
          </form>
        )}

        {sentTo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--good)",
            }}
          >
            <Icon name="check" size={15} />
            Enviado a {sentTo}
          </div>
        )}
        {emailError && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)" }}>{emailError}</div>
        )}
      </div>

      {/* Benchmark vs average */}
      {showBenchmark && (
        <div
          className="card"
          style={{
            padding: "18px 22px",
            marginBottom: 28,
            animation: "fadeUp .45s .1s cubic-bezier(.2,.7,.3,1) both",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>Comparativa</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              fontSize: 14,
              color: "var(--ink-2)",
            }}
          >
            <span>
              Tu puntaje: <strong className="mono" style={{ color: "var(--ink)" }}>{result.overall}</strong>
            </span>
            <span style={{ color: "var(--ink-4)" }}>·</span>
            <span>
              Promedio general: <strong className="mono" style={{ color: "var(--ink)" }}>{average}</strong>
            </span>
            <DeltaBadge delta={result.overall - (average as number)} suffix=" pts" />
          </div>
          <div style={{ position: "relative" }}>
            <ScoreBar value={result.overall} height={8} />
            {/* Tick marking the average */}
            <div
              title={`Promedio general: ${average}`}
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                left: `calc(${Math.min(100, Math.max(0, average as number))}% - 1px)`,
                width: 2,
                background: "var(--ink-2)",
                borderRadius: 2,
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8, marginBottom: 0 }}>
            La marca vertical indica el promedio de todos los participantes.
          </p>
        </div>
      )}

      {/* Per-topic breakdown */}
      {result.topicResults.length > 0 && (
        <div
          style={{
            marginBottom: 32,
            animation: "fadeUp .45s .12s cubic-bezier(.2,.7,.3,1) both",
          }}
        >
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              marginBottom: 14,
              letterSpacing: "-.015em",
            }}
          >
            Resultados por tema
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.topicResults.map((tr) => {
              const methodLabel = tr.scoring === "weighted" ? "Ponderado" : "Porcentaje de correctas";
              const topic = topicsArr.find((t) => t.id === tr.topicId);
              const open = canExpand && expandedTopic === tr.topicId;
              const activeQs =
                canExpand && topic
                  ? topic.questions.filter((q) => isQuestionActive(q, answers as Record<string, string>))
                  : [];
              return (
                <div key={tr.topicId} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() =>
                      canExpand && setExpandedTopic((cur) => (cur === tr.topicId ? null : tr.topicId))
                    }
                    aria-expanded={canExpand ? open : undefined}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "16px 20px",
                      background: "none",
                      border: "none",
                      color: "inherit",
                      font: "inherit",
                      cursor: canExpand ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14.5,
                            color: "var(--ink)",
                            marginBottom: 3,
                          }}
                        >
                          {tr.name}
                        </div>
                        <div className="eyebrow" style={{ color: "var(--ink-4)", fontSize: 10.5 }}>
                          {methodLabel}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ScoreBadge value={tr.grade} />
                        {canExpand && (
                          <Icon
                            name="chevronDown"
                            size={16}
                            className="no-print"
                            style={{
                              color: "var(--ink-4)",
                              transform: open ? "rotate(180deg)" : "none",
                              transition: "transform .2s",
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <ScoreBar value={tr.grade} height={7} />
                  </button>

                  {open && (
                    <div
                      style={{
                        borderTop: "1px solid var(--line)",
                        padding: "6px 20px 12px",
                        background: "var(--surface-sunken)",
                        animation: "fadeUp .25s cubic-bezier(.2,.7,.3,1) both",
                      }}
                    >
                      {activeQs.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--ink-4)", padding: "10px 0", margin: 0 }}>
                          Sin preguntas activas en este tema.
                        </p>
                      )}
                      {activeQs.map((q, qi) => {
                        const selId = (answers as Record<string, string>)[q.id];
                        const chosen = q.options.find((o) => o.id === selId);
                        return (
                          <div
                            key={q.id}
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
                              padding: "10px 0",
                              borderBottom: qi < activeQs.length - 1 ? "1px solid var(--line)" : "none",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "var(--ink-2)",
                                  lineHeight: 1.4,
                                }}
                              >
                                {q.text}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: chosen ? "var(--ink-3)" : "var(--ink-4)",
                                  marginTop: 3,
                                  fontStyle: chosen ? "normal" : "italic",
                                }}
                              >
                                {chosen ? chosen.label : "Sin respuesta"}
                              </div>
                            </div>
                            {chosen &&
                              (tr.scoring === "weighted" ? (
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "var(--ink-2)",
                                    flex: "none",
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {chosen.points} pts
                                </span>
                              ) : (
                                <Icon
                                  name={chosen.correct ? "check" : "x"}
                                  size={16}
                                  stroke={2.2}
                                  style={{
                                    color: chosen.correct ? "var(--good)" : "var(--bad)",
                                    flex: "none",
                                    marginTop: 2,
                                  }}
                                />
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Triggered solutions */}
      {result.triggered.length > 0 && (
        <div
          style={{
            marginBottom: 32,
            animation: "fadeUp .45s .18s cubic-bezier(.2,.7,.3,1) both",
          }}
        >
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              marginBottom: 6,
              letterSpacing: "-.015em",
            }}
          >
            Recomendaciones
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--ink-3)",
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Basadas en tus respuestas, te sugerimos lo siguiente:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {result.triggered.map((sol, si) => {
              // Collapsed extras stay in the DOM as print-only so PDFs are complete.
              const hidden = collapseSols && si >= SOLUTIONS_PREVIEW;
              return (
              <div
                key={sol.id}
                className={"card" + (hidden ? " print-only" : "")}
                style={{ padding: "20px 22px" }}
              >
                {/* Solution header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: sol.description || sol.actions?.length || sol.link ? 14 : 0,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15.5,
                        color: "var(--ink)",
                        marginBottom: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {sol.name}
                    </div>
                    {sol.category && (
                      <span
                        className="badge badge-info"
                        style={{ fontSize: 11.5 }}
                      >
                        <Icon name="tag" size={12} />
                        {sol.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {sol.description && (
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--ink-2)",
                      lineHeight: 1.6,
                      marginBottom: (sol.actions?.length || sol.link) ? 14 : 0,
                    }}
                  >
                    {sol.description}
                  </p>
                )}

                {/* Action steps */}
                {sol.actions && sol.actions.length > 0 && (
                  <div style={{ marginBottom: sol.link ? 14 : 0 }}>
                    <div
                      className="eyebrow"
                      style={{ marginBottom: 8, color: "var(--ink-3)" }}
                    >
                      Pasos de acción
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {sol.actions.map((action, ai) => (
                        <li
                          key={ai}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            fontSize: 14,
                            color: "var(--ink-2)",
                            lineHeight: 1.45,
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "var(--primary-soft)",
                              color: "var(--primary-700)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              flex: "none",
                              marginTop: 1,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {ai + 1}
                          </div>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Link */}
                {sol.link && (
                  <a
                    href={sol.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{
                      background: "var(--brand)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                      display: "inline-flex",
                      marginTop: 4,
                    }}
                  >
                    {sol.link.label}
                    <Icon name="external" size={15} />
                  </a>
                )}
              </div>
              );
            })}
          </div>

          {collapseSols && (
            <div className="no-print" style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAllSols(true)}
              >
                <Icon name="chevronDown" size={15} />
                Ver {hiddenSolCount} recomendaci{hiddenSolCount === 1 ? "ón" : "ones"} más
              </button>
            </div>
          )}
        </div>
      )}

      {/* Next steps CTA */}
      {branding?.ctaLabel && branding?.ctaUrl && (
        <div
          className="card"
          style={{
            padding: "30px 24px",
            textAlign: "center",
            marginBottom: 32,
            borderTop: "3px solid var(--brand)",
            animation: "fadeUp .45s .21s cubic-bezier(.2,.7,.3,1) both",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 6, color: "var(--brand)" }}>
            Siguientes pasos
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
            ¿Quieres llevar tus resultados al siguiente nivel?
          </p>
          <a
            href={branding.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-lg"
            style={{
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              display: "inline-flex",
              boxShadow: "0 4px 14px rgba(0,0,0,.15)",
            }}
          >
            {branding.ctaLabel}
            <Icon name="arrowRight" size={16} />
          </a>
        </div>
      )}

      {/* Restart / actions */}
      {onRestart && (
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 8,
            animation: "fadeUp .45s .24s cubic-bezier(.2,.7,.3,1) both",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRestart}
          >
            <Icon name="refresh" size={15} />
            Volver a empezar
          </button>
        </div>
      )}
    </div>
  );
}
