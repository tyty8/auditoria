"use client";
import React from "react";
import type { Test } from "@/lib/schema";
import type { ComputedResult } from "@/lib/scoring";
import { SCORE_HEX, SCORE_LABEL, scoreBucket, tierLabel } from "@/lib/scoring";
import { Icon, ScoreRing, ScoreBar, ScoreBadge } from "@/components/ui";

type Props = {
  test: Test;
  result: ComputedResult;
  respondent?: string | null;
  company?: string | null;
  onRestart?: () => void;
};

export default function ResultView({ test, result, respondent, company, onRestart }: Props) {
  const branding = test.branding;
  const accent = branding?.accent || test.accent || "var(--primary)";
  const thankYou = branding?.thankYou || "¡Gracias por completar la evaluación!";
  const orgName = branding?.orgName || test.name;

  const rootStyle: React.CSSProperties = {
    "--brand": accent,
  } as React.CSSProperties;

  const overallBucketColor = SCORE_HEX[result.overallBucket];
  const overallTier = tierLabel(result.overall);

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
        <div
          className="eyebrow"
          style={{ marginBottom: 8, color: "var(--brand)" }}
        >
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
          marginBottom: 28,
          animation: "fadeUp .45s .06s cubic-bezier(.2,.7,.3,1) both",
          textAlign: "center",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 4 }}>Calificación global</div>
        <ScoreRing value={result.overall} size={160} />
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
              const bColor = SCORE_HEX[tr.bucket];
              const methodLabel = tr.scoring === "weighted" ? "Ponderado" : "Porcentaje de correctas";
              return (
                <div
                  key={tr.topicId}
                  className="card"
                  style={{ padding: "16px 20px" }}
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
                      <div
                        className="eyebrow"
                        style={{ color: "var(--ink-4)", fontSize: 10.5 }}
                      >
                        {methodLabel}
                      </div>
                    </div>
                    <ScoreBadge value={tr.grade} />
                  </div>
                  <ScoreBar value={tr.grade} height={7} />
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
            {result.triggered.map((sol) => (
              <div
                key={sol.id}
                className="card"
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
            ))}
          </div>
        </div>
      )}

      {/* Restart / actions */}
      {onRestart && (
        <div
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
