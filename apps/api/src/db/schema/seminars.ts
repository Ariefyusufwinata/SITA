import { integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { thesisProjects } from "./academic";
import { lecturers } from "./identity";

export const seminars = pgTable("seminars", {
  id: pk(),
  thesisId: uuid("thesis_id").notNull().references(() => thesisProjects.id, { onDelete: "cascade" }),
  proposalDocumentUrl: text("proposal_document_url").notNull(),
  presentationNotes: text("presentation_notes"),
  status: varchar("status", { length: 50 }).notNull().default("MENUNGGU_PENILAIAN"),
  outcome: varchar("outcome", { length: 50 }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const seminarEvaluations = pgTable("seminar_evaluations", {
  id: pk(),
  seminarId: uuid("seminar_id").notNull().references(() => seminars.id, { onDelete: "cascade" }),
  lecturerId: uuid("lecturer_id").notNull().references(() => lecturers.id),
  examinerRole: varchar("examiner_role", { length: 50 }).notNull(),
  theoryMasteryScore: integer("theory_mastery_score").notNull(),
  methodologyScore: integer("methodology_score").notNull(),
  writingQualityScore: integer("writing_quality_score").notNull(),
  comments: text("comments"),
  decision: varchar("decision", { length: 50 }).notNull(),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
});
