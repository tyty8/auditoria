"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "@/components/store";
import type { TaskActionRow } from "@/components/store";
import { Icon, Avatar, EmptyState, PageWrap } from "@/components/ui";
import { computeResult, SCORE_HEX, scoreBucket } from "@/lib/scoring";
import type { Solution } from "@/lib/schema";

type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

type ViewMode = "by-entity" | "by-solution";
type TabId = "open" | "done";
type TaskStatus = "pendiente" | "en_curso" | "hecho";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  hecho: "Hecho",
};

type TaskPriority = "alta" | "media" | "baja";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(taskRow: TaskActionRow | undefined): boolean {
  if (!taskRow?.dueDate) return false;
  if (taskRow.status === "hecho") return false;
  return taskRow.dueDate < todayStr();
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

export default function SolucionesPage({ nav, toast }: { nav: NavFn; toast: ToastFn }) {
  const { tests, responses, taskActions, upsertTaskAction, modeConfig } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>("by-entity");
  const [tab, setTab] = useState<TabId>("open");
  const [showDoneForEntity, setShowDoneForEntity] = useState<Record<string, boolean>>({});
  const [completedSearch, setCompletedSearch] = useState("");
  const [completedSort, setCompletedSort] = useState<"name" | "score" | "actions">("name");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("auditoria_sol_view");
      if (v === "by-entity" || v === "by-solution") setViewMode(v);
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

  async function updateTask(action: EntityAction, patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "dueDate" | "priority">>) {
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
    if (patch.status === "hecho") toast("Marcado como hecho", "check2");
  }

  async function updateTaskStatus(action: EntityAction, status: TaskStatus) {
    await updateTask(action, { status });
  }

  async function updateTaskAssignee(action: EntityAction, assignee: string) {
    await updateTask(action, { assignee });
  }

  const allOpenActions = allActions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) !== "hecho");
  const overdueCount = allOpenActions.filter((a) => isOverdue(a.taskRow)).length;
  const openActions = overdueOnly ? allOpenActions.filter((a) => isOverdue(a.taskRow)) : allOpenActions;
  const doneActions = allActions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) === "hecho");

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
    const allEntityNames = new Set(allActions.map((a) => a.entityName));
    return [...allEntityNames].filter((name) => {
      const entityActions = allActions.filter((a) => a.entityName === name);
      return entityActions.length > 0 && entityActions.every((a) => (a.taskRow?.status as TaskStatus | undefined) === "hecho");
    });
  }, [allActions]);

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

  const openEntityNames = Object.keys(openByEntity).sort();
  const entityLabel = modeConfig.groupNounPlural;

  if (modeConfig.id === "clientes") {
    return (
      <PageWrap>
        <EmptyState icon="clipboard" title="Soluciones no disponible en modo Clientes" sub="Esta sección está disponible en modo Tiendas o Empleados." />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{modeConfig.menuTitle}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Tablero de acciones</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          Gestiona las soluciones recomendadas como tareas para cada {modeConfig.groupNoun}.
        </p>
      </div>

      {/* View toggle + tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={viewMode === "by-entity" ? "on" : ""} onClick={() => setView("by-entity")}>
            <Icon name={modeConfig.icon} size={13} /> Por {modeConfig.groupNoun}
          </button>
          <button className={viewMode === "by-solution" ? "on" : ""} onClick={() => setView("by-solution")}>
            <Icon name="spark" size={13} /> Por solución
          </button>
        </div>

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
      </div>

      {/* Open tab */}
      {tab === "open" && (
        <>
          {openActions.length === 0 ? (
            <EmptyState icon="check2" title="¡Todo listo!" sub="No hay acciones pendientes. Todas las soluciones están completadas." />
          ) : viewMode === "by-entity" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {openEntityNames.map((entityName) => {
                const actions = openByEntity[entityName] || [];
                const doneHere = actions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) === "hecho");
                const pendingHere = actions.filter((a) => (a.taskRow?.status as TaskStatus | undefined) !== "hecho");
                const showDone = showDoneForEntity[entityName] || false;
                const entityResponses = responses.filter((r) => (r.company || "Sin asignar") === entityName);
                let avgScore = 0;
                if (entityResponses.length > 0) {
                  let sum = 0;
                  entityResponses.forEach((r) => {
                    const t = tests.find((x) => x.id === r.testId);
                    if (t) sum += computeResult(t.topics || [], t.solutions || [], r.answers || {}).overall;
                  });
                  avgScore = Math.round(sum / entityResponses.length);
                }
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
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", borderRadius: 8, background: SCORE_HEX[bucket] + "22", color: SCORE_HEX[bucket] }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{avgScore}</span>
                      </div>
                    </div>

                    <div style={{ padding: "10px 0" }}>
                      {pendingHere.map((action) => (
                        <ActionItem key={action.key} action={action} onUpdateStatus={updateTaskStatus} onUpdateAssignee={updateTaskAssignee} onUpdateTask={updateTask} />
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
                            <ActionItem key={action.key} action={action} onUpdateStatus={updateTaskStatus} onUpdateAssignee={updateTaskAssignee} onUpdateTask={updateTask} done />
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
                    {entities.map((action) => (
                      <div key={action.key} style={{ padding: "9px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line)" }}>
                        <Avatar name={action.entityName} size={28} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{action.entityName}</span>
                        <StatusSelect
                          value={(action.taskRow?.status as TaskStatus) || "pendiente"}
                          onChange={(s) => updateTaskStatus(action, s)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed tab */}
      {tab === "done" && (
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
                        <ActionItem key={action.key} action={action} onUpdateStatus={updateTaskStatus} onUpdateAssignee={updateTaskAssignee} onUpdateTask={updateTask} done />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageWrap>
  );
}

// ---- Action item row ----
function ActionItem({
  action,
  onUpdateStatus,
  onUpdateAssignee,
  onUpdateTask,
  done = false,
}: {
  action: EntityAction;
  onUpdateStatus: (a: EntityAction, s: TaskStatus) => void;
  onUpdateAssignee: (a: EntityAction, assignee: string) => void;
  onUpdateTask: (a: EntityAction, patch: Partial<Pick<TaskActionRow, "status" | "assignee" | "dueDate" | "priority">>) => void;
  done?: boolean;
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
            {action.solution.name}
          </span>
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
