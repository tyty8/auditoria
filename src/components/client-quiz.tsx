"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { Test, Topic, Solution, Option, Question } from "@/lib/schema";
import { computeResult, shuffleArray, isQuestionActive } from "@/lib/scoring";
import { Icon } from "@/components/ui";
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

const SINGLE_MODE_KEY = "auditoria_quiz_singlemode";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ClientQuiz({ test, inv }: { test: Test; inv?: string }) {
  const branding = test.branding;
  const accent = branding?.accent || test.accent || "var(--primary)";
  const coverColor = branding?.coverColor || accent;
  const orgName = branding?.orgName || test.name;

  const topics = (test.topics as Topic[]) || [];
  const solutions = (test.solutions as Solution[]) || [];

  const [stage, setStage] = useState<Stage>("intro");
  const [respondent, setRespondent] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [topicIndex, setTopicIndex] = useState(0);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // One-question-at-a-time mode + index of the current question within the topic
  const [singleMode, setSingleMode] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  // Micro-celebration banner shown when a topic is completed
  const [celebration, setCelebration] = useState<{ num: number; total: number } | null>(null);
  // Question card currently pulse-highlighted (blocked "Siguiente")
  const [pulseId, setPulseId] = useState<string | null>(null);
  // Tick that triggers the delayed auto-advance in single-question mode
  const [advanceReq, setAdvanceReq] = useState(0);

  const hydrated = useRef(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const checkedServerKeys = useRef<Set<string>>(new Set());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-draft key: invitation id wins; otherwise the normalized email.
  const serverKey = useMemo(() => {
    if (inv && inv.trim().length >= 3) return inv.trim().toLowerCase();
    const e = email.trim().toLowerCase();
    return e.length >= 3 && e.includes("@") ? e : null;
  }, [inv, email]);

  // Look for a saved local draft + single-mode preference after mount.
  useEffect(() => {
    setDraft(loadDraft(test.id));
    hydrated.current = true;
    try {
      const saved = localStorage.getItem(SINGLE_MODE_KEY);
      if (saved != null) setSingleMode(saved === "1");
      else setSingleMode(window.innerWidth < 640);
    } catch {}
  }, [test.id]);

  // Invitation tracking: stamp openedAt (fire-and-forget, idempotent server-side).
  useEffect(() => {
    if (!inv) return;
    fetch("/api/public/invitation-opened", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: inv }),
    }).catch(() => {});
  }, [inv]);

  // Server-side draft lookup on the intro: lets a respondent resume from
  // another device. Prefers whichever copy (local vs server) is more recent.
  useEffect(() => {
    if (stage !== "intro" || !serverKey) return;
    if (checkedServerKeys.current.has(serverKey)) return;
    const t = setTimeout(async () => {
      checkedServerKeys.current.add(serverKey);
      try {
        const res = await fetch(
          `/api/public/quiz-draft?testId=${encodeURIComponent(test.id)}&key=${encodeURIComponent(serverKey)}`
        );
        if (!res.ok) return;
        const row = await res.json();
        if (!row || !row.answers || Object.keys(row.answers).length === 0) return;
        const savedAt = row.updatedAt ? Date.parse(row.updatedAt) || 0 : 0;
        const person = (row.person || {}) as { name?: string; email?: string; company?: string; role?: string };
        const remote: Draft = {
          respondent: person.name || "",
          email: person.email || "",
          company: person.company || "",
          role: person.role || "",
          answers: row.answers as Record<string, string>,
          topicIndex: topicIndexForAnswers(row.answers as Record<string, string>),
          savedAt,
        };
        // Keep the more recent of local vs server.
        setDraft((local) => (local && local.savedAt >= savedAt ? local : remote));
      } catch {}
    }, inv ? 0 : 800); // debounce while the email field is being typed
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, serverKey, test.id, inv]);

  // Persist progress locally while answering so a crash or close loses nothing.
  useEffect(() => {
    if (!hydrated.current) return;
    if (stage !== "quiz" && stage !== "intro") return;
    if (Object.keys(answers).length === 0 && !respondent) return;
    saveDraft(test.id, { respondent, email, company, role, answers, topicIndex });
  }, [test.id, stage, respondent, email, company, role, answers, topicIndex]);

  // Debounced server-side backup of the in-progress quiz (~1.5s after changes).
  useEffect(() => {
    if (stage !== "quiz" || !serverKey) return;
    if (Object.keys(answers).length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/public/quiz-draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testId: test.id,
          key: serverKey,
          person: { name: respondent, email, company, role },
          answers,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [stage, serverKey, answers, respondent, email, company, role, test.id]);

  // Clear pending timers on unmount.
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
  }, []);

  function topicIndexForAnswers(ans: Record<string, string>): number {
    for (let i = 0; i < topics.length; i++) {
      const qs = topics[i].questions.filter((q) => isQuestionActive(q, ans));
      if (qs.some((q) => ans[q.id] == null)) return i;
    }
    return Math.max(0, topics.length - 1);
  }

  function setSingleModePersist(v: boolean) {
    setSingleMode(v);
    try { localStorage.setItem(SINGLE_MODE_KEY, v ? "1" : "0"); } catch {}
  }

  function deleteServerDraft() {
    if (!serverKey) return;
    fetch("/api/public/quiz-draft", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ testId: test.id, key: serverKey }),
    }).catch(() => {});
  }

  function resumeDraft() {
    if (!draft) return;
    const ti = Math.min(draft.topicIndex || 0, Math.max(0, topics.length - 1));
    setRespondent(draft.respondent || "");
    setEmail(draft.email || "");
    setCompany(draft.company || "");
    setRole(draft.role || "");
    setAnswers(draft.answers || {});
    setTopicIndex(ti);
    // Single mode: land on the first unanswered question of that topic.
    const acts = topics[ti] ? topics[ti].questions.filter((q) => isQuestionActive(q, draft.answers || {})) : [];
    const qi = acts.findIndex((q) => (draft.answers || {})[q.id] == null);
    setQIndex(qi >= 0 ? qi : 0);
    setStage(draft.respondent ? "quiz" : "intro");
    setDraft(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function discardDraft() {
    clearDraft(test.id);
    deleteServerDraft();
    setDraft(null);
  }

  // Shuffle options once per question when quiz starts — stable for session
  const shuffledOptions = useMemo(() => {
    const map: Record<string, Option[]> = {};
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
  const allActive = topics.flatMap((t) => t.questions.filter((q) => isQuestionActive(q, answers)));
  const answeredCount = allActive.filter((q) => answers[q.id] != null).length;
  const allActiveAnswered = activeQuestions.every((q) => answers[q.id] != null);

  const isLastTopic = topicIndex === topics.length - 1;
  const safeQIndex = Math.min(qIndex, Math.max(0, activeQuestions.length - 1));
  const currentQuestion: Question | undefined = activeQuestions[safeQIndex];
  const isFinalQuestion = isLastTopic && safeQIndex >= activeQuestions.length - 1;

  // Keep qIndex in range when conditional questions appear/disappear.
  useEffect(() => {
    const max = Math.max(0, activeQuestions.length - 1);
    if (qIndex > max) setQIndex(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex, activeQuestions.length]);

  function showCelebration(num: number) {
    setCelebration({ num, total: topics.length });
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebration(null), 1200);
  }

  function pulseQuestion(id: string, scroll = true) {
    if (scroll) questionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulseId(null);
    requestAnimationFrame(() => setPulseId(id));
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulseId(null), 2300);
  }

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    if (singleMode) {
      // Auto-advance shortly after selecting (subtle, cancellable).
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setAdvanceReq((n) => n + 1), 350);
    }
  }

  // Runs after the answer above lands in state, so conditional questions are fresh.
  useEffect(() => {
    if (advanceReq === 0 || stage !== "quiz" || !singleMode) return;
    goNextSingle(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceReq]);

  function goNextSingle(auto = false) {
    const acts = currentTopic ? currentTopic.questions.filter((q) => isQuestionActive(q, answers)) : [];
    const idx = Math.min(qIndex, Math.max(0, acts.length - 1));
    if (idx < acts.length - 1) {
      setQIndex(idx + 1);
    } else if (!isLastTopic) {
      showCelebration(topicIndex + 1);
      setTopicIndex(topicIndex + 1);
      setQIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (auto) {
      // Last question of the last topic: never auto-submit — wait for "Enviar".
    }
  }

  function goBackSingle() {
    if (safeQIndex > 0) {
      setQIndex(safeQIndex - 1);
      return;
    }
    if (topicIndex > 0) {
      const prevActs = topics[topicIndex - 1].questions.filter((q) => isQuestionActive(q, answers));
      setTopicIndex(topicIndex - 1);
      setQIndex(Math.max(0, prevActs.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function gotoQuestion(qid: string) {
    const ti = topics.findIndex((t) => t.questions.some((q) => q.id === qid));
    if (ti < 0) return;
    const acts = topics[ti].questions.filter((q) => isQuestionActive(q, answers));
    const qi = acts.findIndex((q) => q.id === qid);
    setTopicIndex(ti);
    setQIndex(Math.max(0, qi));
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => pulseQuestion(qid, false), 350);
  }

  function handleNextSingle() {
    if (!currentQuestion) return;
    if (answers[currentQuestion.id] == null) {
      pulseQuestion(currentQuestion.id, false);
      return;
    }
    if (!isFinalQuestion) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      goNextSingle();
      return;
    }
    // Final question: validate everything before submitting.
    const firstUn = allActive.find((q) => answers[q.id] == null);
    if (firstUn) {
      gotoQuestion(firstUn.id);
      return;
    }
    handleSubmit();
  }

  function handleNextClassic() {
    if (!allActiveAnswered) {
      const firstUn = activeQuestions.find((q) => answers[q.id] == null);
      if (firstUn) pulseQuestion(firstUn.id);
      return;
    }
    if (isLastTopic) {
      handleSubmit();
      return;
    }
    showCelebration(topicIndex + 1);
    setTopicIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    if (topicIndex > 0) {
      setTopicIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Keyboard shortcuts: 1-9 select an option, Enter advances (quiz stage only).
  useEffect(() => {
    if (stage !== "quiz") return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
        if (tag === "INPUT") {
          const type = (t as HTMLInputElement).type;
          if (type !== "radio" && type !== "checkbox") return; // typing in a text field
        }
      }
      if (e.key >= "1" && e.key <= "9") {
        const target = singleMode
          ? currentQuestion
          : activeQuestions.find((q) => answers[q.id] == null) ?? activeQuestions[activeQuestions.length - 1];
        if (!target) return;
        const opts = shuffledOptions[target.id] || target.options;
        const opt = opts[Number(e.key) - 1];
        if (opt) {
          e.preventDefault();
          selectOption(target.id, opt.id);
          if (!singleMode) pulseQuestion(target.id, false);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (singleMode) handleNextSingle();
        else handleNextClassic();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
        deleteServerDraft();
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
    setQIndex(0);
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

  // ---- Shared question card (classic + single modes) ----
  function renderQuestionCard(q: Question, displayNumber: number, animate = false) {
    const opts = shuffledOptions[q.id] || q.options;
    const selected = answers[q.id];
    return (
      <div
        key={q.id}
        ref={(el) => { questionRefs.current[q.id] = el; }}
        className={"card" + (pulseId === q.id ? " pulse-highlight" : "")}
        style={{
          padding: "22px 24px",
          ...(animate ? { animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1) both" } : null),
        }}
      >
        <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ padding: 0, width: "100%", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                aria-hidden="true"
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
                {displayNumber}
              </div>
              <p
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: "var(--ink)",
                  lineHeight: 1.45,
                  marginTop: 3,
                  marginBottom: 0,
                }}
              >
                {q.text}
              </p>
            </div>
          </legend>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 40 }}>
            {opts.map((opt, oi) => {
              const isSelected = selected === opt.id;
              return (
                <label
                  key={opt.id}
                  className="quiz-opt"
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    minHeight: 48,
                    padding: "12px 14px",
                    borderRadius: "var(--r-sm)",
                    border: `1.5px solid ${isSelected ? "var(--brand)" : "var(--line-2)"}`,
                    background: isSelected ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "var(--surface)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {/* Real radio: visually hidden but focusable/announced */}
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.id}
                    checked={isSelected}
                    onChange={() => selectOption(q.id, opt.id)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                      margin: 0,
                      pointerEvents: "none",
                    }}
                  />
                  {/* Custom radio indicator */}
                  <div
                    aria-hidden="true"
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
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
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
                  {oi < 9 && (
                    <kbd
                      className="quiz-kbd"
                      aria-hidden="true"
                      style={{
                        fontSize: 10.5,
                        fontFamily: "var(--font-mono)",
                        color: "var(--ink-4)",
                        border: "1px solid var(--line-2)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        flex: "none",
                        background: "var(--surface)",
                      }}
                    >
                      {oi + 1}
                    </kbd>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    );
  }

  // ---- Intro screen ----
  if (stage === "intro") {
    const totalQ = topics.reduce((s, t) => s + t.questions.length, 0);
    const estMin = Math.max(2, Math.round((totalQ * 25) / 60));
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
          {branding?.logoUrl && (
            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: "8px 14px",
                display: "inline-flex",
                marginBottom: 2,
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
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span>
              <Icon name="layers" size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              {topics.length} tema{topics.length !== 1 ? "s" : ""}
            </span>
            <span>
              <Icon name="list" size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              {totalQ} preguntas
            </span>
            <span>
              <Icon name="clock" size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              ~{estMin} minutos
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={resumeDraft}
                    style={{ background: "var(--brand)", color: "#fff", border: "none", fontWeight: 700 }}
                  >
                    Continuar donde quedaste ({Object.keys(draft.answers).length} respuesta{Object.keys(draft.answers).length !== 1 ? "s" : ""} guardada{Object.keys(draft.answers).length !== 1 ? "s" : ""})
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

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  userSelect: "none",
                  marginTop: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={singleMode}
                  onChange={(e) => setSingleModePersist(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: accent }}
                />
                Ver una pregunta a la vez
              </label>

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
          answers={answers}
          responseId={responseId}
          responseEmail={email.trim() || null}
        />
      </div>
    );
  }

  // ---- Quiz screen ----
  const progressPct = topics.length > 0 ? ((topicIndex + 1) / topics.length) * 100 : 0;
  const globalIdx = currentQuestion ? allActive.findIndex((q) => q.id === currentQuestion.id) + 1 : 0;
  const currentAnswered = currentQuestion ? answers[currentQuestion.id] != null : false;
  const pendingInTopic = activeQuestions.filter((q) => answers[q.id] == null).length;

  return (
    <div style={{ ...rootStyle, minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`
        .quiz-opt { transition: border-color .15s, background .15s, transform .12s ease; }
        .quiz-opt:active { transform: scale(.99); }
        .quiz-opt:has(input:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }
        .quiz-kbd { display: none; }
        @media (min-width: 640px) { .quiz-kbd { display: inline-block; } }
      `}</style>

      {/* Topic-completed micro-celebration */}
      {celebration && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 86,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 60,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "var(--brand)",
              color: "#fff",
              borderRadius: 99,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,.22)",
              animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1) both",
            }}
          >
            ✦ Sección {celebration.num} de {celebration.total} completada
          </div>
        </div>
      )}

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
              padding: "12px 0 6px",
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
          {/* Topic stepper: done = filled, current = pill with name, pending = hollow */}
          <div
            aria-hidden="true"
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, overflow: "hidden" }}
          >
            {topics.map((t, i) =>
              i === topicIndex ? (
                <div
                  key={t.id}
                  title={t.name}
                  style={{
                    padding: "2px 10px",
                    borderRadius: 99,
                    background: "color-mix(in srgb, var(--brand) 12%, transparent)",
                    color: "var(--brand)",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 170,
                    lineHeight: "16px",
                    flex: "none",
                  }}
                >
                  {t.name}
                </div>
              ) : (
                <div
                  key={t.id}
                  title={t.name}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flex: "none",
                    boxSizing: "border-box",
                    background: i < topicIndex ? "var(--brand)" : "transparent",
                    border: i < topicIndex ? "none" : "1.5px solid var(--line-strong)",
                    transition: "background .2s",
                  }}
                />
              )
            )}
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
        {currentTopic && !singleMode && (
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
                return renderQuestionCard(q, qi + 1);
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
                onClick={handleNextClassic}
                aria-disabled={!allActiveAnswered}
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
                Te falta{pendingInTopic !== 1 ? "n" : ""} {pendingInTopic} pregunta{pendingInTopic !== 1 ? "s" : ""} en este tema — pulsa «Siguiente» para ir a la primera pendiente
              </p>
            )}
          </>
        )}

        {/* One-question-at-a-time mode */}
        {currentTopic && singleMode && (
          <>
            <div style={{ marginBottom: safeQIndex === 0 ? 28 : 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8, color: "var(--brand)" }}>
                Tema {topicIndex + 1} · {currentTopic.name}
              </div>
              {safeQIndex === 0 && (
                <>
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
                </>
              )}
            </div>

            {currentQuestion ? (
              <>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, marginBottom: 10 }}
                >
                  Pregunta {globalIdx} de {allActive.length}
                </div>
                {renderQuestionCard(currentQuestion, globalIdx, true)}
              </>
            ) : (
              <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
                Este tema no tiene preguntas activas.
              </p>
            )}

            {/* Single-mode navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 28,
                gap: 12,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goBackSingle}
                disabled={topicIndex === 0 && safeQIndex === 0}
                style={{
                  opacity: topicIndex === 0 && safeQIndex === 0 ? 0 : 1,
                  pointerEvents: topicIndex === 0 && safeQIndex === 0 ? "none" : "auto",
                }}
              >
                <Icon name="arrowLeft" size={16} />
                Atrás
              </button>

              <button
                type="button"
                className="btn btn-lg"
                onClick={handleNextSingle}
                aria-disabled={!currentAnswered}
                style={{
                  background: currentAnswered ? "var(--brand)" : "var(--surface-sunken)",
                  color: currentAnswered ? "#fff" : "var(--ink-4)",
                  border: "none",
                  boxShadow: currentAnswered ? "0 4px 14px rgba(0,0,0,.15)" : "none",
                  transition: "background .2s, color .2s, box-shadow .2s",
                }}
              >
                {isFinalQuestion ? (
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

            {!currentAnswered && currentQuestion && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--ink-4)",
                }}
              >
                Elige una opción para continuar
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
