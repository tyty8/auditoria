import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const tests = pgTable("tests", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull().default("clientes"),
  name: text("name").notNull(),
  domain: text("domain"),
  tags: jsonb("tags").$type<string[]>().default([]),
  description: text("description"),
  status: text("status").default("borrador"),
  accent: text("accent").default("#1f8a5b"),
  topics: jsonb("topics").$type<Topic[]>().default([]),
  solutions: jsonb("solutions").$type<Solution[]>().default([]),
  branding: jsonb("branding").$type<Branding | null>(),
  createdAt: text("created_at").default(""),
}, (t) => [index("tests_mode_idx").on(t.mode)]);

export const responses = pgTable("responses", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  respondent: text("respondent"),
  company: text("company"),
  email: text("email"),
  role: text("role"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
}, (t) => [index("responses_test_idx").on(t.testId)]);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  company: text("company"),
  status: text("status").default("pendiente"),
  sentAt: timestamp("sent_at"),
}, (t) => [index("invitations_test_idx").on(t.testId)]);

export const taskActions = pgTable("task_actions", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  solutionId: text("solution_id").notNull(),
  entityName: text("entity_name").notNull(),
  status: text("status").default("pendiente"),
  assignee: text("assignee"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [index("task_actions_entity_idx").on(t.entityName)]);

export const consultantNotes = pgTable("consultant_notes", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  mode: text("mode").notNull(),
  content: text("content").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---- shared types ----
export type Option = { id: string; label: string; points: number; correct: boolean };
export type ShowIf = { questionId: string; optionIds: string[] } | null;
export type Question = { id: string; text: string; options: Option[]; showIf?: ShowIf };
export type Topic = {
  id: string; name: string; scoring: "weighted" | "percent";
  includeInOverall: boolean; weight?: number; description?: string;
  questions: Question[];
};
export type Condition = { scope: "overall" | "topic"; topicId?: string; operator: "below" | "above" | "between"; threshold: number; threshold2?: number };
export type Solution = {
  id: string; name: string; description: string; category: string;
  scope?: string; topicId?: string; operator?: string; threshold?: number; threshold2?: number;
  logic?: "all" | "any"; conditions?: Condition[];
  link?: { label: string; url: string } | null;
  actions?: string[];
};
export type Branding = { coverColor: string; accent: string; orgName: string; thankYou: string };

export type Test = typeof tests.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type TaskAction = typeof taskActions.$inferSelect;
