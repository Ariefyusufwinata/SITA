import { index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, pk, ts } from "./_helpers";
import { approvalDecisionEnum, reviewDecisionEnum, scanStatusEnum } from "./enums";
import { users } from "./identity";
import { thesisProjects } from "./academic";
import { applications, documentRequirements } from "./activity";

export const documents = pgTable("documents", {
  id: pk(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  thesisId: uuid("thesis_id").references(() => thesisProjects.id),
  category: varchar("category", { length: 80 }).notNull(),
  title: text("title").notNull(),
  createdAt: createdAt(),
}, (t) => [index("documents_thesis_id_idx").on(t.thesisId), index("documents_owner_idx").on(t.ownerUserId)]);

export const documentVersions = pgTable("document_versions", {
  id: pk(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: varchar("mime_type", { length: 150 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256Checksum: varchar("sha256_checksum", { length: 64 }), // belum dipakai di Level 1
  objectKey: text("object_key").notNull(),
  scanStatus: scanStatusEnum("scan_status").notNull().default("PENDING"),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  uploadedAt: ts("uploaded_at").notNull().defaultNow(),
}, (t) => [index("doc_versions_document_idx").on(t.documentId)]);

export const applicationDocuments = pgTable("application_documents", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id),
  requirementId: uuid("requirement_id").references(() => documentRequirements.id),
}, (t) => [index("app_docs_application_idx").on(t.applicationId)]);

export const documentReviews = pgTable("document_reviews", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id),
  reviewerUserId: uuid("reviewer_user_id").notNull().references(() => users.id),
  decision: reviewDecisionEnum("decision").notNull(),
  comment: text("comment"),
  reviewedAt: ts("reviewed_at").notNull().defaultNow(),
}, (t) => [index("doc_reviews_application_idx").on(t.applicationId)]);

export const approvalSteps = pgTable("approval_steps", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  approverUserId: uuid("approver_user_id").notNull().references(() => users.id),
  sequenceNo: integer("sequence_no").notNull(),
  decision: approvalDecisionEnum("decision").notNull().default("MENUNGGU"),
  reason: text("reason"),
  decidedAt: ts("decided_at"),
}, (t) => [index("approval_steps_application_idx").on(t.applicationId), index("approval_steps_approver_idx").on(t.approverUserId)]);
