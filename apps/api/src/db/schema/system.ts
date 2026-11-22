import { index, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { pk, ts } from "./_helpers";
import { emailStatusEnum } from "./enums";
import { users } from "./identity";

export const notifications = pgTable("notifications", {
  id: pk(),
  recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  objectRef: text("object_ref"),
  readAt: ts("read_at"),
  emailStatus: emailStatusEnum("email_status").notNull().default("PENDING"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_recipient_idx").on(t.recipientUserId), index("notifications_read_idx").on(t.readAt)]);

export const auditEvents = pgTable("audit_events", {
  id: pk(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: text("entity_id"),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 64 }),
  outcome: varchar("outcome", { length: 30 }).notNull().default("SUCCESS"),
  diffSummary: jsonb("diff_summary"),
}, (t) => [index("audit_actor_idx").on(t.actorUserId), index("audit_entity_idx").on(t.entityType, t.entityId)]);
