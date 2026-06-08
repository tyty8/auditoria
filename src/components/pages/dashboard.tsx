"use client";
import React, { useState, useMemo } from "react";
import { useStore } from "@/components/store";
import type { TestSummary } from "@/components/store";
import { PageWrap, EmptyState, Icon, ScoreBadge } from "@/components/ui";
import { computeResult, totalQuestions } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

// ---- Status badge ----
function StatusBadge({ status }: { status: string }) {
  const isPublished = status === "publicado";
  return (
    <span
      className={isPublished ? "badge badge-good" : "badge"}
      style={{ fontSize: 11, padding: "2px 8px" }}
    >
      <span className="dot" />
      {isPublished ? "Publicado" : "Borrador"}
    </span>
  );
}

// ---- Test card ----
function TestCard({
  test,
  responseCount,
  avgScore,
  nav,
  onDelete,
  onDuplicate,
}: {
  test: TestSummary;
  responseCount: number;
  avgScore: number;
  nav: NavFn;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const qCount = totalQuestions(test.topics || []);

  return (
    <div
      className="card fade-up"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "box-shadow .16s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--sh-md)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--sh-sm)")}
    >
      {/* Accent strip */}
      <div style={{ height: 4, background: test.accent || "var(--primary)", flex: "none" }} />

      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Top row: status + domain */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge status={test.status} />
          {test.domain && (
            <span className="eyebrow" style={{ fontSize: 10.5 }}>{test.domain}</span>
          )}
        </div>

        {/* Name */}
        <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2, color: "var(--ink)", margin: 0 }}>
          {test.name}
        </h3>

        {/* Description */}
        {test.description && (
          <p className="clamp-2" style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>
            {test.description}
          </p>
        )}

        {/* Tags */}
        {(test.tags || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(test.tags || []).map((tag) => (
              <span key={tag} className="tagmini">{tag}</span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Stats row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-3)" }}>
            <Icon name="list" size={14} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{qCount} preg.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-3)" }}>
            <Icon name="users" size={14} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{responseCount} resp.</span>
          </div>
          {responseCount > 0 && (
            <div style={{ marginLeft: "auto" }}>
              <ScoreBadge value={avgScore} withLabel={false} />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", display: "flex", gap: 4, flexWrap: "wrap", background: "var(--surface-2)" }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => nav("builder", { testId: test.id })}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Icon name="edit" size={14} /> Editar
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => nav("responses", { testId: test.id })}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Icon name="eye" size={14} /> Respuestas
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          title="Duplicar"
          onClick={onDuplicate}
        >
          <Icon name="copy" size={14} />
        </button>
        <button
          className="btn btn-danger-ghost btn-sm btn-icon"
          title="Eliminar"
          onClick={onDelete}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function DashboardPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, createTest, deleteTest, duplicateTest } = useStore();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "grouped">("grid");
  const [creating, setCreating] = useState(false);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tests]);

  // Per-test response stats
  const testStats = useMemo(() => {
    const map: Record<string, { count: number; avgScore: number }> = {};
    tests.forEach((test) => {
      const testResponses = responses.filter((r) => r.testId === test.id);
      let scoreSum = 0;
      testResponses.forEach((r) => {
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        scoreSum += result.overall;
      });
      map[test.id] = {
        count: testResponses.length,
        avgScore: testResponses.length > 0 ? Math.round(scoreSum / testResponses.length) : 0,
      };
    });
    return map;
  }, [tests, responses]);

  // Filter tests by active tag
  const filteredTests = useMemo(() => {
    if (!activeTag) return tests;
    return tests.filter((t) => (t.tags || []).includes(activeTag));
  }, [tests, activeTag]);

  // Grouped by tag (for grouped view)
  const grouped = useMemo(() => {
    if (viewMode !== "grouped") return null;
    const groups: Record<string, TestSummary[]> = { "Sin etiqueta": [] };
    filteredTests.forEach((test) => {
      if ((test.tags || []).length === 0) {
        groups["Sin etiqueta"].push(test);
      } else {
        (test.tags || []).forEach((tag) => {
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(test);
        });
      }
    });
    // Remove empty groups
    Object.keys(groups).forEach((k) => {
      if (groups[k].length === 0) delete groups[k];
    });
    return groups;
  }, [filteredTests, viewMode]);

  async function handleCreate() {
    setCreating(true);
    try {
      const id = await createTest();
      nav("builder", { testId: id });
      toast("Cuestionario creado", "check2");
    } catch {
      toast("Error al crear cuestionario", "alert");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cuestionario? Esta acción no se puede deshacer.")) return;
    await deleteTest(id);
    toast("Cuestionario eliminado", "trash");
  }

  async function handleDuplicate(id: string) {
    const newId = await duplicateTest(id);
    nav("builder", { testId: newId });
    toast("Cuestionario duplicado", "copy");
  }

  function renderGrid(list: TestSummary[]) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {list.map((test) => (
          <TestCard
            key={test.id}
            test={test}
            responseCount={testStats[test.id]?.count ?? 0}
            avgScore={testStats[test.id]?.avgScore ?? 0}
            nav={nav}
            onDelete={() => handleDelete(test.id)}
            onDuplicate={() => handleDuplicate(test.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Cuestionarios</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Evaluaciones</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
            {tests.length} cuestionario{tests.length !== 1 ? "s" : ""} en total
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={creating}
          style={{ flex: "none" }}
        >
          <Icon name="plus" size={16} />
          {creating ? "Creando…" : "Nuevo cuestionario"}
        </button>
      </div>

      {/* Controls */}
      {tests.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              <button
                className={"tagchip" + (activeTag === null ? " on" : "")}
                onClick={() => setActiveTag(null)}
              >
                Todos
                <span className="n">{tests.length}</span>
              </button>
              {allTags.map((tag) => {
                const count = tests.filter((t) => (t.tags || []).includes(tag)).length;
                return (
                  <button
                    key={tag}
                    className={"tagchip" + (activeTag === tag ? " on" : "")}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  >
                    <Icon name="tag" size={11} />
                    {tag}
                    <span className="n">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* View toggle */}
          <div className="seg" style={{ flex: "none" }}>
            <button
              className={viewMode === "grid" ? "on" : ""}
              onClick={() => setViewMode("grid")}
            >
              <Icon name="layers" size={14} /> Grid
            </button>
            <button
              className={viewMode === "grouped" ? "on" : ""}
              onClick={() => setViewMode("grouped")}
            >
              <Icon name="tag" size={14} /> Por etiqueta
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredTests.length === 0 && tests.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Aún no hay cuestionarios"
          sub="Crea tu primer cuestionario para comenzar a recopilar respuestas y generar informes."
          action={
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              <Icon name="plus" size={16} />
              {creating ? "Creando…" : "Crear cuestionario"}
            </button>
          }
        />
      ) : filteredTests.length === 0 ? (
        <EmptyState
          icon="tag"
          title={`Sin cuestionarios con etiqueta "${activeTag}"`}
          sub="Prueba filtrando por otra etiqueta o viendo todos."
          action={
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTag(null)}>
              Ver todos
            </button>
          }
        />
      ) : viewMode === "grouped" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {Object.entries(grouped).map(([groupName, groupTests]) => (
            <div key={groupName}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span className="eyebrow">{groupName}</span>
                <span className="badge" style={{ fontSize: 11 }}>{groupTests.length}</span>
              </div>
              {renderGrid(groupTests)}
            </div>
          ))}
        </div>
      ) : (
        renderGrid(filteredTests)
      )}
    </PageWrap>
  );
}
