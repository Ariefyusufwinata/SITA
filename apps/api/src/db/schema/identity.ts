import { boolean, index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, pk, ts } from "./_helpers";
import { roleCodeEnum } from "./enums";
import { programs } from "./academic";

export const users = pgTable("users", {
  id: pk(),
  name: varchar("name", { length: 200 }).notNull(),
  username: varchar("username", { length: 100 }).unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"), // nullable: dev login
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("users_username_idx").on(t.username)]);

export const students = pgTable("students", {
  id: pk(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  nim: varchar("nim", { length: 20 }).notNull().unique(),
  programId: uuid("program_id").notNull().references(() => programs.id),
  cohortYear: integer("cohort_year").notNull(),
  phone: varchar("phone", { length: 30 }),
}, (t) => [index("students_nim_idx").on(t.nim), index("students_user_id_idx").on(t.userId)]);

export const lecturers = pgTable("lecturers", {
  id: pk(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  nip: varchar("nip", { length: 30 }).notNull().unique(),
  nidn: varchar("nidn", { length: 30 }),
  programId: uuid("program_id").notNull().references(() => programs.id),
  expertise: text("expertise"),
  isActiveSupervisor: boolean("is_active_supervisor").notNull().default(false),
  quota: integer("quota").notNull().default(5),
}, (t) => [index("lecturers_nip_idx").on(t.nip), index("lecturers_user_id_idx").on(t.userId)]);

export const roles = pgTable("roles", {
  id: pk(),
  code: roleCodeEnum("code").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const userRoles = pgTable("user_roles", {
  id: pk(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  scopeId: uuid("scope_id").references(() => programs.id),
  validFrom: ts("valid_from").notNull().defaultNow(),
  validTo: ts("valid_to"),
}, (t) => [index("user_roles_user_id_idx").on(t.userId), index("user_roles_role_id_idx").on(t.roleId)]);
