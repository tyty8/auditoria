"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "@/components/store";
import type { TaskActionRow, ActionCommentRow } from "@/components/store";
import { Icon, Avatar, EmptyState, PageWrap, Drawer, Skeleton, SkeletonCard, timeAgo } from "@/components/ui";
import { computeResult, SCORE_HEX, scoreBucket, uid } from "@/lib/scoring";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type ViewMode = "by-entity" | "by-solution" | "kanban";
type TabId = "open" | "done";
type TaskStatus = "pendiente" | "en_curso" | "hecho";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  hecho: "Hecho",
};

const STATUS_ORDER: TaskStatus[] = ["pendiente", "en_curso", "hecho"];

type TaskPriority = "alta" | "media" | "baja";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { alta: 0, media: 1, baja: 2 };

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  alta: "var(--bad)",
  media: "var(--warn)",
  baja: "var(--ink-3)",
};

type OpenSort = "vencidas" | "prioridad" | "score" | "nombre";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isOverdue(taskRow: TaskActionRow | undefined): boolean {
  if (!taskRow?.dueDate) return false;
  if (taskRow.status === "hecho") return false;
  return taskRow.dueDate < todayStr();
}

function fmtDue(due: string): string {
  const d = new Date(due + "T00:00:00");
  if (isNaN(d.getTime())) return due;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

type EntityAction = {
  key: string;
  entityName: string;
  testId: string;
  solutionId: string;
  solution: Solution;
  testName: string;
  taskRow: TaskActionRow | undefined;
};

function actionPriority(a: EntityAction): TaskPriority {
  return (a.taskRow?.priority as TaskPriority) || "media";
}

export default function SolucionesPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, taskActions, upsertTaskAction, modeConfig, me, loading } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>("by-entity");
  const [tab, setTab] = useState<TabId>("open");
  const [showDoneForEntity, setShowDoneForEntity] = useState<Record<string, boolean>>({});
  const [completedSearch, setCompletedSearch] = useState("");
  const [completedSort, setCompletedSort] = useState<"name" | "score" | "actions">("name");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [groupByDate, setGroupByDate] = useState(false);
  const [openSort, setOpenSort] = useState<OpenSort>("vencidas");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("auditoria_sol_view");
      if (v === "by-entity" || v === "by-solution" || v === "kanban") setViewMode(v);
    } catch {}
  }, []);

  function setView(v: ViewMode) {
    setViewMode(v);
    try { localStorage.setItem("auditoria_sol_view", v); } catch {}
  }

  const allActions = useMemo((): EntityAction[] => {
    const result: EntityAction[] = [];
    const seen = new Set<string>();
    responses.forEach((r) => {
      const test = tests.find((t) => t.id === r.testId);
      if (!test) return;
      const entityName = r.company || "Sin asignar";
      const computed = computeResult(test.topics || [], test.solutions || [], r.answers || {});
      computed.triggered.forEach((sol) => {
        const key = `${entityName}|${r.testId}|${sol.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const taskRow = taskActions.find(
          (ta) => ta.entityName === entityName && ta.testId === r.testId && ta.solutionId === sol.id
        );
        result.push({ key, entityName, testId: r.testId, solutionId: sol.id, solution: sol, testName: test.name, taskRow });
      });
    });
    return result;
  }, [tests, responses, taskActions]);

  // Distinct assignees (from persisted task actions)
  const assigneeOptions = useMemo(() => {
    const s = new Set<string>();
    taskActions.forEach((t) => { if (t.assignee) s.add(t.assignee); });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [taskActions]);

  function matchesAssignee(a: EntityAction): boolean {
    if (assigneeFilter === "all") return true;
    const asg = a.taskRow?.assignee || "";
    if (assigneeFilter === "__none") return !asg;
    if (assigneeFilter === "__me") return !!me?.name && asg === me.name;
    return asg === assigneeFilter;
  }

  // Average score per entity
  const entityScores = useMemo(() => {
    const m: Record<string, number> = {};
    const byEntity: Record<string, number[]> = {};
    responses.forEach((r) => {
      const t = tests.find((x) => x.id === r.testId);
      if (!t) return;
      const name = r.company || "Sin asignar";
      if (!byEntity[name]) byEntity[name] = [];
      byEntity[name].push(computeResult(t.topics || [], t.solutions || [], r.answers || {}).overall);
    });
    Object.entries(byEntity).forEach(([name, scores]) => {
      m[name] = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
    });
    return m;
  }, [responses, tests]);

  // Core persist (no toast) — preserves all existing fields, never touches comments
  async function persistTask(action: EntityAction, patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "dueDate" | "priority">>) {
    const existing = action.taskRow;
    await upsertTaskAction({
      id: existing?.id,
      entityName: action.entityName,
      testId: action.testId,
      solutionId: action.solutionId,
      status: patch.status ?? ((existing?.status as TaskStatus) || "pendiente"),
      assignee: patch.assignee !== undefined ? patch.assignee : (existing?.assignee || null),
      dueDate: patch.dueDate !== undefined ? patch.dueDate : (existing?.dueDate || null),
      priority: patch.priority !== undefined ? patch.priority : (existing?.priority || "media"),
    });
  }

  async function updateTask(action: EntityAction, patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "dueDate" | "priority">>) {
    await persistTask(action, patch);
    if (patch.status === "hecho") toast("Marcado como hecho", "check2");
  }

  async function updateTaskStatus(action: EntityAction, status: TaskStatus) {
    await updateTask(action, { status });
  }

  async function updateTaskAssignee(action: EntityAction, assignee: string) {
    await updateTask(action, { assignee });
  }

  // Comments
  async function addComment(action: EntityAction, text: string) {
    const existing = action.taskRow;
    const newComment: ActionCommentRow = {
      id: uid("cm"),
      text,
      author: me?.name || "Consultor",
      at: new Date().toISOString(),
    };
    await upsertTaskAction({
      id: existing?.id,
      entityName: action.entityName,
      testId: action.testId,
      solutionId: action.solutionId,
      status: (existing?.status as TaskStatus) || "pendiente",
      assignee: existing?.assignee || null,
      dueDate: existing?.dueDate || null,
      priority: existing?.priority || "media",
      comments: [...(existing?.comments || []), newComment],
    });
    toast("Comentario agregado", "comment");
  }

  async function deleteComment(action: EntityAction, commentId: string) {
    const existing = action.taskRow;
    if (!existing) return;
    await upsertTaskAction({
      id: existing.id,
      entityName: action.entityName,
      testId: action.testId,
      solutionId: action.solutionId,
      status: (existing.status as TaskStatus) || "pendiente",
      assignee: existing.assignee || null,
      dueDate: existing.dueDate || null,
      priority: existing.priority || "media",
      comments: (existing.comments || []).filter((c) => c.id !== commentId),
    });
    toast("Comentario eliminado", "check2");
  }

  // Bulk
  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function bulkApply(patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "priority">>) {
    const targets = allActions.filter((a) => selectedKeys.has(a.key));
    if (targets.length === 0) return;
    for (const a of targets) await persistTask(a, patch);
    toast(`${targets.length} acción${targets.length !== 1 ? "es" : ""} actualizada${targets.length !== 1 ? "s" : ""}`, "check2");
  }

  const visibleActions = allActions.filter(matchesAssignee);
  const allOpenActions = visibleActions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) !== "hecho");
  const overdueCount = allOpenActions.filter((a) => isOverdue(a.taskRow)).length;
  const openActions = overdueOnly ? allOpenActions.filter((a) => isOverdue(a.taskRow)) : allOpenActions;
  const doneActions = visibleActions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) === "hecho");

  const openByEntity = useMemo(() => {
    const map: Record<string, EntityAction[]> = {};
    openActions.forEach((a) => {
      if (!map[a.entityName]) map[a.entityName] = [];
      map[a.entityName].push(a);
    });
    return map;
  }, [openActions]);

  const doneByEntity = useMemo(() => {
    const map: Record<string, EntityAction[]> = {};
    doneActions.forEach((a) => {
      if (!map[a.entityName]) map[a.entityName] = [];
      map[a.entityName].push(a);
    });
    return map;
  }, [doneActions]);

  const openBySolution = useMemo(() => {
    const map: Record<string, { solution: Solution; testName: string; entities: EntityAction[] }> = {};
    openActions.forEach((a) => {
      const key = a.solution.id;
      if (!map[key]) map[key] = { solution: a.solution, testName: a.testName, entities: [] };
      map[key].entities.push(a);
    });
    return map;
  }, [openActions]);

  const completedEntities = useMemo(() => {
    const allEntityNames = new Set(visibleActions.map((a) => a.entityName));
    return [...allEntityNames].filter((name) => {
      const entityActions = visibleActions.filter((a) => a.entityName === name);
      return entityActions.length > 0 && entityActions.every((a) => (a.taskRow?.status as TaskStatus | undefined) === "hecho");
    });
  }, [visibleActions]);

  const filteredCompleted = useMemo(() => {
    let list = completedEntities;
    if (completedSearch) list = list.filter((n) => n.toLowerCase().includes(completedSearch.toLowerCase()));
    if (completedSort === "name") list = [...list].sort((a, b) => a.localeCompare(b));
    if (completedSort === "actions") {
      list = [...list].sort((a, b) => {
        const ca = doneByEntity[b]?.length || 0;
        const cb = doneByEntity[a]?.length || 0;
        return ca - cb;
      });
    }
    return list;
  }, [completedEntities, completedSearch, completedSort, doneByEntity]);

  // Entity ordering for the open view, honoring sort option
  const openEntityNames = useMemo(() => {
    const names = Object.keys(openByEntity);
    const overdueOf = (n: string) => (openByEntity[n] || []).filter((a) => isOverdue(a.taskRow)).length;
    const altaOf = (n: string) => (openByEntity[n] || []).filter((a) => actionPriority(a) === "alta").length;
    if (openSort === "vencidas") return names.sort((a, b) => overdueOf(b) - overdueOf(a) || a.localeCompare(b));
    if (openSort === "prioridad") return names.sort((a, b) => altaOf(b) - altaOf(a) || a.localeCompare(b));
    if (openSort === "score") return names.sort((a, b) => (entityScores[a] ?? 0) - (entityScores[b] ?? 0) || a.localeCompare(b));
    return names.sort((a, b) => a.localeCompare(b));
  }, [openByEntity, openSort, entityScores]);

  function sortActionList(list: EntityAction[]): EntityAction[] {
    const copy = [...list];
    if (openSort === "prioridad") {
      copy.sort((a, b) => PRIORITY_RANK[actionPriority(a)] - PRIORITY_RANK[actionPriority(b)] || a.solution.name.localeCompare(b.solution.name));
    } else if (openSort === "nombre") {
      copy.sort((a, b) => a.solution.name.localeCompare(b.solution.name));
    } else {
      // "vencidas" (default) and "score": overdue first, then nearest due date
      copy.sort((a, b) => {
        const oa = isOverdue(a.taskRow) ? 0 : 1;
        const ob = isOverdue(b.taskRow) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return (a.taskRow?.dueDate || "9999-99-99").localeCompare(b.taskRow?.dueDate || "9999-99-99");
      });
    }
    return copy;
  }

  // Due-date grouping (open tab, by-entity view)
  const dateGroups = useMemo(() => {
    const today = todayStr();
    const weekEnd = plusDaysStr(7);
    const groups: { id: string; label: string; color?: string; items: EntityAction[] }[] = [
      { id: "overdue", label: "Vencidas", color: "var(--bad)", items: [] },
      { id: "week", label: "Esta semana", items: [] },
      { id: "later", label: "Próximas", items: [] },
      { id: "nodate", label: "Sin fecha", items: [] },
    ];
    openActions.forEach((a) => {
      const due = a.taskRow?.dueDate;
      if (!due) groups[3].items.push(a);
      else if (isOverdue(a.taskRow)) groups[0].items.push(a);
      else if (due >= today && due <= weekEnd) groups[1].items.push(a);
      else groups[2].items.push(a);
    });
    groups.forEach((g) => g.items.sort((a, b) => (a.taskRow?.dueDate || "9999-99-99").localeCompare(b.taskRow?.dueDate || "9999-99-99")));
    return groups;
  }, [openActions]);

  // Kanban columns
  const kanbanColumns = useMemo(() => {
    const cols: Record<TaskStatus, EntityAction[]> = { pendiente: [], en_curso: [], hecho: [] };
    const source = overdueOnly ? visibleActions.filter((a) => isOverdue(a.taskRow)) : visibleActions;
    source.forEach((a) => {
      const st = (a.taskRow?.status as TaskStatus) || "pendiente";
      cols[STATUS_ORDER.includes(st) ? st : "pendiente"].push(a);
    });
    (Object.keys(cols) as TaskStatus[]).forEach((k) => {
      cols[k].sort((a, b) => {
        const oa = isOverdue(a.taskRow) ? 0 : 1;
        const ob = isOverdue(b.taskRow) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return PRIORITY_RANK[actionPriority(a)] - PRIORITY_RANK[actionPriority(b)];
      });
    });
    return cols;
  }, [visibleActions, overdueOnly]);

  async function handleKanbanDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const key = e.dataTransfer.getData("text/plain");
    if (!key) return;
    const action = allActions.find((a) => a.key === key);
    if (!action) return;
    const current = (action.taskRow?.status as TaskStatus) || "pendiente";
    if (current === status) return;
    await persistTask(action, { status });
    toast(`Movida a ${STATUS_LABELS[status]}`, status === "hecho" ? "check2" : "kanban");
  }

  const entityLabel = modeConfig.groupNounPlural;
  const commentsAction = commentsFor ? allActions.find((a) => a.key === commentsFor) || null : null;
  const selectedCount = selectedKeys.size;

  if (modeConfig.id === "clientes") {
    return (
      <PageWrap>
        <EmptyState icon="clipboard" title="Soluciones no disponible en modo Clientes" sub="Esta sección está disponible en modo Tiendas o Empleados." />
      </PageWrap>
    );
  }

  if (loading) {
    return (
      <PageWrap>
        <div style={{ marginBottom: 24 }}>
          <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
          <Skeleton width={280} height={26} style={{ marginBottom: 10 }} />
          <Skeleton width={340} height={13} />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
          <Skeleton width={260} height={32} radius={8} />
          <Skeleton width={150} height={32} radius={8} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </div>
      </PageWrap>
    );
  }

  const sharedItemProps = {
    onUpdateStatus: updateTaskStatus,
    onUpdateAssignee: updateTaskAssignee,
    onUpdateTask: updateTask,
    onOpenComments: (key: string) => setCommentsFor(key),
    selectable: selectMode,
    onToggleSelect: toggleSelected,
  };

  return (
    <PageWrap>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Tablero de acciones</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Gestiona las soluciones recomendadas como tareas para cada {modeConfig.groupNoun}.
        </p>
      </div>

      {/* View toggle + filters + tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={viewMode === "by-entity" ? "on" : ""} onClick={() => setView("by-entity")}>
            <Icon name={modeConfig.icon} size={13} /> Por {modeConfig.groupNoun}
          </button>
          <button className={viewMode === "by-solution" ? "on" : ""} onClick={() => setView("by-solution")}>
            <Icon name="spark" size={13} /> Por solución
          </button>
          <button className={viewMode === "kanban" ? "on" : ""} onClick={() => setView("kanban")}>
            <Icon name="kanban" size={13} /> Tablero
          </button>
        </div>

        <select
          className="select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          title="Filtrar por responsable"
          style={{ fontSize: 12.5, width: 160, fontWeight: 600 }}
        >
          <option value="all">Todos</option>
          {me?.name && <option value="__me">Mis tareas</option>}
          <option value="__none">Sin asignar</option>
          {assigneeOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {overdueCount > 0 && (
          <button
            type="button"
            className={"btn btn-sm " + (overdueOnly ? "btn-primary" : "btn-secondary")}
            onClick={() => setOverdueOnly((v) => !v)}
            style={overdueOnly ? {} : { color: "var(--bad)", borderColor: "var(--bad)" }}
          >
            <Icon name="alert" size={13} /> {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
          </button>
        )}

        {viewMode !== "kanban" && (
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--line)" }}>
            {([["open", "Abiertas"], ["done", "Completados"]] as const).map(([id, label]) => {
              const count = id === "open" ? openActions.length : completedEntities.length;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  style={{
                    padding: "7px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: tab === id ? "var(--primary)" : "var(--ink-3)",
                    borderBottom: tab === id ? "2px solid var(--primary)" : "2px solid transparent",
                    marginBottom: -2,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  {label}
                  <span className={tab === id ? "badge badge-info" : "badge"} style={{ fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Open-view controls: sort / date grouping / bulk select */}
      {viewMode !== "kanban" && tab === "open" && openActions.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <select
            className="select"
            value={openSort}
            onChange={(e) => setOpenSort(e.target.value as OpenSort)}
            title="Ordenar"
            style={{ fontSize: 12.5, width: 190, fontWeight: 600 }}
          >
            <option value="vencidas">Vencidas primero</option>
            <option value="prioridad">Prioridad</option>
            <option value="score">Peor puntaje de {modeConfig.groupNoun}</option>
            <option value="nombre">Nombre</option>
          </select>

          {viewMode === "by-entity" && (
            <button
              type="button"
              className={"btn btn-sm " + (groupByDate ? "btn-primary" : "btn-secondary")}
              onClick={() => setGroupByDate((v) => !v)}
            >
              <Icon name="calendar" size={13} /> Por fecha
            </button>
          )}

          <button
            type="button"
            className={"btn btn-sm " + (selectMode ? "btn-primary" : "btn-secondary")}
            onClick={() => {
              setSelectMode((v) => !v);
              setSelectedKeys(new Set());
            }}
          >
            <Icon name="check2" size={13} /> Seleccionar
          </button>
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        visibleActions.length === 0 ? (
          <EmptyState icon="kanban" title="Sin acciones" sub="No hay acciones que coincidan con los filtros actuales." />
        ) : (
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
            {STATUS_ORDER.map((status) => {
              const items = kanbanColumns[status];
              const colColors: Record<TaskStatus, string> = { pendiente: "var(--ink-3)", en_curso: "var(--warn)", hecho: "var(--good)" };
              return (
                <div
                  key={status}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
                  onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                  onDrop={(e) => handleKanbanDrop(e, status)}
                  style={{
                    flex: "1 1 0",
                    minWidth: 250,
                    background: "var(--surface-sunken)",
                    borderRadius: 12,
                    padding: 12,
                    outline: dragOverCol === status ? "2px dashed var(--primary)" : "2px dashed transparent",
                    outlineOffset: -2,
                    transition: "outline-color .12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 2px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: colColors[status], flex: "none" }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{STATUS_LABELS[status]}</span>
                    <span className="badge" style={{ fontSize: 11 }}>{items.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
                    {items.length === 0 && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "18px 8px", border: "1px dashed var(--line)", borderRadius: 10 }}>
                        Arrastra acciones aquí
                      </div>
                    )}
                    {items.map((action) => {
                      const overdue = isOverdue(action.taskRow);
                      const pri = actionPriority(action);
                      const due = action.taskRow?.dueDate;
                      const commentCount = action.taskRow?.comments?.length || 0;
                      return (
                        <div
                          key={action.key}
                          className="card"
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/plain", action.key); e.dataTransfer.effectAllowed = "move"; }}
                          style={{ padding: "10px 12px", cursor: "grab", borderLeft: overdue ? "3px solid var(--bad)" : `3px solid ${PRIORITY_COLORS[pri]}` }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <Icon name="flag" size={13} style={{ color: PRIORITY_COLORS[pri], flex: "none", marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="clamp-2" style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", textDecoration: status === "hecho" ? "line-through" : "none" }}>
                                {action.solution.name}
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{action.entityName}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                            {due && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: overdue ? "var(--bad)" : "var(--ink-3)" }}>
                                <Icon name="calendar" size={12} /> {fmtDue(due)}
                              </span>
                            )}
                            {commentCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setCommentsFor(action.key)}
                                title="Ver comentarios"
                                style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                <Icon name="comment" size={12} /> {commentCount}
                              </button>
                            )}
                            <span style={{ flex: 1 }} />
                            {action.taskRow?.assignee ? (
                              <span title={action.taskRow.assignee}><Avatar name={action.taskRow.assignee} size={20} /></span>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Sin asignar</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Open tab */}
      {viewMode !== "kanban" && tab === "open" && (
        <>
          {openActions.length === 0 ? (
            <EmptyState icon="check2" title="¡Todo listo!" sub="No hay acciones pendientes. Todas las soluciones están completadas." />
          ) : viewMode === "by-entity" && groupByDate ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {dateGroups.map((g) => (
                <div key={g.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {g.id === "overdue" && <Icon name="alert" size={14} style={{ color: "var(--bad)" }} />}
                    {g.id === "week" && <Icon name="clock" size={14} style={{ color: "var(--ink-3)" }} />}
                    {g.id === "later" && <Icon name="calendar" size={14} style={{ color: "var(--ink-3)" }} />}
                    {g.id === "nodate" && <Icon name="dots" size={14} style={{ color: "var(--ink-3)" }} />}
                    <span style={{ fontWeight: 800, fontSize: 14, color: g.color || "var(--ink)" }}>{g.label}</span>
                    <span className={g.id === "overdue" && g.items.length > 0 ? "badge badge-bad" : "badge"} style={{ fontSize: 11 }}>{g.items.length}</span>
                  </div>
                  {g.items.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "8px 4px" }}>Sin acciones en este grupo.</div>
                  ) : (
                    <div className="card" style={{ overflow: "hidden" }}>
                      {g.items.map((action) => (
                        <ActionItem
                          key={action.key}
                          action={action}
                          {...sharedItemProps}
                          selected={selectedKeys.has(action.key)}
                          showEntity
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : viewMode === "by-entity" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {openEntityNames.map((entityName) => {
                const actions = openByEntity[entityName] || [];
                const doneHere = doneByEntity[entityName] || [];
                const pendingHere = sortActionList(actions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) !== "hecho"));
                const showDone = showDoneForEntity[entityName] || false;
                const totalHere = pendingHere.length + doneHere.length;
                const progressPct = totalHere > 0 ? Math.round((doneHere.length / totalHere) * 100) : 0;
                const avgScore = entityScores[entityName] ?? 0;
                const bucket = scoreBucket(avgScore);

                return (
                  <div key={entityName} className="card" style={{ overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
                      <Avatar name={entityName} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{entityName}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>
                          {pendingHere.length} acción{pendingHere.length !== 1 ? "es" : ""} pendiente{pendingHere.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flex: "none" }} className="hide-mobile">
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>
                          {doneHere.length}/{totalHere} completada{totalHere !== 1 ? "s" : ""}
                        </span>
                        <div style={{ width: 110, height: 5, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
                          <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 99, background: progressPct === 100 ? "var(--good)" : "var(--primary)", transition: "width .25s" }} />
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", borderRadius: 8, background: SCORE_HEX[bucket] + "22", color: SCORE_HEX[bucket] }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{avgScore}</span>
                      </div>
                    </div>

                    <div style={{ padding: "10px 0" }}>
                      {pendingHere.map((action) => (
                        <ActionItem
                          key={action.key}
                          action={action}
                          {...sharedItemProps}
                          selected={selectedKeys.has(action.key)}
                        />
                      ))}
                      {doneHere.length > 0 && (
                        <div style={{ padding: "6px 18px" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowDoneForEntity((prev) => ({ ...prev, [entityName]: !showDone }))}
                            style={{ fontSize: 12, color: "var(--ink-3)" }}
                          >
                            <Icon name={showDone ? "chevronDown" : "chevronRight"} size={13} />
                            {showDone ? "Ocultar" : `Mostrar ${doneHere.length} completada${doneHere.length !== 1 ? "s" : ""}`}
                          </button>
                          {showDone && doneHere.map((action) => (
                            <ActionItem
                              key={action.key}
                              action={action}
                              {...sharedItemProps}
                              selected={selectedKeys.has(action.key)}
                              done
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(openBySolution).map(([solId, { solution, testName, entities }]) => (
                <div key={solId} className="card" style={{ overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{solution.name}</span>
                          {solution.category && <span className="tagmini">{solution.category}</span>}
                          <span className="badge" style={{ fontSize: 11 }}>{entities.length} {entityLabel.toLowerCase()}</span>
                        </div>
                        {solution.description && (
                          <p style={{ fontSize: 12.5, color: "var(--ink-2)", margin: 0 }}>{solution.description}</p>
                        )}
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>{testName}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {sortActionList(entities).map((action) => {
                      const commentCount = action.taskRow?.comments?.length || 0;
                      return (
                        <div key={action.key} style={{ padding: "9px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line)" }}>
                          {selectMode && (
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(action.key)}
                              onChange={() => toggleSelected(action.key)}
                              style={{ flex: "none", cursor: "pointer", width: 15, height: 15 }}
                            />
                          )}
                          <Avatar name={action.entityName} size={28} />
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{action.entityName}</span>
                          {isOverdue(action.taskRow) && (
                            <span className="badge badge-bad" style={{ fontSize: 10.5 }}>
                              <Icon name="alert" size={11} /> Atrasada
                            </span>
                          )}
                          <CommentButton count={commentCount} onClick={() => setCommentsFor(action.key)} />
                          <StatusSelect
                            value={(action.taskRow?.status as TaskStatus) || "pendiente"}
                            onChange={(s) => updateTaskStatus(action, s)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed tab */}
      {viewMode !== "kanban" && tab === "done" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 180px" }}>
              <Icon name="search" size={14} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }} />
              <input
                className="input"
                placeholder={`Buscar ${modeConfig.groupNounPlural.toLowerCase()}…`}
                value={completedSearch}
                onChange={(e) => setCompletedSearch(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 13 }}
              />
            </div>
            <div className="seg" style={{ flex: "none" }}>
              <button className={completedSort === "name" ? "on" : ""} onClick={() => setCompletedSort("name")}>Nombre</button>
              <button className={completedSort === "score" ? "on" : ""} onClick={() => setCompletedSort("score")}>Puntaje</button>
              <button className={completedSort === "actions" ? "on" : ""} onClick={() => setCompletedSort("actions")}>Más acciones</button>
            </div>
          </div>

          {filteredCompleted.length === 0 ? (
            <EmptyState icon="check2" title="Sin completados" sub="Las entidades con todas sus acciones completadas aparecerán aquí." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredCompleted.map((entityName) => {
                const done = doneByEntity[entityName] || [];
                return (
                  <div key={entityName} className="card" style={{ overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
                      <Avatar name={entityName} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{entityName}</div>
                        <div style={{ fontSize: 12, color: "var(--good)", marginTop: 1, fontWeight: 600 }}>
                          <Icon name="check2" size={12} style={{ display: "inline", marginRight: 4 }} />
                          {done.length} acción{done.length !== 1 ? "es" : ""} completada{done.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => nav("cliente", { company: entityName })}
                      >
                        <Icon name="refresh" size={13} /> Volver a evaluar
                      </button>
                    </div>
                    <div style={{ padding: "8px 0" }}>
                      {done.map((action) => (
                        <ActionItem
                          key={action.key}
                          action={action}
                          {...sharedItemProps}
                          selectable={false}
                          done
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Bulk selection bar */}
      {selectMode && selectedCount > 0 && (
        <div
          className="card"
          style={{
            position: "sticky",
            bottom: 14,
            zIndex: 20,
            marginTop: 18,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            boxShadow: "0 8px 28px rgba(0,0,0,.18)",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>
            {selectedCount} seleccionada{selectedCount !== 1 ? "s" : ""}
          </span>
          <select
            className="select"
            value=""
            onChange={(e) => { if (e.target.value) bulkApply({ priority: e.target.value as TaskPriority }); }}
            style={{ fontSize: 12, width: 120, fontWeight: 600 }}
          >
            <option value="">Prioridad…</option>
            {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <select
            className="select"
            value=""
            onChange={(e) => { if (e.target.value) bulkApply({ status: e.target.value as TaskStatus }); }}
            style={{ fontSize: 12, width: 120, fontWeight: 600 }}
          >
            <option value="">Estado…</option>
            {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              placeholder="Responsable…"
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && bulkAssignee.trim()) {
                  bulkApply({ assignee: bulkAssignee.trim() });
                  setBulkAssignee("");
                }
              }}
              style={{ fontSize: 12, width: 140 }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!bulkAssignee.trim()}
              onClick={() => { bulkApply({ assignee: bulkAssignee.trim() }); setBulkAssignee(""); }}
            >
              <Icon name="user" size={13} /> Asignar
            </button>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedKeys(new Set())}
            style={{ fontSize: 12, color: "var(--ink-3)" }}
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Comments drawer */}
      <Drawer
        open={!!commentsAction}
        onClose={() => setCommentsFor(null)}
        width={420}
        title={commentsAction?.solution.name || "Comentarios"}
        sub={commentsAction ? `${commentsAction.entityName} · ${commentsAction.testName}` : undefined}
      >
        {commentsAction && (
          <CommentsThread
            action={commentsAction}
            meName={me?.name || null}
            onAdd={(text) => addComment(commentsAction, text)}
            onDelete={(id) => deleteComment(commentsAction, id)}
          />
        )}
      </Drawer>
    </PageWrap>
  );
}

// ---- Comment button ----
function CommentButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Comentarios"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: count > 0 ? "var(--primary)" : "var(--ink-3)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 6,
        flex: "none",
      }}
    >
      <Icon name="comment" size={14} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

// ---- Comments thread (drawer body) ----
function CommentsThread({
  action,
  meName,
  onAdd,
  onDelete,
}: {
  action: EntityAction;
  meName: string | null;
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const comments = action.taskRow?.comments || [];

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {comments.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13, padding: "28px 12px" }}>
          <Icon name="comment" size={22} style={{ display: "inline", marginBottom: 8 }} />
          <div>Sin comentarios todavía. Escribe el primero.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.map((c) => {
            const author = c.author || "Consultor";
            const own = !!meName && author === meName;
            return (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Avatar name={author} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{author}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{timeAgo(c.at)}</span>
                    {own && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        title="Eliminar comentario"
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, lineHeight: 1, padding: 2 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{c.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hr" />

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Escribe un comentario…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ flex: 1, fontSize: 13 }}
          autoFocus
        />
        <button type="button" className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={submit}>
          <Icon name="send" size={13} /> Enviar
        </button>
      </div>
    </div>
  );
}

// ---- Action item row ----
function ActionItem({
  action,
  onUpdateStatus,
  onUpdateAssignee,
  onUpdateTask,
  onOpenComments,
  done = false,
  showEntity = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  action: EntityAction;
  onUpdateStatus: (a: EntityAction, s: TaskStatus) => void;
  onUpdateAssignee: (a: EntityAction, assignee: string) => void;
  onUpdateTask: (a: EntityAction, patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "dueDate" | "priority">>) => void;
  onOpenComments: (key: string) => void;
  done?: boolean;
  showEntity?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (key: string) => void;
}) {
  const [assigneeVal, setAssigneeVal] = useState(action.taskRow?.assignee || "");
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleAssigneeChange(val: string) {
    setAssigneeVal(val);
    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveTimeout(setTimeout(() => onUpdateAssignee(action, val), 600));
  }

  const status = (action.taskRow?.status as TaskStatus) || "pendiente";
  const priority = (action.taskRow?.priority as TaskPriority) || "media";
  const dueDate = action.taskRow?.dueDate || "";
  const overdue = isOverdue(action.taskRow);
  const commentCount = action.taskRow?.comments?.length || 0;

  return (
    <div
      style={{
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--line)",
        opacity: done ? 0.6 : 1,
        background: done ? "var(--surface-sunken)" : "",
        borderLeft: overdue ? "3px solid var(--bad)" : "3px solid transparent",
      }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(action.key)}
          style={{ flex: "none", cursor: "pointer", width: 15, height: 15 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
            {action.solution.name}
          </span>
          {showEntity && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)" }}>
              <Avatar name={action.entityName} size={16} /> {action.entityName}
            </span>
          )}
          {action.solution.category && <span className="tagmini">{action.solution.category}</span>}
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{action.testName}</span>
          {priority === "alta" && !done && (
            <span className="badge badge-bad" style={{ fontSize: 10.5 }}>Alta</span>
          )}
          {overdue && (
            <span className="badge badge-bad" style={{ fontSize: 10.5 }}>
              <Icon name="alert" size={11} /> Atrasada
            </span>
          )}
        </div>
        {action.solution.description && (
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.4 }}>{action.solution.description}</p>
        )}
      </div>
      <CommentButton count={commentCount} onClick={() => onOpenComments(action.key)} />
      <select
        className="input"
        value={priority}
        onChange={(e) => onUpdateTask(action, { priority: e.target.value as TaskPriority })}
        title="Prioridad"
        style={{ width: 84, fontSize: 12, flex: "none", color: priority === "alta" ? "var(--bad)" : priority === "baja" ? "var(--ink-3)" : "var(--warn)", fontWeight: 700 }}
      >
        {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      <input
        className="input"
        type="date"
        value={dueDate}
        onChange={(e) => onUpdateTask(action, { dueDate: e.target.value || null })}
        title="Fecha límite"
        style={{ width: 138, fontSize: 12, flex: "none", color: overdue ? "var(--bad)" : "var(--ink-2)" }}
      />
      <input
        className="input"
        placeholder="Responsable"
        value={assigneeVal}
        onChange={(e) => handleAssigneeChange(e.target.value)}
        style={{ width: 130, fontSize: 12, flex: "none" }}
      />
      <StatusSelect
        value={status}
        onChange={(s) => onUpdateStatus(action, s)}
      />
    </div>
  );
}

// ---- Status selector ----
function StatusSelect({ value, onChange }: { value: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const colors: Record<TaskStatus, string> = {
    pendiente: "var(--ink-3)",
    en_curso: "var(--warn)",
    hecho: "var(--good)",
  };
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      style={{ width: 120, fontSize: 12, color: colors[value], fontWeight: 700, flex: "none" }}
    >
      {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([k, l]) => (
        <option key={k} value={k}>{l}</option>
      ))}
    </select>
  );
}
