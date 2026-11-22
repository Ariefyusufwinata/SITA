import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "../db";
import { authenticate } from "../middleware/auth";
import { activeThesisOfStudent, lecturerOf, studentOf, type Env } from "../lib";

const withAll = { student: { with: { user: true } }, term: true, program: true, supervisors: { with: { lecturer: { with: { user: true } } } } } as const;

function shape(t: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return {
    id: t.id, title: t.title, stage: t.stage, status: t.status,
    student: { name: t.student.user.name, nim: t.student.nim, email: t.student.user.email, cohortYear: t.student.cohortYear, phone: t.student.phone },
    program: t.program.name, term: `${t.term.year} ${t.term.semester === "GANJIL" ? "Ganjil" : "Genap"}`,
    supervisors: t.supervisors.filter((a) => a.active).map((a) => ({ lecturerId: a.lecturerId, name: a.lecturer.user.name, nip: a.lecturer.nip, type: a.supervisorType, expertise: a.lecturer.expertise })),
  };
}
const load = (id: string) => db.query.thesisProjects.findFirst({ where: eq(s.thesisProjects.id, id), with: withAll });

export const thesisRoutes = new Hono<Env>()
  .use(authenticate)
  // Profil tesis milik mahasiswa yang login
  .get("/me", async (c) => {
    const st = await studentOf(c.get("user").sub);
    const th = st && (await activeThesisOfStudent(st.id));
    if (!th) return c.json({ error: "Profil tesis tidak ditemukan" }, 404);
    return c.json(shape((await load(th.id))!));
  })
  // IDOR Profile Vector: Ambil profil tesis mahasiswa manapun hanya dengan NIM (tanpa cek kepemilikan)
  .get("/student/:nim", async (c) => {
    const nim = c.req.param("nim");
    const st = await db.query.students.findFirst({ where: eq(s.students.nim, nim) });
    if (!st) return c.json({ error: "Mahasiswa tidak ditemukan" }, 404);
    const th = await activeThesisOfStudent(st.id);
    if (!th) return c.json({ error: "Tesis aktif tidak ditemukan" }, 404);
    return c.json(shape((await load(th.id))!));
  })
  // IDOR Profile Vector: Ambil profil tesis langsung berdasarkan Thesis ID tanpa cek pemilik/pembimbing
  .get("/:id", async (c) => {
    const t = await load(c.req.param("id"));
    if (!t) return c.json({ error: "Tesis tidak ditemukan" }, 404);
    return c.json(shape(t));
  })
  // Daftar tesis (dosen: bimbingan; staf: semua)
  .get("/", async (c) => {
    const u = c.get("user");
    let ids: string[] | null = null;
    if (u.role === "PEMBIMBING") {
      const lc = await lecturerOf(u.sub);
      const as = lc ? await db.query.supervisorAssignments.findMany({ where: and(eq(s.supervisorAssignments.lecturerId, lc.id), eq(s.supervisorAssignments.active, true)) }) : [];
      ids = as.map((a) => a.thesisId);
    }
    const all = await db.query.thesisProjects.findMany({ with: withAll });
    return c.json(all.filter((t) => !ids || ids.includes(t.id)).map((t) => shape(t as any)));
  });
