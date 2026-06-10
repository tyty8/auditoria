"use client";
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui";

// Autosaving consultant-notes editor, backed by /api/consultant-notes.
// Used on the entity detail page and the printable report.
export function NotesPanel({ company, mode, rows = 6 }: { company: string; mode: string; rows?: number }) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!company) return;
    fetch(`/api/consultant-notes?company=${encodeURIComponent(company)}&mode=${mode}`)
      .then((r) => r.json())
      .then((d) => { if (d?.content) setNotes(d.content); })
      .catch(() => {});
  }, [company, mode]);

  function handleChange(val: string) {
    setNotes(val);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch("/api/consultant-notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company, mode, content: val }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {}
    }, 800);
  }

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <textarea
        className="input no-print"
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Escribe notas privadas del consultor para esta entidad. Se guardan automáticamente."
        rows={rows}
        style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit" }}
      />
      {/* Print view renders the text as prose instead of a textarea */}
      <div className="print-only" style={{ display: "none", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {notes || "—"}
      </div>
      <div className="no-print" style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
        {saved ? (
          <>
            <Icon name="check2" size={13} style={{ color: "var(--good)" }} />
            <span style={{ color: "var(--good)" }}>Guardado</span>
          </>
        ) : (
          "Se guarda automáticamente al escribir"
        )}
      </div>
    </div>
  );
}
