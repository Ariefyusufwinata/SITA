import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { evalDecisionEnum, logbookStatusEnum } from "./enums";
import { thesisProjects, academicTerms } from "./academic";
import { lecturers } from "./identity";

export const logbooks = pgTable("logbooks", {
  id: pk(),
  thesisId: uuid("thesis_id").notNull().references(() => thesisProjects.id),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  termId: uuid("term_id").notNull().references(() => academicTerms.id),
  sessionDate: ts("session_date").notNull(),
  topic: text("topic").notNull(),
  progress: text("progress").notNull(),
  challenges: text("challenges"),
  nextSteps: text("next_steps"),
  status: logbookStatusEnum("status").notNull().default("DRAFT"),
  currentVersion: integer("current_version").notNull().default(0),
  // Lampiran lokal (Level 1): nama asli & nama file di /uploads
  attachmentName: text("attachment_name"),
  attachmentKey: text("attachment_key"),
}, (t) => [index("logbooks_thesis_id_idx").on(t.thesisId), index("logbooks_status_idx").on(t.status), index("logbooks_term_id_idx").on(t.termId), index("logbooks_lecturer_idx").on(t.lecturerId)]);

export const logbookVersions = pgTable("logbook_versions", {
  id: pk(),
  logbookId: uuid("logbook_id").notNull().references(() => logbooks.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
}, (t) => [index("logbook_versions_logbook_idx").on(t.logbookId)]);

export const supervisorEvaluations = pgTable("supervisor_evaluations", {
  id: pk(),
  logbookVersionId: uuid("logbook_version_id").notNull().references(() => logbookVersions.id),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  researchProgressScore: integer("research_progress_score").notNull(),
  scheduleComplianceScore: integer("schedule_compliance_score").notNull(),
  onTimeCompletionScore: integer("on_time_completion_score").notNull(),
  comments: text("comments"),
  decision: evalDecisionEnum("decision").notNull(),
  decidedAt: ts("decided_at").notNull().defaultNow(),
}, (t) => [index("sup_eval_version_idx").on(t.logbookVersionId), index("sup_eval_lecturer_idx").on(t.lecturerId)]);
