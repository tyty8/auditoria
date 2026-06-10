import { pgTable, text, jsonb, timestamp, index, integer, uniqueIndex, boolean } from "drizzle-orm/pg-core";

export const tests = pgTable("tests", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull().default("clientes"),
  name: text("name").notNull(),
  domain: text("domain"),
  tags: jsonb("tags").$type<string[]>().default([]),
  description: text("description"),
  status: text("status").default("borrador"),
  archived: boolean("archived").default(false),
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
  // Version of the test (snapshot in test_versions) that was live when this
  // response was submitted. Null for responses predating versioning.
  testVersion: integer("test_version"),
}, (t) => [index("responses_test_idx").on(t.testId)]);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  company: text("company"),
  status: text("status").default("pendiente"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  lastReminderAt: timestamp("last_reminder_at"),
}, (t) => [index("invitations_test_idx").on(t.testId)]);

export const taskActions = pgTable("task_actions", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  solutionId: text("solution_id").notNull(),
  entityName: text("entity_name").notNull(),
  status: text("status").default("pendiente"),
  assignee: text("assignee"),
  dueDate: text("due_date"), // YYYY-MM-DD
  priority: text("priority").default("media"), // "alta" | "media" | "baja"
  comments: jsonb("comments").$type<ActionComment[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [index("task_actions_entity_idx").on(t.entityName)]);

// Server-side backup of an in-progress public quiz, so a respondent can
// resume from another device via their invitation link (?inv=...).
export const quizDrafts = pgTable("quiz_drafts", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  draftKey: text("draft_key").notNull(), // invitation id or normalized email
  person: jsonb("person").$type<{ name?: string; email?: string; company?: string; role?: string } | null>(),
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [uniqueIndex("quiz_drafts_key_idx").on(t.testId, t.draftKey)]);

// Log of client reports emailed/marked as sent, to show "último envío".
export const reportSends = pgTable("report_sends", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  mode: text("mode").notNull(),
  email: text("email"),
  sentAt: timestamp("sent_at").defaultNow(),
}, (t) => [index("report_sends_company_idx").on(t.company)]);

// Immutable snapshot of a test's questions/solutions taken each time it is
// published with changes. Responses are stamped with the version they answered,
// so historical scores stay comparable even after the instrument is edited.
export const testVersions = pgTable("test_versions", {
  id: text("id").primaryKey(),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  topics: jsonb("topics").$type<Topic[]>().default([]),
  solutions: jsonb("solutions").$type<Solution[]>().default([]),
  publishedAt: timestamp("published_at").defaultNow(),
}, (t) => [index("test_versions_test_idx").on(t.testId)]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("consultor"), // "admin" | "consultor" | "viewer"
  company: text("company"), // optional scope for viewer accounts
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const consultantNotes = pgTable("consultant_notes", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  mode: text("mode").notNull(),
  content: text("content").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---- shared types ----
export type ActionComment = { id: string; text: string; author?: string; at: string };
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
export type Branding = {
  coverColor: string; accent: string; orgName: string; thankYou: string;
  // Optional extras (all backward-compatible — stored in the same jsonb column)
  logoUrl?: string;            // small logo shown on quiz cover / result
  ctaLabel?: string;           // "next steps" block on the public result
  ctaUrl?: string;
  showBenchmark?: boolean;     // show "tu puntaje vs promedio" on public result
};

export type Test = typeof tests.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type TaskAction = typeof taskActions.$inferSelect;
export type TestVersion = typeof testVersions.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = "admin" | "consultor" | "viewer";
