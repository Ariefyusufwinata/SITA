import { boolean, index, integer, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { activityCodeEnum, applicationStatusEnum, requirementTypeEnum } from "./enums";
import { academicTerms, thesisProjects } from "./academic";

export const activityTypes = pgTable("activity_types", {
  id: pk(),
  code: activityCodeEnum("code").notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
});

export const activityPeriods = pgTable("activity_periods", {
  id: pk(),
  activityTypeId: uuid("activity_type_id").notNull().references(() => activityTypes.id),
  termId: uuid("term_id").notNull().references(() => academicTerms.id),
  openAt: ts("open_at").notNull(),
  closeAt: ts("close_at").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => [index("activity_periods_term_idx").on(t.termId)]);

export const documentRequirements = pgTable("document_requirements", {
  id: pk(),
  activityTypeId: uuid("activity_type_id").notNull().references(() => activityTypes.id),
  name: varchar("name", { length: 200 }).notNull(),
  requirementType: requirementTypeEnum("requirement_type").notNull().default("WAJIB"),
  allowedExtensions: text("allowed_extensions").notNull().default("pdf,docx,pptx"),
  maxSizeMb: integer("max_size_mb").notNull().default(10),
});

export const applications = pgTable("applications", {
  id: pk(),
  referenceNo: varchar("reference_no", { length: 50 }).notNull().unique(),
  thesisId: uuid("thesis_id").notNull().references(() => thesisProjects.id),
  activityTypeId: uuid("activity_type_id").notNull().references(() => activityTypes.id),
  periodId: uuid("period_id").notNull().references(() => activityPeriods.id),
  status: applicationStatusEnum("status").notNull().default("DRAFT"),
  lockVersion: integer("lock_version").notNull().default(0),
  submittedAt: ts("submitted_at"),
}, (t) => [index("applications_thesis_id_idx").on(t.thesisId), index("applications_status_idx").on(t.status)]);
