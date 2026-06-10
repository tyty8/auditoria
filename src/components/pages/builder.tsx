"use client";
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useStore } from "@/components/store";
import type { TestSummary, InvitationRow } from "@/components/store";
import { Icon, EmptyState, PageWrap, Modal } from "@/components/ui";
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
function OptionRow({ opt, scoring, onChange, onDelete, isOnly }: {
  opt: Option; scoring: string; onChange: (o: Option) => void; onDelete: () => void; isOnly: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
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
        onChange={(e) => onChange({ ...opt, label: e.target.value })}
        style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
        placeholder="Texto de opción"
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
function QuestionCard({ q, topicScoring, onChange, onDelete, index }: {
  q: Question; topicScoring: string; onChange: (q: Question) => void; onDelete: () => void; index: number;
}) {
  function updateOption(optId: string, patch: Partial<Option>) {
    onChange({ ...q, options: q.options.map((o) => o.id === optId ? { ...o, ...patch } : o) });
  }
  function deleteOption(optId: string) {
    onChange({ ...q, options: q.options.filter((o) => o.id !== optId) });
  }
  function addOption() {
    onChange({ ...q, options: [...q.options, blankOption()] });
  }

  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div className="eyebrow" style={{ marginTop: 8, minWidth: 22, textAlign: "center" }}>{index + 1}</div>
        <textarea
          className="textarea"
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          placeholder="Texto de la pregunta"
          style={{ flex: 1, fontSize: 14, minHeight: 54, resize: "vertical" }}
        />
        <button type="button" className="btn btn-danger-ghost btn-sm btn-icon" onClick={onDelete} title="Eliminar pregunta" style={{ padding: 5, width: 28, height: 28 }}>
          <Icon name="trash" size={14} />
        </button>
      </div>
      <div style={{ marginLeft: 32 }}>
        {topicScoring === "weighted" && (
          <div style={{ display: "flex", gap: 8, paddingBottom: 6, marginBottom: 4 }}>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase" }}>Opción</div>
            <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase", textAlign: "right" }}>Puntos</div>
            <div style={{ width: 28 }} />
          </div>
        )}
        {topicScoring === "percent" && (
          <div style={{ display: "flex", gap: 8, paddingBottom: 6, marginBottom: 4 }}>
            <div style={{ width: 20 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase" }}>Opción</div>
            <div style={{ width: 28 }} />
          </div>
        )}
        {q.options.map((opt) => (
          <OptionRow
            key={opt.id}
            opt={opt}
            scoring={topicScoring}
            onChange={(o) => updateOption(opt.id, o)}
            onDelete={() => deleteOption(opt.id)}
            isOnly={q.options.length <= 1}
          />
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addOption} style={{ marginTop: 8, fontSize: 12 }}>
          <Icon name="plus" size={13} /> Agregar opción
        </button>
      </div>
    </div>
  );
}

// ---- Topic card ----
function TopicCard({ topic, onChange, onDelete }: {
  topic: Topic; onChange: (t: Topic) => void; onDelete: () => void;
}) {
  function updateQuestion(qId: string, q: Question) {
    onChange({ ...topic, questions: topic.questions.map((x) => x.id === qId ? q : x) });
  }
  function deleteQuestion(qId: string) {
    onChange({ ...topic, questions: topic.questions.filter((x) => x.id !== qId) });
  }
  function addQuestion() {
    onChange({ ...topic, questions: [...topic.questions, blankQuestion()] });
  }

  return (
    <div className="card fade-up" style={{ marginBottom: 18, overflow: "visible" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)", borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
          <QuestionCard
            key={q.id}
            q={q}
            topicScoring={topic.scoring}
            index={i}
            onChange={(updated) => updateQuestion(q.id, updated)}
            onDelete={() => deleteQuestion(q.id)}
          />
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addQuestion}>
          <Icon name="plus" size={14} /> Agregar pregunta
        </button>
      </div>
    </div>
  );
}

// ---- Condition row ----
function ConditionRow({ cond, topics, onChange, onDelete, canDelete }: {
  cond: Condition; topics: Topic[]; onChange: (c: Condition) => void; onDelete: () => void; canDelete: boolean;
}) {
  const operatorLabels: Record<string, string> = { below: "≤", above: "≥", between: "entre" };
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

  return (
    <div className="card fade-up" style={{ marginBottom: 16 }}>
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
function TemasTab({ test, onUpdate }: { test: TestSummary; onUpdate: (patch: Partial<TestSummary>) => void }) {
  const { tests } = useStore();
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tests]);

  const topics: Topic[] = test.topics || [];

  function updateTopic(id: string, updated: Topic) {
    onUpdate({ topics: topics.map((t) => t.id === id ? updated : t) });
  }
  function deleteTopic(id: string) {
    onUpdate({ topics: topics.filter((t) => t.id !== id) });
  }
  function addTopic() {
    onUpdate({ topics: [...topics, blankTopic()] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Temas</h2>
          <span className="badge">{topics.length} tema{topics.length !== 1 ? "s" : ""}</span>
        </div>
        {topics.length === 0 && (
          <EmptyState icon="layers" title="Sin temas" sub="Agrega un tema para comenzar a estructurar el cuestionario." />
        )}
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onChange={(updated) => updateTopic(topic.id, updated)}
            onDelete={() => deleteTopic(topic.id)}
          />
        ))}
        <button type="button" className="btn btn-secondary" onClick={addTopic}>
          <Icon name="plus" size={15} /> Agregar tema
        </button>
      </div>
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
function MarcaTab({ test, onUpdate }: { test: TestSummary; onUpdate: (patch: Partial<TestSummary>) => void }) {
  const branding: Branding = test.branding || { coverColor: test.accent || "#1f8a5b", accent: test.accent || "#1f8a5b", orgName: "", thankYou: "Gracias por completar la evaluación." };

  function updateBranding(patch: Partial<Branding>) {
    onUpdate({ branding: { ...branding, ...patch } });
  }

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
              onChange={(e) => { updateBranding({ accent: e.target.value }); onUpdate({ accent: e.target.value }); }}
              style={{ width: 46, height: 36, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", cursor: "pointer", padding: 3 }}
            />
            <input
              className="input input-mono"
              value={branding.accent || "#1f8a5b"}
              onChange={(e) => { updateBranding({ accent: e.target.value }); onUpdate({ accent: e.target.value }); }}
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
      </div>

      {/* Preview */}
      <div style={{ position: "sticky", top: 80 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Vista previa</div>
        <div className="card" style={{ overflow: "hidden", borderRadius: "var(--r-lg)" }}>
          {/* Cover strip */}
          <div style={{ height: 80, background: branding.coverColor || "#1f8a5b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {branding.orgName && (
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-.02em" }}>{branding.orgName}</span>
            )}
          </div>
          <div style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: "var(--ink)" }}>{test.name}</h3>
            {test.description && <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45, marginBottom: 12 }}>{test.description}</p>}
            <button type="button" className="btn btn-sm" style={{ background: branding.accent || "#1f8a5b", color: "#fff", fontSize: 13 }}>
              Comenzar evaluación
            </button>
            <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-3)", marginBottom: 4 }}>Mensaje final</div>
              {branding.thankYou || "Gracias por completar la evaluación."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main builder ----
export default function BuilderPage({ testId, nav, toast }: { testId: string; nav: NavFn; toast: ToastFn }) {
  const store = useStore();
  const storeTest = store.getTest(testId);
  const [test, setTest] = useState<TestSummary | null>(storeTest || null);
  const [tab, setTab] = useState<TabId>("temas");
  const [shareOpen, setShareOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<TestSummary>>({});

  // Sync from store when it refreshes (only when no pending local changes)
  useEffect(() => {
    if (storeTest && !saveTimer.current) {
      setTest(storeTest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeTest]);

  // Init from store on first load
  useEffect(() => {
    if (!test && storeTest) setTest(storeTest);
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
      try {
        await store.updateTest(testId, toSave);
        toast("Guardado", "check2");
      } catch {
        toast("Error al guardar", "alert");
      }
    }, delay);
  }, [store, testId, toast]);

  const handleUpdate = useCallback((patch: Partial<TestSummary>, immediate = false) => {
    setTest((prev) => prev ? { ...prev, ...patch } : prev);
    scheduleSave(patch, immediate);
  }, [scheduleSave]);

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

  return (
    <PageWrap maxWidth="var(--maxw)">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => nav("dashboard")} title="Volver">
          <Icon name="back" size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineInput
            value={test.name}
            onChange={(v) => handleUpdate({ name: v })}
            placeholder="Nombre del cuestionario"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {test._latestVersion != null && (
            <span className="badge mono" title="Versión publicada del instrumento" style={{ fontSize: 11 }}>
              v{test._latestVersion}
            </span>
          )}
          <Seg
            options={[{ label: "Borrador", value: "borrador" }, { label: "Publicado", value: "publicado" }]}
            value={test.status || "borrador"}
            onChange={(v) => handleUpdate({ status: v }, true)}
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
      {tab === "temas" && <TemasTab test={test} onUpdate={(patch) => handleUpdate(patch)} />}
      {tab === "soluciones" && <SolucionesTab test={test} onUpdate={(patch) => handleUpdate(patch, true)} />}
      {tab === "distribucion" && <DistribucionTab test={test} testId={testId} toast={toast} onShare={() => setShareOpen(true)} />}
      {tab === "marca" && <MarcaTab test={test} onUpdate={(patch) => handleUpdate(patch)} />}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        testName={test.name}
        accent={test.branding?.accent || test.accent}
        toast={toast}
      />
    </PageWrap>
  );
}
