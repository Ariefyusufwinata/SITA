import { boolean, index, integer, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { semesterEnum, supervisorTypeEnum, thesisStageEnum, thesisStatusEnum, topicStatusEnum } from "./enums";
import { students, lecturers } from "./identity";

export const programs = pgTable("programs", {
  id: pk(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
});

export const academicTerms = pgTable("academic_terms", {
  id: pk(),
  year: integer("year").notNull(),
  semester: semesterEnum("semester").notNull(),
  startDate: ts("start_date").notNull(),
  endDate: ts("end_date").notNull(),
  active: boolean("active").notNull().default(false),
}, (t) => [index("academic_terms_active_idx").on(t.active)]);

export const thesisProjects = pgTable("thesis_projects", {
  id: pk(),
  studentId: uuid("student_id").notNull().references(() => students.id),
  programId: uuid("program_id").notNull().references(() => programs.id),
  termId: uuid("term_id").notNull().references(() => academicTerms.id),
  title: text("title").notNull(),
  stage: thesisStageEnum("stage").notNull().default("PROPOSAL"),
  status: thesisStatusEnum("status").notNull().default("AKTIF"),
}, (t) => [index("thesis_student_idx").on(t.studentId), index("thesis_term_id_idx").on(t.termId), index("thesis_status_idx").on(t.status)]);

export const supervisorAssignments = pgTable("supervisor_assignments", {
  id: pk(),
  thesisId: uuid("thesis_id").notNull().references(() => thesisProjects.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  supervisorType: supervisorTypeEnum("supervisor_type").notNull(),
  effectiveFrom: ts("effective_from").notNull(),
  effectiveTo: ts("effective_to"),
  active: boolean("active").notNull().default(true),
}, (t) => [index("sup_assign_thesis_id_idx").on(t.thesisId), index("sup_assign_lecturer_idx").on(t.lecturerId)]);

export const academicPolicies = pgTable("academic_policies", {
  id: pk(),
  programId: uuid("program_id").notNull().references(() => programs.id),
  termId: uuid("term_id").notNull().references(() => academicTerms.id),
  version: integer("version").notNull().default(1),
  effectiveDate: ts("effective_date").notNull(),
  rulesJson: jsonb("rules_json").notNull().$type<{
    min_bimbingan: number; jarak_hari_bimbingan?: number; syarat_tahap?: Record<string, unknown>;
  }>(),
}, (t) => [index("policies_term_id_idx").on(t.termId)]);

export const researchTopics = pgTable("research_topics", {
  id: pk(),
  programId: uuid("program_id").notNull().references(() => programs.id),
  termId: uuid("term_id").notNull().references(() => academicTerms.id),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  focusArea: varchar("focus_area", { length: 100 }).notNull(),
  quota: integer("quota").notNull().default(1),
  taken: integer("taken").notNull().default(0),
  status: topicStatusEnum("status").notNull().default("TERSEDIA"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [
  index("topics_term_idx").on(t.termId),
  index("topics_lecturer_idx").on(t.lecturerId),
  index("topics_status_idx").on(t.status),
]);
