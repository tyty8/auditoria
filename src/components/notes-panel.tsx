"use client";
import React, { useState, useEffect, useRef } from "react";
import { Icon, timeAgo } from "@/components/ui";

// ---- Markdown-lite renderer (React nodes only — no innerHTML) ----
// Supports **bold**, *italics*, "- " bullet lists and line breaks.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={`${keyBase}-b${k++}`}>{m[1]}</strong>);
    else nodes.push(<em key={`${keyBase}-i${k++}`}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMarkdownLite(src: string): React.ReactNode {
  const lines = src.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  const flushList = (key: string) => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={key} style={{ margin: "4px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 2 }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };
  lines.forEach((line, i) => {
    if (line.startsWith("- ")) {
      listItems.push(<li key={`li-${i}`}>{renderInline(line.slice(2), `li-${i}`)}</li>);
    } else {
      flushList(`ul-${i}`);
      blocks.push(
        <div key={`p-${i}`} style={{ minHeight: line.trim() ? undefined : "0.9em" }}>
          {renderInline(line, `p-${i}`)}
        </div>
      );
    }
  });
  flushList("ul-end");
  return blocks;
}

// Autosaving consultant-notes editor, backed by /api/consultant-notes.
// Used on the entity detail page and the printable report.
export function NotesPanel({ company, mode, rows = 6 }: { company: string; mode: string; rows?: number }) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/consultant-notes?company=${encodeURIComponent(company)}&mode=${mode}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.content) setNotes(d.content);
        if (d?.updatedAt) setUpdatedAt(d.updatedAt);
      })
      .catch(() => {});
  }, [company, mode]);

  function handleChange(val: string) {
    setNotes(val);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/consultant-notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company, mode, content: val }),
        });
        const data = await res.json().catch(() => null);
        if (data?.updatedAt) setUpdatedAt(data.updatedAt);
        setSavedAt(new Date());
        setSaved(true);
      } catch {}
      setSaving(false);
    }, 800);
  }

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      {/* Edit / preview toggle */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div className="seg">
          <button type="button" className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>
            <Icon name="edit" size={13} /> Editar
          </button>
          <button type="button" className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>
            <Icon name="eye" size={13} /> Vista
          </button>
        </div>
      </div>

      {view === "edit" ? (
        <textarea
          className="input no-print"
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Escribe notas privadas del consultor para esta entidad. Se guardan automáticamente. Soporta **negrita**, *cursiva* y listas con «- »."
          rows={rows}
          style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit" }}
        />
      ) : (
        <div
          className="no-print"
          style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", minHeight: rows * 1.6 * 13.5, padding: "4px 2px" }}
        >
          {notes.trim() ? renderMarkdownLite(notes) : <span style={{ color: "var(--ink-3)" }}>Sin notas todavía.</span>}
        </div>
      )}

      {/* Print view renders the text as prose instead of a textarea */}
      <div className="print-only" style={{ display: "none", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {notes || "—"}
      </div>
      <div className="no-print" style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
        {saving ? (
          <>
            <Icon name="clock" size={13} />
            <span>Guardando…</span>
          </>
        ) : saved && savedAt ? (
          <>
            <Icon name="check2" size={13} style={{ color: "var(--good)" }} />
            <span style={{ color: "var(--good)" }}>Guardado {timeAgo(savedAt)}</span>
          </>
        ) : savedAt ? (
          <span>Guardado {timeAgo(savedAt)}</span>
        ) : updatedAt ? (
          <span>Última edición {timeAgo(updatedAt)}</span>
        ) : (
          "Se guarda automáticamente al escribir"
        )}
      </div>
    </div>
  );
}
