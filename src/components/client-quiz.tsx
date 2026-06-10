"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { Test } from "@/lib/schema";
import {
  computeResult,
  shuffleArray,
  isQuestionActive,
  SCORE_HEX,
  SCORE_LABEL,
  scoreBucket,
  tierLabel,
} from "@/lib/scoring";
import { Icon, ScoreRing, ScoreBar, ScoreBadge } from "@/components/ui";
import ResultView from "@/components/result-view";

type Stage = "intro" | "quiz" | "submitting" | "result" | "error";

// ---- In-progress draft persistence (survives reloads / crashes) ----
type Draft = {
  respondent: string; email: string; company: string; role: string;
  answers: Record<string, string>; topicIndex: number; savedAt: number;
};

function draftKey(testId: string) { return `auditoria_quiz_${testId}`; }

function loadDraft(testId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(testId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d !== "object" || !d.answers) return null;
    // Drafts older than 7 days are stale — discard.
    if (!d.savedAt || Date.now() - d.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return d;
  } catch { return null; }
}

function saveDraft(testId: string, d: Omit<Draft, "savedAt">) {
  try { localStorage.setItem(draftKey(testId), JSON.stringify({ ...d, savedAt: Date.now() })); } catch {}
}

function clearDraft(testId: string) {
  try { localStorage.removeItem(draftKey(testId)); } catch {}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ClientQuiz({ test }: { test: Test }) {
  const branding = test.branding;
  const accent = branding?.accent || test.accent || "var(--primary)";
  const coverColor = branding?.coverColor || accent;
  const orgName = branding?.orgName || test.name;
  const thankYou = branding?.thankYou || "¡Gracias por completar la evaluación!";

  const topics = (test.topics as import("@/lib/schema").Topic[]) || [];
  const solutions = (test.solutions as import("@/lib/schema").Solution[]) || [];

  const [stage, setStage] = useState<Stage>("intro");
  const [respondent, setRespondent] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [topicIndex, setTopicIndex] = useState(0);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const hydrated = useRef(false);

  // Look for a saved draft after mount (localStorage is browser-only).
  useEffect(() => {
    setDraft(loadDraft(test.id));
    hydrated.current = true;
  }, [test.id]);

  // Persist progress while answering so a crash or accidental close loses nothing.
  useEffect(() => {
    if (!hydrated.current) return;
    if (stage !== "quiz" && stage !== "intro") return;
    if (Object.keys(answers).length === 0 && !respondent) return;
    saveDraft(test.id, { respondent, email, company, role, answers, topicIndex });
  }, [test.id, stage, respondent, email, company, role, answers, topicIndex]);

  function resumeDraft() {
    if (!draft) return;
    setRespondent(draft.respondent || "");
    setEmail(draft.email || "");
    setCompany(draft.company || "");
    setRole(draft.role || "");
    setAnswers(draft.answers || {});
    setTopicIndex(Math.min(draft.topicIndex || 0, Math.max(0, topics.length - 1)));
    setStage(draft.respondent ? "quiz" : "intro");
    setDraft(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function discardDraft() {
    clearDraft(test.id);
    setDraft(null);
  }

  // Shuffle options once per question when quiz starts — stable for session
  const shuffledOptions = useMemo(() => {
    const map: Record<string, import("@/lib/schema").Option[]> = {};
    topics.forEach((topic) => {
      topic.questions.forEach((q) => {
        map[q.id] = shuffleArray(q.options);
      });
    });
    return map;
  }, [topics]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTopic = topics[topicIndex];
  const activeQuestions = currentTopic
    ? currentTopic.questions.filter((q) => isQuestionActive(q, answers))
    : [];

  const isLastTopic = topicIndex === topics.length - 1;

  function handleAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleNext() {
    if (isLastTopic) {
      handleSubmit();
    } else {
      setTopicIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    if (topicIndex > 0) {
      setTopicIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit() {
    setStage("submitting");
    const payload = JSON.stringify({
      testId: test.id,
      respondent: respondent || null,
      company: company || null,
      email: email || null,
      role: role || null,
      answers,
      submittedAt: new Date().toISOString(),
    });

    // Up to 3 attempts with backoff — transient network blips shouldn't cost
    // the respondent their whole session. Answers stay in state (and in
    // localStorage) so the error screen's retry re-sends the same payload.
    const delays = [0, 800, 2500];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      try {
        const res = await fetch("/api/responses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
        if (!res.ok) {
          // 4xx won't improve on retry (e.g. test unpublished) — fail fast.
          if (res.status < 500) break;
          continue;
        }
        const data = await res.json();
        clearDraft(test.id);
        setResponseId(data.id);
        setStage("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      } catch {
        // network error — retry
      }
    }
    setStage("error");
  }

  function handleRestart() {
    clearDraft(test.id);
    setAnswers({});
    setTopicIndex(0);
    setRespondent("");
    setEmail("");
    setCompany("");
    setRole("");
    setResponseId(null);
    setStage("intro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- CSS custom property root style ----
  const rootStyle: React.CSSProperties = {
    "--brand": accent,
  } as React.CSSProperties;

  // ---- Intro screen ----
  if (stage === "intro") {
    return (
      <div style={{ ...rootStyle, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Cover hero */}
        <div
          style={{
            background: coverColor,
            padding: "56px 24px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.7)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {orgName}
          </div>
          <h1
            style={{
              fontSize: "clamp(24px, 5vw, 38px)",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-.02em",
              lineHeight: 1.1,
              maxWidth: 560,
            }}
          >
            {test.name}
          </h1>
          {test.description && (
            <p
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,.8)",
                maxWidth: 480,
                lineHeight: 1.6,
                marginTop: 4,
              }}
            >
              {test.description}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 8,
              color: "rgba(255,255,255,.6)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>
              <Icon name="layers" size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              {topics.length} tema{topics.length !== 1 ? "s" : ""}
            </span>
            <span>
              <Icon name="list" size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              {topics.reduce((s, t) => s + t.questions.length, 0)} preguntas
            </span>
          </div>
        </div>

        {/* Form */}
        <div style={{ flex: 1, background: "var(--bg)", display: "flex", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ width: "100%", maxWidth: 480 }}>
            {draft && Object.keys(draft.answers || {}).length > 0 && (
              <div
                className="card"
                style={{ padding: "16px 18px", marginBottom: 24, border: "1.5px solid var(--brand)", display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="refresh" size={18} style={{ color: "var(--brand)", flex: "none" }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    Tienes un avance guardado
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
                  Guardamos {Object.keys(draft.answers).length} respuesta{Object.keys(draft.answers).length !== 1 ? "s" : ""} de una sesión anterior. Puedes continuar donde lo dejaste.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={resumeDraft}
                    style={{ background: "var(--brand)", color: "#fff", border: "none", fontWeight: 700 }}
                  >
                    Continuar donde lo dejé
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>
                    Empezar de nuevo
                  </button>
                </div>
              </div>
            )}
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: "-.015em" }}>
              Antes de empezar
            </h2>
            <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
              Completa tus datos para personalizar la evaluación. Solo el nombre es requerido.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStage("quiz");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label className="field-label">
                  Nombre <span style={{ color: "var(--bad)" }}>*</span>
                </label>
                <input
                  className="input"
                  type="text"
                  value={respondent}
                  onChange={(e) => setRespondent(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="field-label">Empresa</label>
                  <input
                    className="input"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Empresa S.A."
                  />
                </div>
                <div>
                  <label className="field-label">Rol</label>
                  <input
                    className="input"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Tu cargo"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-lg btn-block"
                style={{
                  marginTop: 8,
                  background: "var(--brand)",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,.18)",
                  fontSize: 16,
                  fontWeight: 700,
                }}
                disabled={!respondent.trim()}
              >
                Comenzar
                <Icon name="arrowRight" size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- Error screen ----
  if (stage === "error") {
    return (
      <div
        style={{
          ...rootStyle,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 20,
          background: "var(--bg)",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bad-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="alert" size={26} style={{ color: "var(--bad)" }} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "var(--ink)" }}>
            No se pudo enviar la evaluación
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, maxWidth: 400 }}>
            Hubo un problema al guardar tus respuestas. Verifica tu conexión e intenta de nuevo.
            Tus respuestas no se han perdido.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-lg"
          onClick={handleSubmit}
          style={{ background: "var(--brand)", color: "#fff", border: "none", fontWeight: 700 }}
        >
          <Icon name="refresh" size={17} /> Intentar de nuevo
        </button>
      </div>
    );
  }

  // ---- Submitting screen ----
  if (stage === "submitting") {
    return (
      <div
        style={{
          ...rootStyle,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 20,
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: `4px solid var(--line-2)`,
            borderTopColor: accent,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--ink-3)", fontSize: 15, fontWeight: 600 }}>Enviando respuestas…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ---- Result screen ----
  if (stage === "result") {
    const result = computeResult(topics, solutions, answers);
    return (
      <div style={{ ...rootStyle, minHeight: "100vh", background: "var(--bg)" }}>
        <ResultView
          test={test}
          result={result}
          respondent={respondent}
          company={company}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  // ---- Quiz screen ----
  const progressPct = topics.length > 0 ? ((topicIndex + 1) / topics.length) * 100 : 0;
  const allActiveAnswered = activeQuestions.every((q) => answers[q.id] != null);
  const allActive = topics.flatMap((t) => t.questions.filter((q) => isQuestionActive(q, answers)));
  const answeredCount = allActive.filter((q) => answers[q.id] != null).length;

  return (
    <div style={{ ...rootStyle, minHeight: "100vh", background: "var(--bg)" }}>
      {/* Progress bar header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "var(--sh-sm)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0 8px",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
              Tema {topicIndex + 1} de {topics.length}
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--ink-3)",
                fontWeight: 600,
              }}
            >
              {answeredCount} de {allActive.length} preguntas · {Math.round(progressPct)}%
            </div>
          </div>
          {/* Progress track */}
          <div
            style={{
              height: 4,
              background: "var(--surface-sunken)",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: progressPct + "%",
                height: "100%",
                background: "var(--brand)",
                borderRadius: 99,
                transition: "width .5s cubic-bezier(.2,.7,.3,1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Topic content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 48px" }}>
        {currentTopic && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div
                className="eyebrow"
                style={{ marginBottom: 8, color: "var(--brand)" }}
              >
                Tema {topicIndex + 1}
              </div>
              <h2
                style={{
                  fontSize: "clamp(20px, 4vw, 28px)",
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                  lineHeight: 1.15,
                  color: "var(--ink)",
                }}
              >
                {currentTopic.name}
              </h2>
              {currentTopic.description && (
                <p style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                  {currentTopic.description}
                </p>
              )}
            </div>

            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {currentTopic.questions.map((q, qi) => {
                if (!isQuestionActive(q, answers)) return null;
                const opts = shuffledOptions[q.id] || q.options;
                const selected = answers[q.id];

                return (
                  <div key={q.id} className="card" style={{ padding: "22px 24px" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: selected ? "var(--brand)" : "var(--surface-sunken)",
                          color: selected ? "#fff" : "var(--ink-3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flex: "none",
                          transition: "background .2s, color .2s",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {qi + 1}
                      </div>
                      <p
                        style={{
                          fontSize: 15.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          lineHeight: 1.45,
                          marginTop: 3,
                        }}
                      >
                        {q.text}
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 40 }}>
                      {opts.map((opt) => {
                        const isSelected = selected === opt.id;
                        return (
                          <label
                            key={opt.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 14px",
                              borderRadius: "var(--r-sm)",
                              border: `1.5px solid ${isSelected ? "var(--brand)" : "var(--line-2)"}`,
                              background: isSelected ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "var(--surface)",
                              cursor: "pointer",
                              transition: "border-color .15s, background .15s",
                              userSelect: "none",
                            }}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.id}
                              checked={isSelected}
                              onChange={() => handleAnswer(q.id, opt.id)}
                              style={{ display: "none" }}
                            />
                            {/* Custom radio indicator */}
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? "var(--brand)" : "var(--line-strong)"}`,
                                background: isSelected ? "var(--brand)" : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flex: "none",
                                transition: "border-color .15s, background .15s",
                              }}
                            >
                              {isSelected && (
                                <div
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: "#fff",
                                  }}
                                />
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 14.5,
                                fontWeight: isSelected ? 600 : 500,
                                color: isSelected ? "var(--ink)" : "var(--ink-2)",
                                lineHeight: 1.4,
                                flex: 1,
                              }}
                            >
                              {opt.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 36,
                gap: 12,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                disabled={topicIndex === 0}
                style={{ opacity: topicIndex === 0 ? 0 : 1, pointerEvents: topicIndex === 0 ? "none" : "auto" }}
              >
                <Icon name="arrowLeft" size={16} />
                Anterior
              </button>

              <button
                type="button"
                className="btn btn-lg"
                onClick={handleNext}
                disabled={!allActiveAnswered}
                style={{
                  background: allActiveAnswered ? "var(--brand)" : "var(--surface-sunken)",
                  color: allActiveAnswered ? "#fff" : "var(--ink-4)",
                  border: "none",
                  boxShadow: allActiveAnswered ? "0 4px 14px rgba(0,0,0,.15)" : "none",
                  transition: "background .2s, color .2s, box-shadow .2s",
                }}
              >
                {isLastTopic ? (
                  <>
                    Enviar
                    <Icon name="send" size={17} />
                  </>
                ) : (
                  <>
                    Siguiente
                    <Icon name="arrowRight" size={17} />
                  </>
                )}
              </button>
            </div>

            {!allActiveAnswered && activeQuestions.length > 0 && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--ink-4)",
                }}
              >
                Responde todas las preguntas para continuar
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
