"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "@/components/store";
import type { TestSummary } from "@/components/store";
import type { Topic, Option } from "@/lib/schema";
import {
  PageWrap, EmptyState, Icon, ScoreBadge, MenuButton, ConfirmModal, Modal,
  Sparkline, SkeletonCard, timeAgo,
} from "@/components/ui";
import type { MenuItem } from "@/components/ui";
import { computeResult, totalQuestions, uid } from "@/lib/scoring";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

const PIN_KEY = "auditoria_pinned_tests";

type SortKey = "newest" | "responses" | "best" | "worst" | "activity" | "alpha";

type TestStat = { count: number; avgScore: number; lastAt: number | null; weekly: number[] };

// ---- Templates ("Crear desde plantilla") ----
function opts(defs: [string, number][]): Option[] {
  const max = Math.max(...defs.map((d) => d[1]));
  return defs.map(([label, points]) => ({ id: uid("o"), label, points, correct: points === max }));
}

function topic(name: string, questions: { text: string; options: Option[] }[]): Topic {
  return {
    id: uid("t"),
    name,
    scoring: "weighted",
    includeInOverall: true,
    weight: 1,
    questions: questions.map((q) => ({ id: uid("q"), text: q.text, options: q.options })),
  };
}

type Template = {
  key: string;
  icon: string;
  name: string;
  description: string;
  tags: string[];
  buildTopics: () => Topic[];
};

const TEMPLATES: Template[] = [
  {
    key: "procesos",
    icon: "clipboard",
    name: "Auditoría de procesos",
    description: "Evalúa la madurez, documentación y cumplimiento de tus procesos internos.",
    tags: ["procesos", "auditoría"],
    buildTopics: () => [
      topic("Documentación de procesos", [
        {
          text: "¿Los procesos clave están documentados y actualizados?",
          options: opts([["Sí, todos documentados y vigentes", 3], ["La mayoría documentados", 2], ["Solo algunos", 1], ["No están documentados", 0]]),
        },
        {
          text: "¿Existe un responsable asignado para cada proceso?",
          options: opts([["Sí, para todos los procesos", 3], ["Solo para los críticos", 2], ["No hay responsables definidos", 0]]),
        },
        {
          text: "¿Se revisan y actualizan los procesos al menos una vez al año?",
          options: opts([["Sí, con calendario de revisión", 3], ["Solo cuando surge un problema", 1], ["No se revisan", 0]]),
        },
      ]),
      topic("Cumplimiento y control", [
        {
          text: "¿Se realizan auditorías internas periódicas?",
          options: opts([["Sí, trimestrales o más frecuentes", 3], ["Una o dos veces al año", 2], ["Solo cuando se exige", 1], ["Nunca", 0]]),
        },
        {
          text: "¿Las no conformidades se registran y se les da seguimiento?",
          options: opts([["Sí, con plan de acción y plazos", 3], ["Se registran pero sin seguimiento", 1], ["No se registran", 0]]),
        },
      ]),
    ],
  },
  {
    key: "clima",
    icon: "users",
    name: "Clima laboral",
    description: "Mide la satisfacción, el compromiso y la comunicación dentro de tu equipo.",
    tags: ["rrhh", "clima laboral"],
    buildTopics: () => [
      topic("Ambiente de trabajo", [
        {
          text: "¿Cómo calificarías el ambiente general de trabajo?",
          options: opts([["Excelente", 3], ["Bueno", 2], ["Regular", 1], ["Malo", 0]]),
        },
        {
          text: "¿Sientes que tu trabajo es reconocido y valorado?",
          options: opts([["Siempre", 3], ["A veces", 2], ["Casi nunca", 1], ["Nunca", 0]]),
        },
        {
          text: "¿Cuentas con los recursos necesarios para hacer bien tu trabajo?",
          options: opts([["Sí, totalmente", 3], ["En su mayoría", 2], ["Faltan recursos clave", 0]]),
        },
      ]),
      topic("Liderazgo y comunicación", [
        {
          text: "¿La comunicación con tu responsable directo es clara y frecuente?",
          options: opts([["Sí, muy clara", 3], ["Aceptable", 2], ["Escasa o confusa", 0]]),
        },
        {
          text: "¿Recibes retroalimentación útil sobre tu desempeño?",
          options: opts([["Sí, de forma regular", 3], ["Solo en evaluaciones anuales", 1], ["No recibo retroalimentación", 0]]),
        },
      ]),
    ],
  },
  {
    key: "tienda",
    icon: "store",
    name: "Checklist de tienda",
    description: "Verifica el estado operativo, la imagen y la atención en tus puntos de venta.",
    tags: ["tiendas", "checklist"],
    buildTopics: () => [
      topic("Imagen y exhibición", [
        {
          text: "¿La fachada y el escaparate están limpios y en buen estado?",
          options: opts([["Sí, impecables", 3], ["Con detalles menores", 2], ["Necesitan mantenimiento", 0]]),
        },
        {
          text: "¿El producto está exhibido según el planograma vigente?",
          options: opts([["Sí, al 100%", 3], ["Con desviaciones menores", 2], ["Desviaciones importantes", 1], ["No se sigue el planograma", 0]]),
        },
      ]),
      topic("Operación y atención", [
        {
          text: "¿El personal porta uniforme e identificación completos?",
          options: opts([["Sí, todo el equipo", 3], ["La mayoría", 2], ["No", 0]]),
        },
        {
          text: "¿Los tiempos de atención en caja son adecuados (menos de 5 min)?",
          options: opts([["Sí, siempre", 3], ["En horas valle solamente", 1], ["No, hay filas constantes", 0]]),
        },
      ]),
    ],
  },
];

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
  stat,
  nav,
  toast,
  onDelete,
  onDuplicate,
  onToggleArchive,
  pinned,
  onTogglePin,
  selectMode,
  selected,
  onToggleSelect,
}: {
  test: TestSummary;
  stat: TestStat;
  nav: NavFn;
  toast: ToastFn;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const qCount = totalQuestions(test.topics || []);
  const [preview, setPreview] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const allQuestions = useMemo(
    () => (test.topics || []).flatMap((t) => t.questions || []),
    [test.topics]
  );

  function copyLink() {
    const url = `${location.origin}/q/${test.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Enlace copiado al portapapeles", "link"),
      () => toast("No se pudo copiar el enlace", "alert")
    );
  }

  const menuItems: MenuItem[] = [
    { label: "Editar", icon: "edit", onClick: () => nav("builder", { testId: test.id }) },
    { label: "Ver respuestas", icon: "eye", onClick: () => nav("responses", { testId: test.id }) },
    ...(test.status === "publicado"
      ? [{ label: "Vista previa", icon: "external", onClick: () => window.open(`${location.origin}/q/${test.id}`, "_blank") } as MenuItem]
      : []),
    { label: "Copiar enlace", icon: "link", onClick: copyLink },
    { label: "Duplicar", icon: "copy", onClick: onDuplicate },
    { label: test.archived ? "Desarchivar" : "Archivar", icon: "archive", onClick: onToggleArchive },
    "divider",
    { label: "Eliminar", icon: "trash", danger: true, onClick: onDelete },
  ];

  return (
    <div
      className="card fade-up"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        transition: "box-shadow .16s, opacity .16s",
        opacity: test.archived ? 0.6 : 1,
        outline: selected ? "2px solid var(--primary)" : "none",
        outlineOffset: -2,
      }}
      onClick={() => (selectMode ? onToggleSelect() : nav("builder", { testId: test.id }))}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--sh-md)";
        if (!selectMode && allQuestions.length > 0) {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setPreview(true), 350);
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--sh-sm)";
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setPreview(false);
      }}
    >
      {/* Accent strip */}
      <div style={{ height: 4, background: test.accent || "var(--primary)", flex: "none" }} />

      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Top row: checkbox + status + domain + star + menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {selectMode && (
            <span
              aria-label={selected ? "Seleccionado" : "No seleccionado"}
              style={{
                width: 18, height: 18, borderRadius: 5, flex: "none",
                border: selected ? "none" : "1.5px solid var(--line-strong)",
                background: selected ? "var(--primary)" : "var(--surface)",
                color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {selected && <Icon name="check" size={12} stroke={3} />}
            </span>
          )}
          <StatusBadge status={test.status} />
          {test.archived && (
            <span className="badge" style={{ fontSize: 11, padding: "2px 8px" }}>
              <Icon name="archive" size={11} /> Archivado
            </span>
          )}
          {test.domain && (
            <span className="eyebrow" style={{ fontSize: 10.5 }}>{test.domain}</span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              title={pinned ? "Quitar de favoritos" : "Fijar como favorito"}
              aria-label={pinned ? "Quitar de favoritos" : "Fijar como favorito"}
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              style={{ width: 28, height: 28, color: pinned ? "var(--warn)" : "var(--ink-3)" }}
            >
              <Icon name="star" size={15} style={pinned ? { fill: "currentColor" } : undefined} />
            </button>
            <MenuButton items={menuItems} size={28} />
          </div>
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
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{stat.count} resp.</span>
          </div>
          {stat.count > 0 && (
            <div style={{ marginLeft: "auto" }}>
              <ScoreBadge value={stat.avgScore} withLabel={false} />
            </div>
          )}
        </div>
      </div>

      {/* Footer: last response + sparkline */}
      <div style={{ padding: "9px 18px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", minWidth: 0 }}>
          <Icon name="clock" size={13} />
          <span className="clamp-1" style={{ fontSize: 12, fontWeight: 600 }}>
            {stat.lastAt ? `Última respuesta ${timeAgo(new Date(stat.lastAt))}` : "Sin respuestas"}
          </span>
        </div>
        <div style={{ marginLeft: "auto", flex: "none" }} title="Respuestas por semana (últimas 8 semanas)">
          <Sparkline values={stat.weekly} width={84} height={24} color={test.accent || "var(--primary)"} />
        </div>
      </div>

      {/* Hover preview popover (non-blocking) */}
      {preview && (
        <div
          style={{
            position: "absolute", left: 10, right: 10, bottom: 12, zIndex: 6,
            pointerEvents: "none",
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 10, boxShadow: "var(--sh-md)", padding: "10px 12px",
          }}
        >
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Preguntas</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {allQuestions.slice(0, 3).map((q) => (
              <li key={q.id} className="clamp-1" style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.35 }}>
                {q.text}
              </li>
            ))}
          </ol>
          {allQuestions.length > 3 && (
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6, fontWeight: 600 }}>
              y {allQuestions.length - 3} más…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Template gallery (empty state) ----
function TemplateGallery({
  creating,
  onTemplate,
  onBlank,
}: {
  creating: boolean;
  onTemplate: (tpl: Template) => void;
  onBlank: () => void;
}) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", marginBottom: 12 }}>
          <Icon name="clipboard" size={24} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800 }}>Aún no hay cuestionarios</h3>
        <p style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 6 }}>
          Empieza con una plantilla lista para usar o crea uno desde cero.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.key}
            className="card"
            disabled={creating}
            onClick={() => onTemplate(tpl)}
            style={{
              textAlign: "left", padding: 18, display: "flex", flexDirection: "column", gap: 10,
              cursor: creating ? "wait" : "pointer", transition: "box-shadow .16s",
              border: "1px solid var(--line)", background: "var(--surface)", font: "inherit", color: "var(--ink)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--sh-md)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--sh-sm)")}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={tpl.icon} size={20} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>{tpl.name}</div>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>{tpl.description}</p>
            <span style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="plus" size={13} /> Usar plantilla
            </span>
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onBlank} disabled={creating}>
          <Icon name="doc" size={15} />
          {creating ? "Creando…" : "Crear en blanco"}
        </button>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function DashboardPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, loading, createTest, updateTest, deleteTest, duplicateTest } = useStore();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "grouped">("grid");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Single delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TestSummary | null>(null);

  // Load pinned favorites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setPinned(arr.filter((x) => typeof x === "string"));
      }
    } catch { /* ignore */ }
  }, []);

  function togglePin(id: string) {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const archivedCount = useMemo(() => tests.filter((t) => t.archived).length, [tests]);

  // Base list respecting the archived toggle (drives tag chips + counts)
  const baseTests = useMemo(
    () => (showArchived ? tests : tests.filter((t) => !t.archived)),
    [tests, showArchived]
  );

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    baseTests.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [baseTests]);

  // Per-test response stats (count, avg, last response, weekly sparkline)
  const testStats = useMemo(() => {
    const map: Record<string, TestStat> = {};
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    tests.forEach((test) => {
      const testResponses = responses.filter((r) => r.testId === test.id);
      let scoreSum = 0;
      let lastAt: number | null = null;
      const weekly = new Array(8).fill(0) as number[];
      testResponses.forEach((r) => {
        const result = computeResult(test.topics || [], test.solutions || [], r.answers || {});
        scoreSum += result.overall;
        const t = r.submittedAt ? new Date(r.submittedAt).getTime() : NaN;
        if (!isNaN(t)) {
          if (lastAt === null || t > lastAt) lastAt = t;
          const w = Math.floor((now - t) / WEEK);
          if (w >= 0 && w < 8) weekly[7 - w]++;
        }
      });
      map[test.id] = {
        count: testResponses.length,
        avgScore: testResponses.length > 0 ? Math.round(scoreSum / testResponses.length) : 0,
        lastAt,
        weekly,
      };
    });
    return map;
  }, [tests, responses]);

  // Filter: archived toggle + tag + search
  const filteredTests = useMemo(() => {
    let list = baseTests;
    if (activeTag) list = list.filter((t) => (t.tags || []).includes(activeTag));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [baseTests, activeTag, search]);

  // Sort (pinned always first)
  const sortedTests = useMemo(() => {
    const arr = [...filteredTests];
    const st = (id: string) => testStats[id];
    arr.sort((a, b) => {
      const ap = pinned.includes(a.id) ? 0 : 1;
      const bp = pinned.includes(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      switch (sortBy) {
        case "responses": return (st(b.id)?.count ?? 0) - (st(a.id)?.count ?? 0);
        case "best": return (st(b.id)?.avgScore ?? 0) - (st(a.id)?.avgScore ?? 0);
        case "worst": return (st(a.id)?.avgScore ?? 0) - (st(b.id)?.avgScore ?? 0);
        case "activity": return (st(b.id)?.lastAt ?? 0) - (st(a.id)?.lastAt ?? 0);
        case "alpha": return a.name.localeCompare(b.name, "es");
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return arr;
  }, [filteredTests, sortBy, pinned, testStats]);

  // Grouped by tag (for grouped view)
  const grouped = useMemo(() => {
    if (viewMode !== "grouped") return null;
    const groups: Record<string, TestSummary[]> = { "Sin etiqueta": [] };
    sortedTests.forEach((test) => {
      if ((test.tags || []).length === 0) {
        groups["Sin etiqueta"].push(test);
      } else {
        (test.tags || []).forEach((tag) => {
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(test);
        });
      }
    });
    Object.keys(groups).forEach((k) => {
      if (groups[k].length === 0) delete groups[k];
    });
    return groups;
  }, [sortedTests, viewMode]);

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

  async function handleCreateFromTemplate(tpl: Template) {
    setCreating(true);
    try {
      const id = await createTest();
      await updateTest(id, {
        name: tpl.name,
        description: tpl.description,
        tags: tpl.tags,
        topics: tpl.buildTopics(),
      });
      toast(`Plantilla "${tpl.name}" creada`, "check2");
      nav("builder", { testId: id });
    } catch {
      toast("Error al crear desde plantilla", "alert");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(id: string) {
    const newId = await duplicateTest(id);
    nav("builder", { testId: newId });
    toast("Cuestionario duplicado", "copy");
  }

  async function handleToggleArchive(test: TestSummary) {
    const next = !test.archived;
    await updateTest(test.id, { archived: next });
    toast(next ? "Cuestionario archivado" : "Cuestionario desarchivado", "archive");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteTest(target.id);
    setPinned((prev) => {
      if (!prev.includes(target.id)) return prev;
      const next = prev.filter((x) => x !== target.id);
      try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast("Cuestionario eliminado", "trash");
  }

  // ---- Bulk selection helpers ----
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  const selectedTests = useMemo(
    () => tests.filter((t) => selected.has(t.id)),
    [tests, selected]
  );

  async function bulkArchive() {
    const ids = Array.from(selected);
    for (const id of ids) await updateTest(id, { archived: true });
    toast(`${ids.length} cuestionario${ids.length !== 1 ? "s" : ""} archivado${ids.length !== 1 ? "s" : ""}`, "archive");
    setSelected(new Set());
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    setBulkDeleteOpen(false);
    for (const id of ids) await deleteTest(id);
    setPinned((prev) => {
      const next = prev.filter((x) => !ids.includes(x));
      try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast(`${ids.length} cuestionario${ids.length !== 1 ? "s" : ""} eliminado${ids.length !== 1 ? "s" : ""}`, "trash");
    setSelected(new Set());
  }

  async function bulkAddTag() {
    const tag = newTag.trim();
    if (!tag) return;
    setTagModalOpen(false);
    setNewTag("");
    for (const t of selectedTests) {
      await updateTest(t.id, { tags: Array.from(new Set([...(t.tags || []), tag])) });
    }
    toast(`Etiqueta "${tag}" añadida a ${selectedTests.length} cuestionario${selectedTests.length !== 1 ? "s" : ""}`, "tag");
    setSelected(new Set());
  }

  function renderGrid(list: TestSummary[]) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {list.map((test) => (
          <TestCard
            key={test.id}
            test={test}
            stat={testStats[test.id] ?? { count: 0, avgScore: 0, lastAt: null, weekly: new Array(8).fill(0) }}
            nav={nav}
            toast={toast}
            onDelete={() => setDeleteTarget(test)}
            onDuplicate={() => handleDuplicate(test.id)}
            onToggleArchive={() => handleToggleArchive(test)}
            pinned={pinned.includes(test.id)}
            onTogglePin={() => togglePin(test.id)}
            selectMode={selectMode}
            selected={selected.has(test.id)}
            onToggleSelect={() => toggleSelect(test.id)}
          />
        ))}
      </div>
    );
  }

  // ---- Loading skeletons ----
  if (loading) {
    return (
      <PageWrap>
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: 220, height: 26, borderRadius: 8 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} lines={4} height={210} />
          ))}
        </div>
      </PageWrap>
    );
  }

  const hasFilters = !!search.trim() || activeTag !== null;

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Cuestionarios</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Evaluaciones</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
            {tests.length} cuestionario{tests.length !== 1 ? "s" : ""} en total
            {archivedCount > 0 ? ` · ${archivedCount} archivado${archivedCount !== 1 ? "s" : ""}` : ""}
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

      {/* Toolbar: search + sort + select + view */}
      {tests.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, maxWidth: 340 }}>
            <Icon
              name="search"
              size={15}
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }}
            />
            <input
              className="input"
              type="text"
              placeholder="Buscar cuestionarios…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, paddingRight: search ? 34 : undefined, width: "100%" }}
            />
            {search && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  border: "none", background: "transparent", cursor: "pointer",
                  color: "var(--ink-3)", display: "flex", alignItems: "center", padding: 4,
                }}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            className="select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Ordenar por"
            style={{ flex: "none", width: "auto" }}
          >
            <option value="newest">Más reciente</option>
            <option value="responses">Más respuestas</option>
            <option value="best">Mejor puntaje</option>
            <option value="worst">Peor puntaje</option>
            <option value="activity">Actividad reciente</option>
            <option value="alpha">Alfabético</option>
          </select>

          {/* Select toggle */}
          <button
            className={"btn btn-sm " + (selectMode ? "btn-primary" : "btn-secondary")}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            style={{ flex: "none" }}
          >
            <Icon name="check2" size={14} /> Seleccionar
          </button>

          {/* View toggle */}
          <div className="seg" style={{ flex: "none", marginLeft: "auto" }}>
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

      {/* Tag filters + archived toggle */}
      {tests.length > 0 && (allTags.length > 0 || archivedCount > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
          <button
            className={"tagchip" + (activeTag === null ? " on" : "")}
            onClick={() => setActiveTag(null)}
          >
            Todos
            <span className="n">{baseTests.length}</span>
          </button>
          {allTags.map((tag) => {
            const count = baseTests.filter((t) => (t.tags || []).includes(tag)).length;
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
          {archivedCount > 0 && (
            <button
              className={"tagchip" + (showArchived ? " on" : "")}
              onClick={() => setShowArchived(!showArchived)}
              title={showArchived ? "Ocultar archivados" : "Mostrar archivados"}
            >
              <Icon name="archive" size={11} />
              Archivados
              <span className="n">{archivedCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Bulk selection bar */}
      {selectMode && tests.length > 0 && (
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 16, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={selected.size === 0} onClick={bulkArchive}>
            <Icon name="archive" size={14} /> Archivar
          </button>
          <button className="btn btn-secondary btn-sm" disabled={selected.size === 0} onClick={() => setTagModalOpen(true)}>
            <Icon name="tag" size={14} /> Añadir etiqueta
          </button>
          <button className="btn btn-danger-ghost btn-sm" disabled={selected.size === 0} onClick={() => setBulkDeleteOpen(true)}>
            <Icon name="trash" size={14} /> Eliminar
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set(sortedTests.map((t) => t.id)))}
          >
            Seleccionar todo
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exitSelectMode}>
            Cancelar
          </button>
        </div>
      )}

      {/* Content */}
      {tests.length === 0 ? (
        <TemplateGallery creating={creating} onTemplate={handleCreateFromTemplate} onBlank={handleCreate} />
      ) : sortedTests.length === 0 ? (
        <EmptyState
          icon={hasFilters ? "search" : "archive"}
          title={hasFilters ? "Sin resultados" : "Nada que mostrar"}
          sub={
            hasFilters
              ? "Ningún cuestionario coincide con la búsqueda o los filtros activos."
              : "Todos los cuestionarios están archivados. Actívalos con el filtro \"Archivados\"."
          }
          action={
            hasFilters ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(""); setActiveTag(null); }}
              >
                Limpiar filtros
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowArchived(true)}>
                <Icon name="archive" size={14} /> Mostrar archivados
              </button>
            )
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
        renderGrid(sortedTests)
      )}

      {/* Single delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `¿Eliminar "${deleteTarget.name}"?` : "¿Eliminar?"}
        message={
          deleteTarget
            ? `Se borrarán sus ${testStats[deleteTarget.id]?.count ?? 0} respuestas. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        danger
      />

      {/* Bulk delete confirm */}
      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
        title={`¿Eliminar ${selected.size} cuestionario${selected.size !== 1 ? "s" : ""}?`}
        message={
          <span>
            Se eliminarán de forma permanente, junto con todas sus respuestas:
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {selectedTests.map((t) => (
                <li key={t.id} style={{ marginBottom: 4 }}>
                  <strong>{t.name}</strong>{" "}
                  <span style={{ color: "var(--ink-3)" }}>
                    ({testStats[t.id]?.count ?? 0} resp.)
                  </span>
                </li>
              ))}
            </ul>
          </span>
        }
        confirmLabel="Eliminar todo"
        danger
      />

      {/* Bulk add tag */}
      <Modal
        open={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        width={420}
        title="Añadir etiqueta"
        sub={`Se aplicará a ${selected.size} cuestionario${selected.size !== 1 ? "s" : ""}`}
      >
        <div style={{ padding: "14px 24px 22px" }}>
          <input
            className="input"
            type="text"
            placeholder="Nombre de la etiqueta…"
            value={newTag}
            autoFocus
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") bulkAddTag(); }}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setTagModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary btn-sm" disabled={!newTag.trim()} onClick={bulkAddTag}>
              <Icon name="tag" size={14} /> Añadir
            </button>
          </div>
        </div>
      </Modal>
    </PageWrap>
  );
}
