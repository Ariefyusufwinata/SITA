import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { examinerRoleEnum, revisionItemStatusEnum, revisionSubmissionStatusEnum, scheduleStatusEnum, sessionOutcomeEnum } from "./enums";
import { applications } from "./activity";
import { documentVersions } from "./documents";
import { lecturers, users } from "./identity";

export const schedules = pgTable("schedules", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => applications.id),
  startAt: ts("start_at").notNull(),
  endAt: ts("end_at").notNull(),
  roomOrLink: text("room_or_link"),
  status: scheduleStatusEnum("status").notNull().default("SEMENTARA"),
  versionNo: integer("version_no").notNull().default(1),
  rescheduleReason: text("reschedule_reason"),
}, (t) => [index("schedules_application_idx").on(t.applicationId), index("schedules_status_idx").on(t.status)]);

export const examinerAssignments = pgTable("examiner_assignments", {
  id: pk(),
  scheduleId: uuid("schedule_id").notNull().references(() => schedules.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  role: examinerRoleEnum("role").notNull(),
}, (t) => [index("examiner_schedule_idx").on(t.scheduleId), index("examiner_lecturer_idx").on(t.lecturerId)]);

export const sessionResults = pgTable("session_results", {
  id: pk(),
  scheduleId: uuid("schedule_id").notNull().references(() => schedules.id),
  outcome: sessionOutcomeEnum("outcome").notNull(),
  notes: text("notes"),
  finalizedBy: uuid("finalized_by").notNull().references(() => users.id),
  finalizedAt: ts("finalized_at").notNull().defaultNow(),
}, (t) => [index("session_results_schedule_idx").on(t.scheduleId)]);

export const revisionItems = pgTable("revision_items", {
  id: pk(),
  resultId: uuid("result_id").notNull().references(() => sessionResults.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  description: text("description").notNull(),
  deadline: ts("deadline"),
  status: revisionItemStatusEnum("status").notNull().default("TERBUKA"),
}, (t) => [index("revision_items_result_idx").on(t.resultId), index("revision_items_status_idx").on(t.status)]);

export const revisionSubmissions = pgTable("revision_submissions", {
  id: pk(),
  revisionId: uuid("revision_id").notNull().references(() => revisionItems.id, { onDelete: "cascade" }),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id),
  reviewerFeedback: text("reviewer_feedback"),
  status: revisionSubmissionStatusEnum("status").notNull().default("MENUNGGU"),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
}, (t) => [index("revision_submissions_revision_idx").on(t.revisionId)]);
