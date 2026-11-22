import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "../db";
import { authenticate } from "../middleware/auth";
import { activeThesisOfStudent, lecturerOf, semesterTarget, studentOf, type Env } from "../lib";

export const dashboardRoutes = new Hono<Env>().use(authenticate).get("/", async (c) => {
  const u = c.get("user");
  let where;
  let scopeLabel = "Seluruh program studi";
  if (u.role === "MAHASISWA") {
    const st = await studentOf(u.sub);
    const th = st && (await activeThesisOfStudent(st.id));
    where = th ? eq(s.logbooks.thesisId, th.id) : sql`false`;
    scopeLabel = "Bimbingan saya";
  } else if (u.role === "PEMBIMBING") {
    const lc = await lecturerOf(u.sub);
    where = lc ? eq(s.logbooks.lecturerId, lc.id) : sql`false`;
    scopeLabel = "Mahasiswa bimbingan saya";
  }
  const rows = await db.select({ status: s.logbooks.status, n: sql<number>`count(*)::int` }).from(s.logbooks).where(where).groupBy(s.logbooks.status);
  const n = (st: string) => rows.find((r) => r.status === st)?.n ?? 0;
  const counts = { disetujui: n("DISETUJUI"), menunggu: n("MENUNGGU_VALIDASI"), perluRevisi: n("PERLU_REVISI"), draft: n("DRAFT") };
  const target = await semesterTarget();

  const taskStatuses = u.role === "MAHASISWA" ? (["PERLU_REVISI", "DRAFT"] as const) : (["MENUNGGU_VALIDASI"] as const);
  const tasks = await db.query.logbooks.findMany({
    where: and(where, inArray(s.logbooks.status, [...taskStatuses])),
    orderBy: desc(s.logbooks.sessionDate), limit: 6,
    with: { thesis: { with: { student: { with: { user: true } } } } },
  });
  return c.json({
    role: u.role, scopeLabel, counts, target,
    percent: Math.min(100, Math.round((counts.disetujui / target) * 100)),
    tasks: tasks.map((t) => ({ id: t.id, topic: t.topic, status: t.status, sessionDate: t.sessionDate.toISOString(), studentName: t.thesis.student.user.name, nim: t.thesis.student.nim })),
  });
});
