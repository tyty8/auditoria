"use client";
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useStore } from "@/components/store";
import type { TestSummary, InvitationRow } from "@/components/store";
import { Icon, EmptyState, PageWrap, Modal, Drawer, ConfirmModal, ScoreRing, timeAgo } from "@/components/ui";
import { ShareModal } from "@/components/share-modal";
import { uid } from "@/lib/scoring";
import type { Topic, Question, Option, Solution, Condition, Branding } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type TabId = "temas" | "soluciones" | "distribucion" | "marca";

// ---- Helpers ----
function blankTopic(): Topic {
  return {
    id: uid("t"),
    name: "Nuevo tema",
    scoring: "weighted",
    includeInOverall: true,
    weight: 1,
    description: "",
    questions: [],
  };
}

function blankQuestion(): Question {
  return {
    id: uid("q"),
    text: "Nueva pregunta",
    options: [
      { id: uid("o"), label: "Opción A", points: 0, correct: false },
      { id: uid("o"), label: "Opción B", points: 100, correct: true },
    ],
  };
}

function blankOption(): Option {
  return { id: uid("o"), label: "Nueva opción", points: 0, correct: false };
}

function blankSolution(): Solution {
  return {
    id: uid("sol"),
    name: "Nueva solución",
    description: "",
    category: "",
    logic: "all",
    conditions: [{ scope: "overall", operator: "below", threshold: 70 }],
    link: null,
    actions: [],
  };
}

/** Deep-copy a question with fresh ids. showIf is kept by default (valid when
 *  duplicating within the same topic) or stripped for cross-test imports. */
function copyQuestion(q: Question, keepShowIf: boolean): Question {
  return {
    id: uid("q"),
    text: q.text,
    options: q.options.map((o) => ({ ...o, id: uid("o") })),
    showIf: keepShowIf ? q.showIf || null : null,
  };
}

/** Deep-copy a topic with fresh ids, remapping internal showIf references. */
function copyTopic(t: Topic): Topic {
  const qMap = new Map<string, string>();
  const oMap = new Map<string, string>();
  const questions = t.questions.map((q) => {
    const nq = uid("q");
    qMap.set(q.id, nq);
    return {
      id: nq,
      text: q.text,
      options: q.options.map((o) => {
        const no = uid("o");
        oMap.set(o.id, no);
        return { ...o, id: no };
      }),
      showIf: q.showIf || null,
    };
  });
  // Remap showIf references to the freshly generated ids (drop if external).
  const remapped: Question[] = questions.map((q) => {
    if (!q.showIf || !qMap.has(q.showIf.questionId)) return { ...q, showIf: null };
    return {
      ...q,
      showIf: {
        questionId: qMap.get(q.showIf.questionId)!,
        optionIds: q.showIf.optionIds.map((o) => oMap.get(o) || o),
      },
    };
  });
  return { ...t, id: uid("t"), name: (t.name || "Tema") + " (copia)", questions: remapped };
}

/** Move item at `from` to insertion position `to` (0..arr.length). */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(from < to ? to - 1 : to, 0, item);
  return next;
}

// ---- Drag & drop list item (native HTML5 DnD, grip-armed) ----
function DragItem({ typeKey, index, count, ins, setIns, onReorder, children }: {
  typeKey: string;
  index: number;
  count: number;
  ins: number | null;
  setIns: (n: number | null) => void;
  onReorder: (from: number, to: number) => void;
  children: (grip: React.ReactNode) => React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  const grip = (
    <span
      title="Arrastrar para reordenar"
      onMouseDown={() => {
        setArmed(true);
        const up = () => { setArmed(false); window.removeEventListener("mouseup", up); };
        window.addEventListener("mouseup", up);
      }}
      style={{ cursor: "grab", color: "var(--ink-4)", display: "inline-flex", alignItems: "center", padding: "2px 1px", flex: "none", touchAction: "none" }}
    >
      <Icon name="grip" size={15} />
    </span>
  );

  const bar: React.CSSProperties = { position: "absolute", left: 4, right: 4, height: 3, borderRadius: 2, background: "var(--primary)", zIndex: 6, pointerEvents: "none" };

  return (
    <div
      draggable={armed}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(typeKey, String(index));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => { setArmed(false); setIns(null); }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(typeKey)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const r = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        setIns(index + (after ? 1 : 0));
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(typeKey)) return;
        e.preventDefault();
        e.stopPropagation();
        const from = Number(e.dataTransfer.getData(typeKey));
        const r = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        const to = index + (after ? 1 : 0);
        setIns(null);
        if (!Number.isNaN(from) && from !== to && from !== to - 1) onReorder(from, to);
      }}
      style={{ position: "relative" }}
    >
      {ins === index && <div style={{ ...bar, top: -2 }} />}
      {index === count - 1 && ins === count && <div style={{ ...bar, bottom: -2 }} />}
      {children(grip)}
    </div>
  );
}

// ---- Segmented control ----
function Seg({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Switch toggle ----
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <button className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} type="button" aria-label={label} />
      {label && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>}
    </div>
  );
}

// ---- Inline input ----
function InlineInput({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <input
      className="input-inline"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
    />
  );
}

// ---- Tag chip ----
function TagChip({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 8px 3px 10px", borderRadius: "var(--r-full)", background: "var(--primary-soft)", color: "var(--primary-700)", border: "1px solid var(--primary-soft-2)" }}>
      {tag}
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", display: "flex", alignItems: "center", lineHeight: 1 }}>
        <Icon name="x" size={12} stroke={2.5} />
      </button>
    </span>
  );
}

// ---- Tag editor ----
function TagEditor({ tags, allTags, onChange }: { tags: string[]; allTags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const lower = input.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(lower) && !tags.includes(t)).slice(0, 6);
  }, [input, allTags, tags]);

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setInput("");
  }

  return (
    <div>
      <label className="field-label">Etiquetas</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {tags.map((tag) => (
          <TagChip key={tag} tag={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))} />
        ))}
      </div>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Agregar etiqueta…"
          style={{ fontSize: 13 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
            if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
          }}
        />
        {suggestions.length > 0 && (
          <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, width: "100%", padding: 4, boxShadow: "var(--sh-md)" }}>
            {suggestions.map((s) => (
              <button key={s} type="button"
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 11px", fontSize: 13, fontWeight: 600, borderRadius: "var(--r-xs)", background: "none", border: "none", cursor: "pointer", color: "var(--ink)" }}
                onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Option row ----
function OptionRow({ opt, scoring, onChange, onDelete, onEnter, isOnly, grip, autoFocus }: {
  opt: Option; scoring: string; onChange: (o: Option) => void; onDelete: () => void;
  onEnter: () => void; isOnly: boolean; grip: React.ReactNode; autoFocus: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      {grip}
      {scoring === "percent" && (
        <button type="button"
          style={{ width: 20, height: 20, borderRadius: 99, border: "2px solid " + (opt.correct ? "var(--primary)" : "var(--line-strong)"), background: opt.correct ? "var(--primary)" : "transparent", flex: "none", cursor: "pointer", transition: "all .14s", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => onChange({ ...opt, correct: !opt.correct })}>
          {opt.correct && <Icon name="check2" size={10} stroke={3} style={{ color: "#fff" }} />}
        </button>
      )}
      <input
        className="input"
        value={opt.label}
        autoFocus={autoFocus}
        onFocus={(e) => { if (autoFocus) e.currentTarget.select(); }}
        onChange={(e) => onChange({ ...opt, label: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
        style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
        placeholder="Texto de opción"
        title="Enter agrega una nueva opción"
      />
      {scoring === "weighted" && (
        <input
          type="number"
          className="input"
          value={opt.points}
          onChange={(e) => onChange({ ...opt, points: Number(e.target.value) })}
          style={{ width: 70, fontSize: 13, padding: "6px 10px", textAlign: "right" }}
          placeholder="Pts"
        />
      )}
      <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} disabled={isOnly} title="Eliminar opción" style={{ padding: 5, width: 28, height: 28 }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

// ---- Question card ----
function QuestionCard({ q, topicScoring, onChange, onDelete, onDuplicate, index, grip }: {
  q: Question; topicScoring: string; onChange: (q: Question) => void; onDelete: () => void;
  onDuplicate: () => void; index: number; grip: React.ReactNode;
}) {
  const [optIns, setOptIns] = useState<number | null>(null);
  const [focusOptId, setFocusOptId] = useState<string | null>(null);
  const optKey = "text/x-aud-o-" + q.id.toLowerCase();

  function updateOption(optId: string, patch: Partial<Option>) {
    onChange({ ...q, options: q.options.map((o) => o.id === optId ? { ...o, ...patch } : o) });
  }
  function deleteOption(optId: string) {
    onChange({ ...q, options: q.options.filter((o) => o.id !== optId) });
  }
  function addOption(afterIndex?: number) {
    const o = blankOption();
    const opts = q.options.slice();
    if (afterIndex == null) opts.push(o);
    else opts.splice(afterIndex + 1, 0, o);
    setFocusOptId(o.id);
    onChange({ ...q, options: opts });
  }
  function reorderOptions(from: number, to: number) {
    onChange({ ...q, options: moveItem(q.options, from, to) });
  }

  return (
    <div className="card" data-builder-id={q.id} style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
          {grip}
          <div className="eyebrow" style={{ minWidth: 22, textAlign: "center" }}>{index + 1}</div>
        </div>
        <textarea
          className="textarea"
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          placeholder="Texto de la pregunta"
          style={{ flex: 1, fontSize: 14, minHeight: 54, resize: "vertical" }}
        />
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onDuplicate} title="Duplicar pregunta" style={{ padding: 5, width: 28, height: 28 }}>
          <Icon name="copy" size={14} />
        </button>
        <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} title="Eliminar pregunta" style={{ padding: 5, width: 28, height: 28 }}>
          <Icon name="trash" size={14} />
        </button>
      </div>
      <div style={{ marginLeft: 32 }}>
        {topicScoring === "weighted" && (
          <div style={{ display: "flex", gap: 8, paddingBottom: 6, marginBottom: 4 }}>
            <div style={{ width: 17 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase" }}>Opción</div>
            <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase", textAlign: "right" }}>Puntos</div>
            <div style={{ width: 28 }} />
          </div>
        )}
        {topicScoring === "percent" && (
          <div style={{ display: "flex", gap: 8, paddingBottom: 6, marginBottom: 4 }}>
            <div style={{ width: 17 }} />
            <div style={{ width: 20 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase" }}>Opción</div>
            <div style={{ width: 28 }} />
          </div>
        )}
        {q.options.map((opt, oi) => (
          <DragItem key={opt.id} typeKey={optKey} index={oi} count={q.options.length} ins={optIns} setIns={setOptIns} onReorder={reorderOptions}>
            {(optGrip) => (
              <OptionRow
                opt={opt}
                scoring={topicScoring}
                grip={optGrip}
                autoFocus={focusOptId === opt.id}
                onChange={(o) => updateOption(opt.id, o)}
                onDelete={() => deleteOption(opt.id)}
                onEnter={() => addOption(oi)}
                isOnly={q.options.length <= 1}
              />
            )}
          </DragItem>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addOption()} style={{ marginTop: 8, fontSize: 12 }}>
          <Icon name="plus" size={13} /> Agregar opción
        </button>
      </div>
    </div>
  );
}

// ---- Topic card ----
function TopicCard({ topic, onChange, onDelete, onDuplicate, collapsed, onToggle, onActive, grip }: {
  topic: Topic; onChange: (t: Topic) => void; onDelete: () => void; onDuplicate: () => void;
  collapsed: boolean; onToggle: () => void; onActive: () => void; grip: React.ReactNode;
}) {
  const [qIns, setQIns] = useState<number | null>(null);
  const qKey = "text/x-aud-q-" + topic.id.toLowerCase();

  function updateQuestion(qId: string, q: Question) {
    onChange({ ...topic, questions: topic.questions.map((x) => x.id === qId ? q : x) });
  }
  function deleteQuestion(qId: string) {
    onChange({ ...topic, questions: topic.questions.filter((x) => x.id !== qId) });
  }
  function addQuestion() {
    onChange({ ...topic, questions: [...topic.questions, blankQuestion()] });
  }
  function duplicateQuestion(i: number) {
    const copy = copyQuestion(topic.questions[i], true);
    const next = topic.questions.slice();
    next.splice(i + 1, 0, copy);
    onChange({ ...topic, questions: next });
  }
  function reorderQuestions(from: number, to: number) {
    onChange({ ...topic, questions: moveItem(topic.questions, from, to) });
  }

  const qCount = topic.questions.length;

  if (collapsed) {
    return (
      <div className="card" data-builder-id={topic.id} onClick={onActive} style={{ marginBottom: 18, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        {grip}
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onToggle} title="Expandir tema" style={{ padding: 4, width: 26, height: 26 }}>
          <Icon name="chevronRight" size={15} />
        </button>
        <span className="clamp-1" style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "var(--ink)", minWidth: 0 }}>{topic.name || "Sin nombre"}</span>
        <span className="badge">{qCount} pregunta{qCount !== 1 ? "s" : ""}</span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onDuplicate} title="Duplicar tema" style={{ padding: 5, width: 28, height: 28 }}>
          <Icon name="copy" size={14} />
        </button>
        <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} title="Eliminar tema" style={{ padding: 5, width: 28, height: 28 }}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="card fade-up" data-builder-id={topic.id} onFocusCapture={onActive} onClick={onActive} style={{ marginBottom: 18, overflow: "visible" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)", borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {grip}
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onToggle} title="Contraer tema" style={{ padding: 4, width: 26, height: 26 }}>
            <Icon name="chevronDown" size={15} />
          </button>
          <InlineInput
            value={topic.name}
            onChange={(v) => onChange({ ...topic, name: v })}
            placeholder="Nombre del tema"
            style={{ flex: 1, minWidth: 180, fontSize: 16, fontWeight: 700 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Seg
              options={[{ label: "Puntos ponderados", value: "weighted" }, { label: "% de aciertos", value: "percent" }]}
              value={topic.scoring}
              onChange={(v) => onChange({ ...topic, scoring: v as Topic["scoring"] })}
            />
            <Toggle
              on={topic.includeInOverall !== false}
              onChange={(v) => onChange({ ...topic, includeInOverall: v })}
              label="Cuenta en global"
            />
            {topic.includeInOverall !== false && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Peso</span>
                <select
                  className="select"
                  value={topic.weight ?? 1}
                  onChange={(e) => onChange({ ...topic, weight: Number(e.target.value) })}
                  style={{ width: 68, fontSize: 13, padding: "5px 8px" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onDuplicate} title="Duplicar tema">
              <Icon name="copy" size={15} />
            </button>
            <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} title="Eliminar tema">
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>
        <textarea
          className="textarea"
          value={topic.description || ""}
          onChange={(e) => onChange({ ...topic, description: e.target.value })}
          placeholder="Descripción del tema (opcional)"
          style={{ marginTop: 12, fontSize: 13, minHeight: 48, resize: "vertical" }}
        />
      </div>
      <div style={{ padding: "14px 18px" }}>
        {topic.questions.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-3)", fontSize: 13 }}>
            Sin preguntas. Agrega la primera.
          </div>
        )}
        {topic.questions.map((q, i) => (
          <DragItem key={q.id} typeKey={qKey} index={i} count={topic.questions.length} ins={qIns} setIns={setQIns} onReorder={reorderQuestions}>
            {(qGrip) => (
              <QuestionCard
                q={q}
                topicScoring={topic.scoring}
                index={i}
                grip={qGrip}
                onChange={(updated) => updateQuestion(q.id, updated)}
                onDelete={() => deleteQuestion(q.id)}
                onDuplicate={() => duplicateQuestion(i)}
              />
            )}
          </DragItem>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addQuestion}>
          <Icon name="plus" size={14} /> Agregar pregunta
        </button>
      </div>
    </div>
  );
}

// ---- Live preview pane (respondent view of the active topic) ----
function PreviewPane({ topic, accent }: { topic: Topic | null; accent: string }) {
  return (
    <div className="card" style={{ overflow: "hidden", maxHeight: "calc(100vh - 150px)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 6, background: accent, flex: "none" }} />
      <div style={{ padding: "16px 18px", overflowY: "auto" }}>
        {!topic ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--ink-3)", fontSize: 13 }}>
            Selecciona o edita un tema para verlo aquí.
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{topic.name || "Sin nombre"}</h3>
            {topic.description && (
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 4 }}>{topic.description}</p>
            )}
            {topic.questions.length === 0 && (
              <div style={{ textAlign: "center", padding: "26px 0", color: "var(--ink-3)", fontSize: 13 }}>
                Este tema aún no tiene preguntas.
              </div>
            )}
            {topic.questions.map((q, i) => (
              <div key={q.id} style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 99, background: accent, color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.45 }}>{q.text || "(pregunta sin texto)"}</span>
                </div>
                <div style={{ marginLeft: 29, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {q.options.map((o) => (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--ink-2)", background: "var(--surface)" }}>
                      <span style={{ width: 15, height: 15, borderRadius: 99, border: `2px solid ${accent}`, opacity: .55, flex: "none" }} />
                      {o.label || "(opción sin texto)"}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Question bank (reuse questions from other tests) ----
function QuestionBankModal({ open, onClose, currentTest, onImport }: {
  open: boolean; onClose: () => void; currentTest: TestSummary;
  onImport: (questions: Question[]) => void;
}) {
  const { tests } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Map<string, Question>>(new Map());

  useEffect(() => {
    if (open) { setSelected(new Map()); setExpanded(new Set()); }
  }, [open]);

  const sources = useMemo(
    () => tests.filter((t) => t.id !== currentTest.id && t.mode === currentTest.mode && (t.topics || []).some((tp) => tp.questions.length > 0)),
    [tests, currentTest.id, currentTest.mode]
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleQuestion(key: string, q: Question) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key); else next.set(key, q);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={onClose} width={680} title="Reutilizar preguntas" sub="Importa preguntas de otros cuestionarios del mismo modo. Se copiarán con identificadores nuevos.">
      {sources.length === 0 ? (
        <EmptyState icon="layers" title="Sin cuestionarios compatibles" sub="No hay otros cuestionarios con preguntas en este modo." />
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {sources.map((src) => {
            const qTotal = (src.topics || []).reduce((n, tp) => n + tp.questions.length, 0);
            const isOpen = expanded.has(src.id);
            return (
              <div key={src.id} className="card" style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleExpand(src.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "var(--surface-2)", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={15} style={{ color: "var(--ink-3)" }} />
                  <span className="clamp-1" style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--ink)", minWidth: 0 }}>{src.name}</span>
                  <span className="badge">{qTotal} pregunta{qTotal !== 1 ? "s" : ""}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "8px 14px 12px" }}>
                    {(src.topics || []).filter((tp) => tp.questions.length > 0).map((tp) => (
                      <div key={tp.id} style={{ marginTop: 6 }}>
                        <div className="eyebrow" style={{ marginBottom: 5 }}>{tp.name}</div>
                        {tp.questions.map((q) => {
                          const key = `${src.id}:${q.id}`;
                          return (
                            <label key={q.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 4px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}>
                              <input
                                type="checkbox"
                                checked={selected.has(key)}
                                onChange={() => toggleQuestion(key, q)}
                                style={{ accentColor: "var(--primary)", width: 15, height: 15, flex: "none", cursor: "pointer" }}
                              />
                              <span className="clamp-1" style={{ flex: 1, fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{q.text || "(sin texto)"}</span>
                              <span style={{ fontSize: 11.5, color: "var(--ink-3)", flex: "none" }}>{q.options.length} opciones</span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>
          {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={selected.size === 0}
            onClick={() => onImport(Array.from(selected.values()))}
          >
            <Icon name="copy" size={14} /> Importar ({selected.size})
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Condition row ----
function ConditionRow({ cond, topics, onChange, onDelete, canDelete }: {
  cond: Condition; topics: Topic[]; onChange: (c: Condition) => void; onDelete: () => void; canDelete: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <select
        className="select"
        value={cond.scope}
        onChange={(e) => onChange({ ...cond, scope: e.target.value as Condition["scope"], topicId: undefined })}
        style={{ fontSize: 13, padding: "5px 8px", width: 110 }}
      >
        <option value="overall">Global</option>
        <option value="topic">Tema</option>
      </select>
      {cond.scope === "topic" && (
        <select
          className="select"
          value={cond.topicId || ""}
          onChange={(e) => onChange({ ...cond, topicId: e.target.value })}
          style={{ fontSize: 13, padding: "5px 8px", flex: 1, minWidth: 120 }}
        >
          <option value="">— Seleccionar tema —</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <select
        className="select"
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value as Condition["operator"] })}
        style={{ fontSize: 13, padding: "5px 8px", width: 90 }}
      >
        <option value="below">≤ (por debajo)</option>
        <option value="above">≥ (por encima)</option>
        <option value="between">entre</option>
      </select>
      <input
        type="number"
        className="input"
        value={cond.threshold}
        min={0} max={100}
        onChange={(e) => onChange({ ...cond, threshold: Number(e.target.value) })}
        style={{ width: 70, fontSize: 13, padding: "5px 8px" }}
        placeholder="0–100"
      />
      {cond.operator === "between" && (
        <>
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>y</span>
          <input
            type="number"
            className="input"
            value={cond.threshold2 ?? 100}
            min={0} max={100}
            onChange={(e) => onChange({ ...cond, threshold2: Number(e.target.value) })}
            style={{ width: 70, fontSize: 13, padding: "5px 8px" }}
            placeholder="0–100"
          />
        </>
      )}
      <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} disabled={!canDelete} style={{ padding: 5, width: 28, height: 28 }}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

// ---- Plain-language description of a condition ----
function conditionText(c: Condition, topics: Topic[]): string {
  const subject = c.scope === "overall"
    ? "el puntaje global"
    : `el tema "${topics.find((t) => t.id === c.topicId)?.name || "(sin seleccionar)"}"`;
  if (c.operator === "between") return `${subject} está entre ${c.threshold} y ${c.threshold2 ?? 100}`;
  return `${subject} es ${c.operator === "below" ? "≤" : "≥"} ${c.threshold}`;
}

// ---- Solution card ----
function SolutionCard({ sol, topics, onChange, onDelete }: {
  sol: Solution; topics: Topic[]; onChange: (s: Solution) => void; onDelete: () => void;
}) {
  const conditions: Condition[] = sol.conditions && sol.conditions.length ? sol.conditions : [{ scope: "overall", operator: "below", threshold: 70 }];
  const [actInput, setActInput] = useState("");

  function updateCond(i: number, c: Condition) {
    const next = conditions.map((x, idx) => idx === i ? c : x);
    onChange({ ...sol, conditions: next });
  }
  function deleteCond(i: number) {
    const next = conditions.filter((_, idx) => idx !== i);
    onChange({ ...sol, conditions: next.length ? next : conditions });
  }
  function addCond() {
    onChange({ ...sol, conditions: [...conditions, { scope: "overall", operator: "below", threshold: 70 }] });
  }
  function addAction(text: string) {
    const t = text.trim();
    if (!t) return;
    onChange({ ...sol, actions: [...(sol.actions || []), t] });
    setActInput("");
  }
  function removeAction(i: number) {
    onChange({ ...sol, actions: (sol.actions || []).filter((_, idx) => idx !== i) });
  }
  function updateAction(i: number, v: string) {
    onChange({ ...sol, actions: (sol.actions || []).map((a, idx) => idx === i ? v : a) });
  }

  const joiner = (sol.logic || "all") === "any" ? " O " : " Y ";
  const preview = conditions.map((c) => conditionText(c, topics)).join(joiner);

  return (
    <div className="card fade-up" data-builder-id={sol.id} style={{ marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)", borderRadius: "var(--r-lg) var(--r-lg) 0 0", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineInput
            value={sol.name}
            onChange={(v) => onChange({ ...sol, name: v })}
            placeholder="Nombre de la solución"
            style={{ fontSize: 16, fontWeight: 700 }}
          />
        </div>
        <input
          className="input"
          value={sol.category || ""}
          onChange={(e) => onChange({ ...sol, category: e.target.value })}
          placeholder="Categoría"
          style={{ width: 150, fontSize: 13, padding: "5px 10px" }}
        />
        <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} title="Eliminar solución">
          <Icon name="trash" size={15} />
        </button>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Description */}
        <div>
          <label className="field-label">Descripción</label>
          <textarea
            className="textarea"
            value={sol.description || ""}
            onChange={(e) => onChange({ ...sol, description: e.target.value })}
            placeholder="Explica cuándo se activa esta solución y qué implica"
            style={{ fontSize: 13, minHeight: 64, resize: "vertical" }}
          />
        </div>

        {/* Conditions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>Condiciones de activación</label>
            {conditions.length > 1 && (
              <Seg
                options={[{ label: "TODAS", value: "all" }, { label: "ALGUNA", value: "any" }]}
                value={sol.logic || "all"}
                onChange={(v) => onChange({ ...sol, logic: v as "all" | "any" })}
              />
            )}
          </div>
          {conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              cond={cond}
              topics={topics}
              onChange={(c) => updateCond(i, c)}
              onDelete={() => deleteCond(i)}
              canDelete={conditions.length > 1}
            />
          ))}
          {/* Plain-language preview */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", background: "var(--surface-sunken)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
            <Icon name="eye" size={14} style={{ flex: "none", marginTop: 2, color: "var(--ink-3)" }} />
            <span>Se mostrará si {preview}.</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addCond} style={{ marginTop: 8, fontSize: 12 }}>
            <Icon name="plus" size={13} /> Agregar condición
          </button>
        </div>

        {/* CTA link */}
        <div>
          <label className="field-label">CTA (enlace)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              value={sol.link?.label || ""}
              onChange={(e) => onChange({ ...sol, link: { label: e.target.value, url: sol.link?.url || "" } })}
              placeholder="Texto del enlace"
              style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
            />
            <input
              className="input"
              value={sol.link?.url || ""}
              onChange={(e) => onChange({ ...sol, link: { label: sol.link?.label || "", url: e.target.value } })}
              placeholder="https://..."
              style={{ flex: 2, fontSize: 13, padding: "6px 10px" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div>
          <label className="field-label">Acciones recomendadas</label>
          {(sol.actions || []).length > 0 && (
            <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {(sol.actions || []).map((act, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="input"
                    value={act}
                    onChange={(e) => updateAction(i, e.target.value)}
                    style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
                  />
                  <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => removeAction(i)} style={{ padding: 5, width: 28, height: 28 }}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              value={actInput}
              onChange={(e) => setActInput(e.target.value)}
              placeholder="Descripción de acción…"
              style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAction(actInput); } }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addAction(actInput)}>
              <Icon name="plus" size={13} /> Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Temas tab ----
const TOPIC_KEY = "text/x-aud-topic";

function TemasTab({ test, onUpdate, toast }: { test: TestSummary; onUpdate: (patch: Partial<TestSummary>) => void; toast: ToastFn }) {
  const { tests } = useStore();
  const [topicIns, setTopicIns] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [previewOn, setPreviewOn] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tests]);

  const topics: Topic[] = test.topics || [];
  const accent = test.branding?.accent || test.accent || "#1f8a5b";
  const activeTopic = topics.find((t) => t.id === activeTopicId) || topics[0] || null;

  function updateTopic(id: string, updated: Topic) {
    onUpdate({ topics: topics.map((t) => t.id === id ? updated : t) });
  }
  function deleteTopic(id: string) {
    onUpdate({ topics: topics.filter((t) => t.id !== id) });
  }
  function addTopic() {
    const t = blankTopic();
    setActiveTopicId(t.id);
    onUpdate({ topics: [...topics, t] });
  }
  function duplicateTopic(i: number) {
    const copy = copyTopic(topics[i]);
    const next = topics.slice();
    next.splice(i + 1, 0, copy);
    setActiveTopicId(copy.id);
    onUpdate({ topics: next });
    toast("Tema duplicado", "copy");
  }
  function reorderTopics(from: number, to: number) {
    onUpdate({ topics: moveItem(topics, from, to) });
  }
  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function importQuestions(qs: Question[]) {
    const copies = qs.map((q) => copyQuestion(q, false));
    const target = activeTopic && topics.some((t) => t.id === activeTopic.id) ? activeTopic.id : null;
    if (target) {
      onUpdate({ topics: topics.map((t) => t.id === target ? { ...t, questions: [...t.questions, ...copies] } : t) });
    } else {
      onUpdate({ topics: [...topics, { ...blankTopic(), name: "Preguntas importadas", questions: copies }] });
    }
    setBankOpen(false);
    toast(`${copies.length} pregunta${copies.length !== 1 ? "s" : ""} importada${copies.length !== 1 ? "s" : ""}`, "copy");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: previewOn ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        {/* Tags + Description */}
        <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <TagEditor tags={test.tags || []} allTags={allTags} onChange={(tags) => onUpdate({ tags })} />
          <div>
            <label className="field-label">Descripción del cuestionario</label>
            <textarea
              className="textarea"
              value={test.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe el propósito de este cuestionario…"
              style={{ fontSize: 14, minHeight: 72 }}
            />
          </div>
        </div>

        {/* Topics */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Temas</h2>
              <span className="badge">{topics.length} tema{topics.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {topics.length > 0 && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCollapsed(new Set(topics.map((t) => t.id)))} title="Contraer todos los temas">
                    <Icon name="chevronRight" size={14} /> Contraer todo
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCollapsed(new Set())} title="Expandir todos los temas">
                    <Icon name="chevronDown" size={14} /> Expandir todo
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBankOpen(true)}>
                <Icon name="layers" size={14} /> Reutilizar preguntas
              </button>
              <button
                type="button"
                className={"btn btn-sm " + (previewOn ? "btn-primary" : "btn-secondary") + " hide-mobile"}
                onClick={() => setPreviewOn((v) => !v)}
                title="Mostrar/ocultar la vista del respondente"
              >
                <Icon name="eye" size={14} /> Vista previa
              </button>
            </div>
          </div>
          {topics.length === 0 && (
            <EmptyState icon="layers" title="Sin temas" sub="Agrega un tema para comenzar a estructurar el cuestionario." />
          )}
          {topics.map((topic, i) => (
            <DragItem key={topic.id} typeKey={TOPIC_KEY} index={i} count={topics.length} ins={topicIns} setIns={setTopicIns} onReorder={reorderTopics}>
              {(grip) => (
                <TopicCard
                  topic={topic}
                  grip={grip}
                  collapsed={collapsed.has(topic.id)}
                  onToggle={() => toggleCollapsed(topic.id)}
                  onActive={() => setActiveTopicId(topic.id)}
                  onChange={(updated) => updateTopic(topic.id, updated)}
                  onDelete={() => deleteTopic(topic.id)}
                  onDuplicate={() => duplicateTopic(i)}
                />
              )}
            </DragItem>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addTopic}>
            <Icon name="plus" size={15} /> Agregar tema
          </button>
        </div>
      </div>

      {/* Live preview pane */}
      {previewOn && (
        <div className="hide-mobile" style={{ position: "sticky", top: 80 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Vista previa · como lo ve el respondente</div>
          <PreviewPane topic={activeTopic} accent={accent} />
        </div>
      )}

      <QuestionBankModal open={bankOpen} onClose={() => setBankOpen(false)} currentTest={test} onImport={importQuestions} />
    </div>
  );
}

// ---- Soluciones tab ----
function SolucionesTab({ test, onUpdate }: { test: TestSummary; onUpdate: (patch: Partial<TestSummary>) => void }) {
  const solutions: Solution[] = test.solutions || [];

  function updateSol(id: string, updated: Solution) {
    onUpdate({ solutions: solutions.map((s) => s.id === id ? updated : s) });
  }
  function deleteSol(id: string) {
    onUpdate({ solutions: solutions.filter((s) => s.id !== id) });
  }
  function addSol() {
    onUpdate({ solutions: [...solutions, blankSolution()] });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Soluciones</h2>
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>Define qué se muestra al respondente según su resultado.</p>
        </div>
        <span className="badge">{solutions.length} solución{solutions.length !== 1 ? "es" : ""}</span>
      </div>
      {solutions.length === 0 && (
        <EmptyState icon="spark" title="Sin soluciones" sub="Agrega soluciones para mostrar recomendaciones personalizadas al finalizar el cuestionario." />
      )}
      {solutions.map((sol) => (
        <SolutionCard
          key={sol.id}
          sol={sol}
          topics={test.topics || []}
          onChange={(updated) => updateSol(sol.id, updated)}
          onDelete={() => deleteSol(sol.id)}
        />
      ))}
      <button type="button" className="btn btn-secondary" onClick={addSol}>
        <Icon name="plus" size={15} /> Agregar solución
      </button>
    </div>
  );
}

// ---- Status badge for invitations ----
function InvStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = { completada: "badge-good", enviada: "badge-info", pendiente: "badge" };
  const labels: Record<string, string> = { completada: "Completada", enviada: "Enviada", pendiente: "Pendiente" };
  return <span className={"badge " + (classes[status] || "badge")}><span className="dot" />{labels[status] || status}</span>;
}

// ---- Distribución tab ----
function DistribucionTab({ test, testId, toast, onShare }: { test: TestSummary; testId: string; toast: ToastFn; onShare: () => void }) {
  const { addInvitation, deleteInvitation, sendInvitation, sendPendingInvitations } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${testId}` : `/q/${testId}`;
  const invitations: InvitationRow[] = test.invitations || [];
  const pendingCount = invitations.filter((i) => i.status === "pendiente" && i.email).length;

  async function handleSend(inv: InvitationRow, reminder = false) {
    setSendingId(inv.id);
    try {
      const result = await sendInvitation(inv.id, reminder);
      if (result.ok) toast(reminder ? "Recordatorio enviado" : "Invitación enviada", "send");
      else toast(result.error || "Error al enviar", "alert");
    } finally {
      setSendingId(null);
    }
  }

  async function handleBulkSend() {
    setBulkSending(true);
    try {
      const result = await sendPendingInvitations(testId);
      if (result.ok) toast(`${result.sent} enviada${result.sent !== 1 ? "s" : ""}${result.failed ? `, ${result.failed} con error` : ""}`, "send");
      else toast(result.error || "Error al enviar", "alert");
    } finally {
      setBulkSending(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    try {
      await addInvitation(testId, { name, email, company, status: "pendiente", sentAt: null });
      setName(""); setEmail(""); setCompany("");
      toast("Invitación creada", "send");
    } catch {
      toast("Error al crear invitación", "alert");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ivId: string) {
    if (!confirm("¿Eliminar esta invitación?")) return;
    await deleteInvitation(testId, ivId);
    toast("Invitación eliminada", "trash");
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => toast("Enlace copiado", "copy"));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Status + link */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div>
            <div className="field-label" style={{ marginBottom: 4 }}>Estado del cuestionario</div>
            <span className={"badge " + (test.status === "publicado" ? "badge-good" : "")}>
              <span className="dot" />
              {test.status === "publicado" ? "Publicado — acepta respuestas" : "Borrador — no visible"}
            </span>
          </div>
        </div>
        <div>
          <div className="field-label">Enlace público</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input input-mono"
              value={shareUrl}
              readOnly
              style={{ flex: 1, fontSize: 13, background: "var(--surface-sunken)" }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>
              <Icon name="copy" size={14} /> Copiar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onShare}>
              <Icon name="share" size={14} /> QR / Compartir
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: "none" }}
            >
              <Icon name="external" size={14} /> Abrir
            </a>
          </div>
        </div>
      </div>

      {/* Invite form */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Invitar por email</h3>
        <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label className="field-label">Nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="field-label">Email <span style={{ color: "var(--bad)" }}>*</span></label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.com" required style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="field-label">Empresa</label>
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa S.A." style={{ fontSize: 13 }} />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !email}>
              <Icon name="send" size={14} /> {saving ? "Guardando…" : "Agregar invitación"}
            </button>
          </div>
        </form>
      </div>

      {/* Invitation list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Invitaciones</h3>
            <span className="badge">{invitations.length}</span>
          </div>
          {pendingCount > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleBulkSend} disabled={bulkSending}>
              <Icon name="send" size={13} /> {bulkSending ? "Enviando…" : `Enviar ${pendingCount} pendiente${pendingCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        {invitations.length === 0 ? (
          <EmptyState icon="send" title="Sin invitaciones" sub="Agrega emails arriba para enviar invitaciones directas." />
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {invitations.map((inv, i) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < invitations.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{inv.name || inv.email}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
                    {inv.email}{inv.company ? ` · ${inv.company}` : ""}
                    {inv.sentAt ? ` · ${new Date(inv.sentAt).toLocaleDateString("es")}` : ""}
                  </div>
                </div>
                <InvStatusBadge status={inv.status} />
                {inv.email && inv.status === "pendiente" && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSend(inv)} disabled={sendingId === inv.id} title="Enviar invitación por email">
                    <Icon name="send" size={13} /> {sendingId === inv.id ? "Enviando…" : "Enviar"}
                  </button>
                )}
                {inv.email && inv.status === "enviada" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSend(inv, true)} disabled={sendingId === inv.id} title="Enviar recordatorio">
                    <Icon name="refresh" size={13} /> {sendingId === inv.id ? "Enviando…" : "Recordar"}
                  </button>
                )}
                <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => handleDelete(inv.id)} title="Eliminar invitación">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Marca tab ----
const MAX_LOGO_BYTES = 120 * 1024;

function MarcaTab({ test, onUpdate, toast }: { test: TestSummary; onUpdate: (patch: Partial<TestSummary>) => void; toast: ToastFn }) {
  const branding: Branding = test.branding || { coverColor: test.accent || "#1f8a5b", accent: test.accent || "#1f8a5b", orgName: "", thankYou: "Gracias por completar la evaluación." };
  const [previewView, setPreviewView] = useState<"portada" | "resultado">("portada");

  function updateBranding(patch: Partial<Branding>) {
    onUpdate({ branding: { ...branding, ...patch } });
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast("El logo supera 120 KB. Usa una imagen más liviana o una URL.", "alert");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateBranding({ logoUrl: String(reader.result) });
    reader.onerror = () => toast("No se pudo leer el archivo", "alert");
    reader.readAsDataURL(file);
  }

  const accent = branding.accent || "#1f8a5b";
  const isDataLogo = !!branding.logoUrl?.startsWith("data:");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
      {/* Form */}
      <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700 }}>Configuración de marca</h3>
        <div>
          <label className="field-label">Color de portada</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={branding.coverColor || "#1f8a5b"}
              onChange={(e) => updateBranding({ coverColor: e.target.value })}
              style={{ width: 46, height: 36, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", cursor: "pointer", padding: 3 }}
            />
            <input
              className="input input-mono"
              value={branding.coverColor || "#1f8a5b"}
              onChange={(e) => updateBranding({ coverColor: e.target.value })}
              style={{ width: 110, fontSize: 13 }}
              placeholder="#1f8a5b"
            />
          </div>
        </div>
        <div>
          <label className="field-label">Color de acento</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={branding.accent || "#1f8a5b"}
              onChange={(e) => { onUpdate({ branding: { ...branding, accent: e.target.value }, accent: e.target.value }); }}
              style={{ width: 46, height: 36, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", cursor: "pointer", padding: 3 }}
            />
            <input
              className="input input-mono"
              value={branding.accent || "#1f8a5b"}
              onChange={(e) => { onUpdate({ branding: { ...branding, accent: e.target.value }, accent: e.target.value }); }}
              style={{ width: 110, fontSize: 13 }}
              placeholder="#1f8a5b"
            />
          </div>
        </div>
        <div>
          <label className="field-label">Nombre de la organización</label>
          <input
            className="input"
            value={branding.orgName || ""}
            onChange={(e) => updateBranding({ orgName: e.target.value })}
            placeholder="Mi Empresa S.A."
            style={{ fontSize: 14 }}
          />
        </div>

        {/* Logo */}
        <div>
          <label className="field-label">Logo</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="input"
              value={isDataLogo ? "" : (branding.logoUrl || "")}
              onChange={(e) => updateBranding({ logoUrl: e.target.value || undefined })}
              placeholder={isDataLogo ? "Logo cargado desde archivo" : "https://miempresa.com/logo.png"}
              style={{ flex: 1, fontSize: 13 }}
            />
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", flex: "none" }} title="Subir archivo de imagen (máx. 120 KB)">
              <Icon name="upload" size={14} /> Subir
              <input type="file" accept="image/*" onChange={handleLogoFile} style={{ display: "none" }} />
            </label>
            {branding.logoUrl && (
              <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={() => updateBranding({ logoUrl: undefined })} title="Quitar logo">
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>URL de imagen o archivo de hasta 120 KB. Se muestra en la portada y en los resultados.</p>
        </div>

        <div>
          <label className="field-label">Mensaje de agradecimiento</label>
          <textarea
            className="textarea"
            value={branding.thankYou || ""}
            onChange={(e) => updateBranding({ thankYou: e.target.value })}
            placeholder="Gracias por completar la evaluación."
            style={{ fontSize: 14, minHeight: 80 }}
          />
        </div>

        {/* CTA block */}
        <div>
          <label className="field-label">Bloque de siguientes pasos en resultados</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              value={branding.ctaLabel || ""}
              onChange={(e) => updateBranding({ ctaLabel: e.target.value })}
              placeholder="Texto del botón (ej. Agendar llamada)"
              style={{ flex: 1, fontSize: 13 }}
            />
            <input
              className="input"
              value={branding.ctaUrl || ""}
              onChange={(e) => updateBranding({ ctaUrl: e.target.value })}
              placeholder="https://..."
              style={{ flex: 1.4, fontSize: 13 }}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>Se muestra al respondente al final, junto a su resultado.</p>
        </div>

        <Toggle
          on={!!branding.showBenchmark}
          onChange={(v) => updateBranding({ showBenchmark: v })}
          label="Mostrar comparación con el promedio en resultados"
        />
      </div>

      {/* Preview column */}
      <div style={{ position: "sticky", top: 80 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <div className="eyebrow">Vista previa</div>
          <Seg
            options={[{ label: "Portada", value: "portada" }, { label: "Resultado", value: "resultado" }]}
            value={previewView}
            onChange={(v) => setPreviewView(v as "portada" | "resultado")}
          />
        </div>

        {previewView === "portada" ? (
          <div className="card" style={{ overflow: "hidden", borderRadius: "var(--r-lg)" }}>
            {/* Cover strip */}
            <div style={{ minHeight: 80, background: branding.coverColor || "#1f8a5b", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 16px" }}>
              {branding.logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: 40, maxWidth: 130, objectFit: "contain", background: "rgba(255,255,255,.9)", borderRadius: 8, padding: 4 }} />
              )}
              {branding.orgName && (
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-.02em" }}>{branding.orgName}</span>
              )}
            </div>
            <div style={{ padding: "18px 20px" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: "var(--ink)" }}>{test.name}</h3>
              {test.description && <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45, marginBottom: 12 }}>{test.description}</p>}
              <button type="button" className="btn btn-sm" style={{ background: accent, color: "#fff", fontSize: 13 }}>
                Comenzar evaluación
              </button>
              <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-3)", marginBottom: 4 }}>Mensaje final</div>
                {branding.thankYou || "Gracias por completar la evaluación."}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden", borderRadius: "var(--r-lg)" }}>
            <div style={{ height: 6, background: accent }} />
            <div style={{ padding: "20px 20px 22px", textAlign: "center" }}>
              {branding.logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: 34, maxWidth: 120, objectFit: "contain", marginBottom: 10 }} />
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Tu resultado</div>
              <ScoreRing value={78} size={110} label="Global" />
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 14 }}>
                {branding.thankYou || "Gracias por completar la evaluación."}
              </p>
              {branding.showBenchmark && (
                <div style={{ marginTop: 12, padding: "9px 12px", background: "var(--surface-sunken)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
                  Tu puntaje: 78 · Promedio general: 64
                </div>
              )}
              {branding.ctaLabel && (
                <div style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-sm" style={{ background: accent, color: "#fff", fontSize: 13 }}>
                    {branding.ctaLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Validation ----
type Issue = { key: string; label: string; targetId: string; fallbackId?: string; tab: TabId };

function computeIssues(test: TestSummary | null): Issue[] {
  if (!test) return [];
  const list: Issue[] = [];
  if (!test.name?.trim()) {
    list.push({ key: "name", label: "El cuestionario no tiene nombre", targetId: "builder-name", tab: "temas" });
  }
  (test.topics || []).forEach((t) => {
    const tName = t.name?.trim() || "Sin nombre";
    if (t.questions.length === 0) {
      list.push({ key: `t0-${t.id}`, label: `El tema "${tName}" no tiene preguntas`, targetId: t.id, tab: "temas" });
    }
    if (t.scoring === "weighted" && t.questions.length > 0 && t.questions.every((q) => q.options.every((o) => !o.points))) {
      list.push({ key: `tw-${t.id}`, label: `Todas las opciones del tema "${tName}" valen 0 puntos`, targetId: t.id, tab: "temas" });
    }
    t.questions.forEach((q, qi) => {
      if (!q.text?.trim()) {
        list.push({ key: `qt-${q.id}`, label: `La pregunta ${qi + 1} de "${tName}" no tiene texto`, targetId: q.id, fallbackId: t.id, tab: "temas" });
      }
      if (q.options.length < 2) {
        list.push({ key: `qo-${q.id}`, label: `La pregunta ${qi + 1} de "${tName}" tiene menos de 2 opciones`, targetId: q.id, fallbackId: t.id, tab: "temas" });
      }
    });
  });
  (test.solutions || []).forEach((s) => {
    const sName = s.name?.trim() || "Sin nombre";
    const conds = s.conditions || [];
    if (conds.length === 0 && s.threshold == null) {
      list.push({ key: `sc-${s.id}`, label: `La solución "${sName}" no tiene condiciones de activación`, targetId: s.id, tab: "soluciones" });
    }
    if (conds.some((c) => c.scope === "topic" && !c.topicId)) {
      list.push({ key: `st-${s.id}`, label: `La solución "${sName}" tiene una condición sin tema seleccionado`, targetId: s.id, tab: "soluciones" });
    }
    if (s.link && ((s.link.label && !s.link.url) || (!s.link.label && s.link.url))) {
      list.push({ key: `sl-${s.id}`, label: `El enlace de la solución "${sName}" está incompleto (falta texto o URL)`, targetId: s.id, tab: "soluciones" });
    }
  });
  return list;
}

function IssueList({ issues, onJump }: { issues: Issue[]; onJump: (i: Issue) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {issues.map((i) => (
        <button
          key={i.key}
          type="button"
          onClick={() => onJump(i)}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, color: "var(--ink)", background: "none", border: "none", borderRadius: "var(--r-xs)", cursor: "pointer", lineHeight: 1.4 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <Icon name="alert" size={14} style={{ color: "var(--warn)", flex: "none", marginTop: 1 }} />
          <span style={{ flex: 1 }}>{i.label}</span>
          <Icon name="chevronRight" size={13} style={{ color: "var(--ink-4)", flex: "none", marginTop: 2 }} />
        </button>
      ))}
    </div>
  );
}

// ---- Version history ----
type VersionRow = {
  id: string; version: number; name: string; publishedAt: string | null;
  topicCount: number; questionCount: number; solutionCount: number;
  topics: Topic[]; solutions: Solution[];
};

function versionDiff(cur: VersionRow, prev: VersionRow | undefined): string {
  if (!prev) return "Primera versión publicada";
  const parts: string[] = [];
  const dt = cur.topicCount - prev.topicCount;
  const dq = cur.questionCount - prev.questionCount;
  const ds = cur.solutionCount - prev.solutionCount;
  if (dt) parts.push(`${dt > 0 ? "+" : "−"}${Math.abs(dt)} tema${Math.abs(dt) !== 1 ? "s" : ""}`);
  if (dq) parts.push(`${dq > 0 ? "+" : "−"}${Math.abs(dq)} pregunta${Math.abs(dq) !== 1 ? "s" : ""}`);
  if (ds) parts.push(`${ds > 0 ? "+" : "−"}${Math.abs(ds)} solu${Math.abs(ds) !== 1 ? "ciones" : "ción"}`);
  return parts.length ? parts.join(", ") : "Cambios en el contenido";
}

function VersionsDrawer({ open, onClose, testId, onRestore }: {
  open: boolean; onClose: () => void; testId: string; onRestore: (v: VersionRow) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [error, setError] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionRow | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setVersions(null);
    setError(false);
    fetch(`/api/tests/${testId}/versions`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { if (alive) setVersions(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) { setVersions([]); setError(true); } });
    return () => { alive = false; };
  }, [open, testId]);

  return (
    <Drawer open={open} onClose={onClose} width={520} title="Historial de versiones" sub="Cada publicación con cambios crea una versión inmutable del instrumento.">
      {versions === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 84, borderRadius: "var(--r-md)" }} />)}
        </div>
      ) : error ? (
        <EmptyState icon="alert" title="Error al cargar" sub="No se pudo obtener el historial de versiones. Intenta de nuevo." />
      ) : versions.length === 0 ? (
        <EmptyState icon="history" title="Sin versiones" sub="Publica el cuestionario para crear la primera versión." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {versions.map((v, i) => (
            <div key={v.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span className="badge mono" style={{ flex: "none", marginTop: 2 }}>v{v.version}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clamp-1" style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{v.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <Icon name="clock" size={12} />
                    {v.publishedAt ? `${new Date(v.publishedAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })} · ${timeAgo(v.publishedAt)}` : "—"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 5 }}>
                    {v.topicCount} tema{v.topicCount !== 1 ? "s" : ""} · {v.questionCount} pregunta{v.questionCount !== 1 ? "s" : ""} · {v.solutionCount} solución{v.solutionCount !== 1 ? "es" : ""}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginTop: 4 }}>
                    {versionDiff(v, versions[i + 1])}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: "none" }} onClick={() => setRestoreTarget(v)}>
                  <Icon name="refresh" size={13} /> Restaurar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (restoreTarget) onRestore(restoreTarget);
          setRestoreTarget(null);
          onClose();
        }}
        title={`Restaurar versión v${restoreTarget?.version ?? ""}`}
        message={`Se copiarán los temas y soluciones de la versión v${restoreTarget?.version ?? ""} al borrador actual, reemplazando el contenido sin publicar. Esto no cambia lo que ven los respondentes: para que aplique, deberás volver a publicar el cuestionario.`}
        confirmLabel="Restaurar"
        danger={false}
      />
    </Drawer>
  );
}

// ---- Main builder ----
const HISTORY_LIMIT = 50;
const HISTORY_GROUP_MS = 700;
// Fields the PATCH endpoint accepts and that undo/redo should restore.
const SNAPSHOT_FIELDS = ["name", "tags", "description", "accent", "topics", "solutions", "branding"] as const;

function snapshotPatch(snap: TestSummary): Partial<TestSummary> {
  const patch: Partial<TestSummary> = {};
  for (const f of SNAPSHOT_FIELDS) {
    (patch as Record<string, unknown>)[f] = snap[f];
  }
  return patch;
}

export default function BuilderPage({ testId, nav, toast }: { testId: string; nav: NavFn; toast: ToastFn }) {
  const store = useStore();
  const storeTest = store.getTest(testId);
  const [test, setTest] = useState<TestSummary | null>(storeTest || null);
  const [tab, setTab] = useState<TabId>("temas");
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [validOpen, setValidOpen] = useState(false);
  const [kbdOpen, setKbdOpen] = useState(false);
  const [publishWarnOpen, setPublishWarnOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<TestSummary>>({});

  // Autosave indicator
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // Undo/redo history
  const testRef = useRef<TestSummary | null>(storeTest || null);
  const undoStack = useRef<TestSummary[]>([]);
  const redoStack = useRef<TestSummary[]>([]);
  const lastEditAt = useRef(0);
  const [, bumpHist] = useState(0);

  // Sync from store when it refreshes (only when no pending local changes)
  useEffect(() => {
    if (storeTest && !saveTimer.current) {
      testRef.current = storeTest;
      setTest(storeTest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeTest]);

  // Init from store on first load
  useEffect(() => {
    if (!test && storeTest) {
      testRef.current = storeTest;
      setTest(storeTest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback((patch: Partial<TestSummary>, immediate = false) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const delay = immediate ? 0 : 600;
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      const toSave = { ...pendingPatch.current };
      pendingPatch.current = {};
      setSaveState("saving");
      try {
        await store.updateTest(testId, toSave);
        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch {
        setSaveState("error");
        toast("Error al guardar", "alert");
      }
    }, delay);
  }, [store, testId, toast]);

  const handleUpdate = useCallback((patch: Partial<TestSummary>, immediate = false, record = true) => {
    const prev = testRef.current;
    if (!prev) return;
    if (record) {
      const now = Date.now();
      // Group rapid edits (typing) into a single history entry.
      if (undoStack.current.length === 0 || now - lastEditAt.current > HISTORY_GROUP_MS) {
        undoStack.current.push(JSON.parse(JSON.stringify(prev)) as TestSummary);
        if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
      }
      redoStack.current = [];
      lastEditAt.current = now;
      bumpHist((x) => x + 1);
    }
    const next = { ...prev, ...patch };
    testRef.current = next;
    setTest(next);
    scheduleSave(patch, immediate);
  }, [scheduleSave]);

  const applySnapshot = useCallback((snap: TestSummary, cur: TestSummary) => {
    // Preserve non-content fields (status, counters, invitations) from the current state.
    const merged: TestSummary = {
      ...snap,
      status: cur.status,
      archived: cur.archived,
      invitations: cur.invitations,
      _latestVersion: cur._latestVersion,
      _responseCount: cur._responseCount,
      _avgScore: cur._avgScore,
    };
    testRef.current = merged;
    setTest(merged);
    lastEditAt.current = 0; // the next edit starts a fresh history entry
    scheduleSave(snapshotPatch(merged));
    bumpHist((x) => x + 1);
  }, [scheduleSave]);

  const undo = useCallback(() => {
    const cur = testRef.current;
    const snap = undoStack.current.pop();
    if (!snap || !cur) return;
    redoStack.current.push(JSON.parse(JSON.stringify(cur)) as TestSummary);
    applySnapshot(snap, cur);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const cur = testRef.current;
    const snap = redoStack.current.pop();
    if (!snap || !cur) return;
    undoStack.current.push(JSON.parse(JSON.stringify(cur)) as TestSummary);
    applySnapshot(snap, cur);
  }, [applySnapshot]);

  // Keyboard shortcuts (skip while typing in form fields)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Live validation
  const issues = useMemo(() => computeIssues(test), [test]);

  const jumpToIssue = useCallback((issue: Issue) => {
    setValidOpen(false);
    setPublishWarnOpen(false);
    setTab(issue.tab);
    setTimeout(() => {
      const el = document.querySelector(`[data-builder-id="${issue.targetId}"]`)
        || (issue.fallbackId ? document.querySelector(`[data-builder-id="${issue.fallbackId}"]`) : null);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("pulse-highlight");
      setTimeout(() => el.classList.remove("pulse-highlight"), 2400);
    }, 140);
  }, []);

  const restoreVersion = useCallback((v: VersionRow) => {
    handleUpdate({ topics: v.topics, solutions: v.solutions }, true);
    toast(`Versión v${v.version} restaurada al borrador`, "history");
  }, [handleUpdate, toast]);

  if (!test) {
    return (
      <PageWrap>
        <div style={{ textAlign: "center", padding: 60, color: "var(--ink-3)" }}>
          Cargando cuestionario…
        </div>
      </PageWrap>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "temas", label: "Temas y preguntas" },
    { id: "soluciones", label: "Soluciones" },
    { id: "distribucion", label: "Distribución" },
    { id: "marca", label: "Marca" },
  ];

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${testId}` : `/q/${testId}`;
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const popoverCard: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
    width: 340, maxHeight: 380, overflowY: "auto", padding: 8, boxShadow: "var(--sh-md)",
  };
  const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 55, background: "transparent" };

  return (
    <PageWrap maxWidth="var(--maxw)">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => nav("dashboard")} title="Volver">
          <Icon name="back" size={17} />
        </button>
        <div data-builder-id="builder-name" style={{ flex: 1, minWidth: 200 }}>
          <InlineInput
            value={test.name}
            onChange={(v) => handleUpdate({ name: v })}
            placeholder="Nombre del cuestionario"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", flexWrap: "wrap" }}>
          {/* Autosave indicator */}
          <span className="hide-mobile" style={{ fontSize: 12, fontWeight: 600, color: saveState === "error" ? "var(--bad)" : "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            {saveState === "saving" && (<><Icon name="refresh" size={12} /> Guardando…</>)}
            {saveState === "saved" && lastSavedAt && (<><Icon name="check2" size={12} /> Guardado {timeAgo(lastSavedAt)}</>)}
            {saveState === "error" && (<><Icon name="alert" size={12} /> Error al guardar</>)}
          </span>

          {/* Validation chip */}
          {issues.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="badge badge-warn"
                onClick={() => setValidOpen((o) => !o)}
                style={{ cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                title="Ver pendientes de revisión"
              >
                <Icon name="alert" size={12} /> {issues.length} pendiente{issues.length !== 1 ? "s" : ""}
              </button>
              {validOpen && (
                <>
                  <div style={overlay} onClick={() => setValidOpen(false)} />
                  <div className="card" style={popoverCard}>
                    <div className="eyebrow" style={{ padding: "6px 10px 8px" }}>Pendientes de revisión</div>
                    <IssueList issues={issues} onJump={jumpToIssue} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Undo / redo */}
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
            <Icon name="arrowLeft" size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
            <Icon name="arrowRight" size={15} />
          </button>

          {/* Keyboard hint */}
          <div style={{ position: "relative" }} className="hide-mobile">
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setKbdOpen((o) => !o)} title="Atajos de teclado">
              <Icon name="keyboard" size={15} />
            </button>
            {kbdOpen && (
              <>
                <div style={overlay} onClick={() => setKbdOpen(false)} />
                <div className="card" style={{ ...popoverCard, width: 280, padding: "12px 14px" }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Atajos de teclado</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>Deshacer</span><span><span className="kbd">Ctrl</span> <span className="kbd">Z</span></span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>Rehacer</span><span><span className="kbd">Ctrl</span> <span className="kbd">⇧</span> <span className="kbd">Z</span></span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>Nueva opción (en una opción)</span><span className="kbd">Enter</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Version history */}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHistoryOpen(true)} title="Historial de versiones publicadas">
            <Icon name="history" size={14} /> Historial
            {test._latestVersion != null && (
              <span className="badge mono" style={{ fontSize: 10.5, marginLeft: 2 }}>v{test._latestVersion}</span>
            )}
          </button>

          <Seg
            options={[{ label: "Borrador", value: "borrador" }, { label: "Publicado", value: "publicado" }]}
            value={test.status || "borrador"}
            onChange={(v) => {
              if (v === (test.status || "borrador")) return;
              if (v === "publicado" && issues.length > 0) { setPublishWarnOpen(true); return; }
              handleUpdate({ status: v }, true, false);
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShareOpen(true)}>
            <Icon name="share" size={14} /> Compartir
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: "none" }}
          >
            <Icon name="eye" size={14} /> Ver cuestionario
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid var(--line)", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-.01em",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: tab === t.id ? "var(--primary)" : "var(--ink-3)",
              borderBottom: tab === t.id ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2,
              transition: "color .13s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "temas" && <TemasTab test={test} onUpdate={(patch) => handleUpdate(patch)} toast={toast} />}
      {tab === "soluciones" && <SolucionesTab test={test} onUpdate={(patch) => handleUpdate(patch, true)} />}
      {tab === "distribucion" && <DistribucionTab test={test} testId={testId} toast={toast} onShare={() => setShareOpen(true)} />}
      {tab === "marca" && <MarcaTab test={test} onUpdate={(patch) => handleUpdate(patch)} toast={toast} />}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        testName={test.name}
        accent={test.branding?.accent || test.accent}
        toast={toast}
      />

      <VersionsDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        testId={testId}
        onRestore={restoreVersion}
      />

      {/* Publish-with-issues confirmation */}
      <Modal
        open={publishWarnOpen}
        onClose={() => setPublishWarnOpen(false)}
        width={520}
        title="Revisión antes de publicar"
        sub={`Hay ${issues.length} pendiente${issues.length !== 1 ? "s" : ""} de revisión. Puedes publicar de todos modos o revisarlos primero.`}
      >
        <div style={{ maxHeight: 300, overflowY: "auto", margin: "4px 0 16px" }}>
          <IssueList issues={issues} onJump={jumpToIssue} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPublishWarnOpen(false)}>
            Revisar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setPublishWarnOpen(false);
              handleUpdate({ status: "publicado" }, true, false);
              toast("Cuestionario publicado", "check2");
            }}
          >
            Publicar de todos modos
          </button>
        </div>
      </Modal>
    </PageWrap>
  );
}
