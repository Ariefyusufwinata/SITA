import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "../db";
import { authenticate } from "../middleware/auth";
import { activeThesisOfStudent, lecturerOf, semesterTarget, studentOf, type Env } from "../lib";

export const dashboardRoutes = new Hono<Env>().use(authenticate).get("/", async (c) => {
  const u = c.get("user");
  let where;
  let scopeLabel = "Seluruh program studi";
  let thesisData: any = null;
  let lecturerData: any = null;
  let stageDistribution: Record<string, number> = {
    PROPOSAL: 0,
    PEMANTAUAN: 0,
    SEMINAR: 0,
    SIDANG_AKHIR: 0,
    LULUS: 0,
  };

  if (u.role === "MAHASISWA") {
    const st = await studentOf(u.sub);
    const th = st && (await activeThesisOfStudent(st.id));
    where = th ? eq(s.logbooks.thesisId, th.id) : sql`false`;
    scopeLabel = "Bimbingan saya";

    if (th) {
      const fullTh = await db.query.thesisProjects.findFirst({
        where: eq(s.thesisProjects.id, th.id),
        with: {
          program: true,
          term: true,
          student: { with: { user: true } },
          supervisors: {
            where: eq(s.supervisorAssignments.active, true),
            with: { lecturer: { with: { user: true } } },
          },
        },
      });

      if (fullTh) {
        thesisData = {
          id: fullTh.id,
          title: fullTh.title,
          stage: fullTh.stage,
          status: fullTh.status,
          program: fullTh.program.name,
          term: `${fullTh.term.year} ${fullTh.term.semester === "GANJIL" ? "Ganjil" : "Genap"}`,
          student: {
            name: fullTh.student.user.name,
            nim: fullTh.student.nim,
            email: fullTh.student.user.email,
            cohortYear: fullTh.student.cohortYear,
            phone: fullTh.student.phone,
          },
          supervisors: fullTh.supervisors.map((sp) => ({
            name: sp.lecturer.user.name,
            nip: sp.lecturer.nip,
            type: sp.supervisorType,
            expertise: sp.lecturer.expertise,
          })),
        };
      }
    }
  } else if (u.role === "PEMBIMBING" || u.role === "KOORDINATOR" || u.role === "KEPALA_PRODI" || u.role === "PENGUJI") {
    const lc = await lecturerOf(u.sub);
    if (lc) {
      const assignments = await db.query.supervisorAssignments.findMany({
        where: and(eq(s.supervisorAssignments.lecturerId, lc.id), eq(s.supervisorAssignments.active, true)),
        with: { thesis: true },
      });

      assignments.forEach((a) => {
        if (a.thesis?.stage && stageDistribution[a.thesis.stage] !== undefined) {
          stageDistribution[a.thesis.stage]++;
        }
      });

      lecturerData = {
        name: u.name,
        nip: lc.nip,
        expertise: lc.expertise,
        quota: lc.quota ?? 5,
        activeSupervisees: assignments.length,
      };

      if (u.role === "PEMBIMBING") {
        where = eq(s.logbooks.lecturerId, lc.id);
        scopeLabel = "Mahasiswa bimbingan saya";
      }
    }
  }

  const rows = await db
    .select({ status: s.logbooks.status, n: sql<number>`count(*)::int` })
    .from(s.logbooks)
    .where(where)
    .groupBy(s.logbooks.status);

  const n = (st: string) => rows.find((r) => r.status === st)?.n ?? 0;
  const counts = {
    disetujui: n("DISETUJUI"),
    menunggu: n("MENUNGGU_VALIDASI"),
    perluRevisi: n("PERLU_REVISI"),
    draft: n("DRAFT"),
  };
  const target = await semesterTarget();

  const taskStatuses =
    u.role === "MAHASISWA" ? (["PERLU_REVISI", "DRAFT"] as const) : (["MENUNGGU_VALIDASI"] as const);

  const tasks = await db.query.logbooks.findMany({
    where: and(where, inArray(s.logbooks.status, [...taskStatuses])),
    orderBy: desc(s.logbooks.sessionDate),
    limit: 6,
    with: { thesis: { with: { student: { with: { user: true } } } } },
  });

  return c.json({
    role: u.role,
    scopeLabel,
    counts,
    target,
    percent: Math.min(100, Math.round((counts.disetujui / target) * 100)),
    thesis: thesisData,
    lecturer: lecturerData,
    stageDistribution,
    tasks: tasks.map((t) => ({
      id: t.id,
      topic: t.topic,
      status: t.status,
      sessionDate: t.sessionDate.toISOString(),
      studentName: t.thesis.student.user.name,
      nim: t.thesis.student.nim,
    })),
  });
});
