import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { topicInputSchema, selectTopicSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { activeTerm, activeThesisOfStudent, audit, notify, studentOf, type Env } from "../lib";

export const topicRoutes = new Hono<Env>()
  .use(authenticate)
  // 1. Ambil daftar katalog topik riset
  .get("/", async (c) => {
    const rows = await db.query.researchTopics.findMany({
      orderBy: desc(s.researchTopics.createdAt),
      with: {
        lecturer: { with: { user: true } },
        term: true,
        program: true,
      },
    });

    return c.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        focusArea: r.focusArea,
        quota: r.quota,
        taken: r.taken,
        status: r.status,
        lecturer: {
          id: r.lecturer.id,
          name: r.lecturer.user.name,
          nip: r.lecturer.nip,
          expertise: r.lecturer.expertise,
        },
        term: `${r.term.year} ${r.term.semester === "GANJIL" ? "Ganjil" : "Genap"}`,
        program: r.program.name,
      }))
    );
  })
  // 2. Ambil detail satu topik
  .get("/:id", async (c) => {
    const topic = await db.query.researchTopics.findFirst({
      where: eq(s.researchTopics.id, c.req.param("id")),
      with: { lecturer: { with: { user: true } }, term: true, program: true },
    });
    if (!topic) return c.json({ error: "Topik riset tidak ditemukan" }, 404);
    return c.json({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      focusArea: topic.focusArea,
      quota: topic.quota,
      taken: topic.taken,
      status: topic.status,
      lecturer: {
        id: topic.lecturer.id,
        name: topic.lecturer.user.name,
        nip: topic.lecturer.nip,
        expertise: topic.lecturer.expertise,
      },
    });
  })
  // 3. Tambah Topik Baru (Admin Prodi, Koordinator, atau Dosen Pembimbing)
  .post("/", requireRole("ADMIN_PRODI", "KOORDINATOR", "PEMBIMBING"), zValidator("json", topicInputSchema), async (c) => {
    const body = c.req.valid("json");
    const term = await activeTerm();
    const program = await db.query.programs.findFirst();
    if (!term || !program) return c.json({ error: "Semester atau program studi aktif tidak ditemukan" }, 400);

    const [row] = await db
      .insert(s.researchTopics)
      .values({
        programId: program.id,
        termId: term.id,
        lecturerId: body.lecturerId,
        title: body.title,
        description: body.description,
        focusArea: body.focusArea,
        quota: body.quota,
        taken: 0,
        status: body.status,
      })
      .returning();

    await audit(c.get("user").sub, "TOPIC_CREATE", "topic", row.id, { title: row.title });
    return c.json(row, 201);
  })
  // 4. Update Topik
  .put("/:id", requireRole("ADMIN_PRODI", "KOORDINATOR", "PEMBIMBING"), zValidator("json", topicInputSchema), async (c) => {
    const body = c.req.valid("json");
    const [row] = await db
      .update(s.researchTopics)
      .set({
        lecturerId: body.lecturerId,
        title: body.title,
        description: body.description,
        focusArea: body.focusArea,
        quota: body.quota,
        status: body.status,
      })
      .where(eq(s.researchTopics.id, c.req.param("id")))
      .returning();

    if (!row) return c.json({ error: "Topik tidak ditemukan" }, 404);
    await audit(c.get("user").sub, "TOPIC_UPDATE", "topic", row.id);
    return c.json(row);
  })
  // 5. Hapus Topik
  .delete("/:id", requireRole("ADMIN_PRODI", "KOORDINATOR"), async (c) => {
    await db.delete(s.researchTopics).where(eq(s.researchTopics.id, c.req.param("id")));
    await audit(c.get("user").sub, "TOPIC_DELETE", "topic", c.req.param("id"));
    return c.json({ ok: true });
  })
  // 6. Topic Shopping: Mahasiswa Memilih Topik dan Menetapkan Dosen Pembimbing Terkait
  .post("/:id/select", requireRole("MAHASISWA"), async (c) => {
    const u = c.get("user");
    const topicId = c.req.param("id");

    const st = await studentOf(u.sub);
    if (!st) return c.json({ error: "Data mahasiswa tidak ditemukan" }, 400);

    const topic = await db.query.researchTopics.findFirst({
      where: eq(s.researchTopics.id, topicId),
      with: { lecturer: { with: { user: true } } },
    });
    if (!topic) return c.json({ error: "Topik tidak ditemukan" }, 404);
    if (topic.status !== "TERSEDIA" || topic.taken >= topic.quota) {
      return c.json({ error: "Kuota topik ini sudah penuh atau telah ditutup" }, 409);
    }

    // Ambil atau buat proyek tesis mahasiswa
    let thesis = await activeThesisOfStudent(st.id);
    const term = await activeTerm();
    const program = await db.query.programs.findFirst();

    if (!thesis) {
      if (!term || !program) return c.json({ error: "Data akademik tidak lengkap" }, 400);
      const [newThesis] = await db
        .insert(s.thesisProjects)
        .values({
          studentId: st.id,
          programId: program.id,
          termId: term.id,
          title: topic.title,
          stage: "PROPOSAL",
          status: "AKTIF",
        })
        .returning();
      thesis = newThesis;
    } else {
      // Perbarui judul tesis dengan topik yang dipilih
      await db.update(s.thesisProjects).set({ title: topic.title }).where(eq(s.thesisProjects.id, thesis.id));
    }

    // Nonaktifkan penugasan pembimbing lama (jika ada) dan tetapkan dosen topik sebagai Pembimbing 1
    await db
      .update(s.supervisorAssignments)
      .set({ active: false, effectiveTo: new Date() })
      .where(and(eq(s.supervisorAssignments.thesisId, thesis.id), eq(s.supervisorAssignments.active, true)));

    await db.insert(s.supervisorAssignments).values({
      thesisId: thesis.id,
      lecturerId: topic.lecturerId,
      supervisorType: "PEMBIMBING_1",
      effectiveFrom: new Date(),
      active: true,
    });

    // Perbarui kuota topik
    const newTaken = topic.taken + 1;
    await db
      .update(s.researchTopics)
      .set({
        taken: newTaken,
        status: newTaken >= topic.quota ? "PENUH" : "TERSEDIA",
      })
      .where(eq(s.researchTopics.id, topic.id));

    // Kirim notifikasi ke Dosen Pembimbing
    await notify(
      topic.lecturer.userId,
      "TOPIC_SELECTED",
      "Mahasiswa Memilih Topik Riset Anda",
      `Mahasiswa ${u.name} (${st.nim}) telah memilih topik riset "${topic.title}". Anda kini terdaftar sebagai Pembimbing 1.`,
      `thesis:${thesis.id}`
    );

    await audit(u.sub, "TOPIC_SHOPPING_SELECT", "topic", topic.id, {
      thesisId: thesis.id,
      lecturerId: topic.lecturerId,
    });

    return c.json({
      ok: true,
      message: `Topik "${topic.title}" berhasil dipilih. Dosen pembimbing Anda: ${topic.lecturer.user.name}.`,
      title: topic.title,
      lecturerName: topic.lecturer.user.name,
    });
  });
