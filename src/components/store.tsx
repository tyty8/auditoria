"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ModeId, ModeConfig } from "@/lib/modes";
import { MODE_CONFIG } from "@/lib/modes";
import type { Solution, Branding } from "@/lib/schema";

// ---- types ----
export type TestSummary = {
  id: string; mode: string; name: string; domain?: string; tags: string[];
  description?: string; status: string; accent: string;
  topics: import("@/lib/schema").Topic[];
  solutions: Solution[];
  branding?: Branding | null;
  createdAt: string;
  _responseCount?: number;
  _avgScore?: number;
  invitations?: InvitationRow[];
};

export type ResponseRow = {
  id: string; testId: string; respondent?: string; company?: string;
  email?: string; role?: string; submittedAt?: string; answers: Record<string, string>;
};

export type InvitationRow = {
  id: string; testId: string; name?: string; email?: string;
  company?: string; status: string; sentAt?: string | null;
};

export type TaskActionRow = {
  id: string; testId: string; solutionId: string;
  entityName: string; status: string; assignee?: string | null;
};

// ---- context ----
type StoreCtx = {
  mode: ModeId;
  modeConfig: ModeConfig;
  setMode: (id: ModeId) => void;
  // Tests
  tests: TestSummary[];
  refreshTests: () => Promise<void>;
  getTest: (id: string) => TestSummary | undefined;
  createTest: () => Promise<string>;
  updateTest: (id: string, patch: Partial<TestSummary>) => Promise<void>;
  duplicateTest: (id: string) => Promise<string>;
  deleteTest: (id: string) => Promise<void>;
  // Responses
  responses: ResponseRow[];
  refreshResponses: () => Promise<void>;
  addResponse: (r: Omit<ResponseRow, "id">) => Promise<void>;
  deleteResponse: (id: string) => Promise<void>;
  // Invitations
  addInvitation: (testId: string, inv: Omit<InvitationRow, "id" | "testId">) => Promise<void>;
  updateInvitation: (testId: string, ivId: string, patch: Partial<InvitationRow>) => Promise<void>;
  deleteInvitation: (testId: string, ivId: string) => Promise<void>;
  // Task actions
  taskActions: TaskActionRow[];
  refreshTaskActions: () => Promise<void>;
  upsertTaskAction: (a: Omit<TaskActionRow, "id"> & { id?: string }) => Promise<void>;
};

const StoreContext = createContext<StoreCtx | null>(null);
export const useStore = () => {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
};

function getModeLS(): ModeId {
  try { const v = localStorage.getItem("auditoria_mode"); if (v && MODE_CONFIG[v as ModeId]) return v as ModeId; } catch {}
  return "clientes";
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ModeId>("clientes");
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [taskActions, setTaskActions] = useState<TaskActionRow[]>([]);

  // hydrate mode from localStorage after mount
  useEffect(() => { setModeState(getModeLS()); }, []);

  const setMode = useCallback((id: ModeId) => {
    setModeState(id);
    try { localStorage.setItem("auditoria_mode", id); } catch {}
  }, []);

  const refreshTests = useCallback(async () => {
    const res = await fetch(`/api/tests?mode=${mode}`);
    if (res.ok) setTests(await res.json());
  }, [mode]);

  const refreshResponses = useCallback(async () => {
    const res = await fetch(`/api/responses?mode=${mode}`);
    if (res.ok) setResponses(await res.json());
  }, [mode]);

  const refreshTaskActions = useCallback(async () => {
    const res = await fetch(`/api/task-actions?mode=${mode}`);
    if (res.ok) setTaskActions(await res.json());
  }, [mode]);

  useEffect(() => {
    refreshTests();
    refreshResponses();
    refreshTaskActions();
  }, [refreshTests, refreshResponses, refreshTaskActions]);

  const getTest = useCallback((id: string) => tests.find((t) => t.id === id), [tests]);

  const createTest = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/tests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const t = await res.json();
    await refreshTests();
    return t.id;
  }, [mode, refreshTests]);

  const updateTest = useCallback(async (id: string, patch: Partial<TestSummary>) => {
    await fetch(`/api/tests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    await refreshTests();
  }, [refreshTests]);

  const duplicateTest = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`/api/tests/${id}/duplicate`, { method: "POST" });
    const t = await res.json();
    await refreshTests();
    return t.id;
  }, [refreshTests]);

  const deleteTest = useCallback(async (id: string) => {
    await fetch(`/api/tests/${id}`, { method: "DELETE" });
    await refreshTests();
  }, [refreshTests]);

  const addResponse = useCallback(async (r: Omit<ResponseRow, "id">) => {
    await fetch("/api/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r),
    });
    await refreshResponses();
  }, [refreshResponses]);

  const deleteResponse = useCallback(async (id: string) => {
    await fetch(`/api/responses/${id}`, { method: "DELETE" });
    await refreshResponses();
  }, [refreshResponses]);

  const addInvitation = useCallback(async (testId: string, inv: Omit<InvitationRow, "id" | "testId">) => {
    await fetch("/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ testId, ...inv }),
    });
    await refreshTests();
  }, [refreshTests]);

  const updateInvitation = useCallback(async (testId: string, ivId: string, patch: Partial<InvitationRow>) => {
    await fetch(`/api/invitations/${ivId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    await refreshTests();
  }, [refreshTests]);

  const deleteInvitation = useCallback(async (testId: string, ivId: string) => {
    await fetch(`/api/invitations/${ivId}`, { method: "DELETE" });
    await refreshTests();
  }, [refreshTests]);

  const upsertTaskAction = useCallback(async (a: Omit<TaskActionRow, "id"> & { id?: string }) => {
    await fetch("/api/task-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(a),
    });
    await refreshTaskActions();
  }, [refreshTaskActions]);

  return (
    <StoreContext.Provider value={{
      mode, modeConfig: MODE_CONFIG[mode], setMode,
      tests, refreshTests, getTest, createTest, updateTest, duplicateTest, deleteTest,
      responses, refreshResponses, addResponse, deleteResponse,
      addInvitation, updateInvitation, deleteInvitation,
      taskActions, refreshTaskActions, upsertTaskAction,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
