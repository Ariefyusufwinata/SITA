import { and, eq } from "drizzle-orm";
import { db, schema as s } from "./db";

export type RoleCode = (typeof s.roleCodeEnum.enumValues)[number];
export type SessionUser = { sub: string; name: string; role: RoleCode };
export type Env = { Variables: { user: SessionUser } };

/** Audit ringan (Level 1): tanpa masking PII. */
export async function audit(actor: string | null, action: string, entityType: string, entityId?: string, diff?: unknown, ip?: string) {
  await db.insert(s.auditEvents).values({ actorUserId: actor, action, entityType, entityId, diffSummary: diff as any, ipAddress: ip, outcome: "SUCCESS" });
}

export async function notify(recipientUserId: string, eventType: string, title: string, message: string, objectRef?: string) {
  await db.insert(s.notifications).values({ recipientUserId, eventType, title, message, objectRef });
}

export async function studentOf(userId: string) {
  return db.query.students.findFirst({ where: eq(s.students.userId, userId) });
}
export async function lecturerOf(userId: string) {
  return db.query.lecturers.findFirst({ where: eq(s.lecturers.userId, userId) });
}
export async function activeThesisOfStudent(studentId: string) {
  return db.query.thesisProjects.findFirst({ where: and(eq(s.thesisProjects.studentId, studentId), eq(s.thesisProjects.status, "AKTIF")) });
}
export async function activeTerm() {
  return db.query.academicTerms.findFirst({ where: eq(s.academicTerms.active, true) });
}
export async function semesterTarget(): Promise<number> {
  const term = await activeTerm();
  if (!term) return 8;
  const p = await db.query.academicPolicies.findFirst({ where: eq(s.academicPolicies.termId, term.id), orderBy: (t, { desc }) => desc(t.version) });
  return p?.rulesJson.min_bimbingan ?? 8;
}
