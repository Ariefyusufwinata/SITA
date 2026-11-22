import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { topicInputSchema, selectTopicSchema, proposeTopicSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { activeTerm, activeThesisOfStudent, audit, notify, studentOf, type Env } from "../lib";

export const topicRoutes = new Hono<Env>()
  .use(authenticate)

  // 0. Daftar Dosen Pembimbing beserta Batas Kuota Anak Bimbingan Dinamis dari Database
  .get("/supervisors", async (c) => {
    const list = await db.query.lecturers.findMany({
      with: {
        user: true,
        assignments: {
          where: eq(s.supervisorAssignments.active, true),
        },
      },
    });

    return c.json(
      list.map((lc) => {
        const activeSupervisees = lc.assignments.length;
        const quota = lc.quota ?? 5;
        return {
          id: lc.id,
          name: lc.user.name,
          nip: lc.nip,
          expertise: lc.expertise,
          activeSupervisees,
          quota,
          isAvailable: activeSupervisees < quota,
        };
      })
    );
  })

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
  // 3. Tambah Topik Baru (Admin Prodi, Koordinator, Kepala Prodi, atau Dosen Pembimbing)
  .post("/", requireRole("ADMIN_PRODI", "KOORDINATOR", "PEMBIMBING", "KEPALA_PRODI"), zValidator("json", topicInputSchema), async (c) => {
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
  .put("/:id", requireRole("ADMIN_PRODI", "KOORDINATOR", "PEMBIMBING", "KEPALA_PRODI"), zValidator("json", topicInputSchema), async (c) => {
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
  .delete("/:id", requireRole("ADMIN_PRODI", "KOORDINATOR", "KEPALA_PRODI"), async (c) => {
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

    // Cek apakah mahasiswa sudah memiliki topik/tesis aktif
    const existingThesis = await activeThesisOfStudent(st.id);
    if (existingThesis && existingThesis.title) {
      return c.json({ error: "Anda sudah memiliki topik tesis aktif. Mahasiswa yang sudah memiliki topik tidak dapat memilih topik lagi." }, 403);
    }

    const topic = await db.query.researchTopics.findFirst({
      where: eq(s.researchTopics.id, topicId),
      with: { lecturer: { with: { user: true } } },
    });
    if (!topic) return c.json({ error: "Topik tidak ditemukan" }, 404);
    if (topic.status !== "TERSEDIA" || topic.taken >= topic.quota) {
      return c.json({ error: "Kuota topik ini sudah penuh atau telah ditutup" }, 409);
    }

    // Validasi batas anak bimbingan dosen dari database
    const currentSupervisees = await db.query.supervisorAssignments.findMany({
      where: and(eq(s.supervisorAssignments.lecturerId, topic.lecturerId), eq(s.supervisorAssignments.active, true)),
    });
    const supervisorQuota = topic.lecturer.quota ?? 5;
    if (currentSupervisees.length >= supervisorQuota) {
      return c.json({
        error: `Dosen ${topic.lecturer.user.name} telah mencapai batas maksimal kuota bimbingan (${currentSupervisees.length}/${supervisorQuota} mahasiswa). Silakan pilih topik dari dosen lain.`,
      }, 409);
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
  })

  // 7. Pengajuan Topik Mandiri Mahasiswa ke Dosen Pembimbing (Bukan dari Topic Shopping)
  .post("/propose", requireRole("MAHASISWA"), zValidator("json", proposeTopicSchema), async (c) => {
    const u = c.get("user");
    const body = c.req.valid("json");

    const st = await studentOf(u.sub);
    if (!st) return c.json({ error: "Data mahasiswa tidak ditemukan" }, 400);

    // Cek apakah mahasiswa sudah memiliki topik/tesis aktif
    const existingThesis = await activeThesisOfStudent(st.id);
    if (existingThesis && existingThesis.title) {
      return c.json({ error: "Anda sudah memiliki topik tesis aktif. Mahasiswa yang sudah memiliki topik tidak dapat mengajukan topik baru lagi." }, 403);
    }

    const lecturer = await db.query.lecturers.findFirst({
      where: eq(s.lecturers.id, body.lecturerId),
      with: { user: true },
    });
    if (!lecturer) return c.json({ error: "Dosen pembimbing tidak ditemukan" }, 404);

    // Cek batas kuota anak bimbingan dinamis dari database
    const currentSupervisees = await db.query.supervisorAssignments.findMany({
      where: and(eq(s.supervisorAssignments.lecturerId, lecturer.id), eq(s.supervisorAssignments.active, true)),
    });
    const supervisorQuota = lecturer.quota ?? 5;
    if (currentSupervisees.length >= supervisorQuota) {
      return c.json({
        error: `Dosen ${lecturer.user.name} telah mencapai batas maksimal kuota bimbingan (${currentSupervisees.length}/${supervisorQuota} mahasiswa). Silakan pilih dosen pembimbing lain.`,
      }, 409);
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
          title: body.title,
          stage: "PROPOSAL",
          status: "AKTIF",
        })
        .returning();
      thesis = newThesis;
    } else {
      await db.update(s.thesisProjects).set({ title: body.title }).where(eq(s.thesisProjects.id, thesis.id));
    }

    // Nonaktifkan penugasan bimbingan lama (jika ada) dan tetapkan dosen sebagai Pembimbing 1
    await db
      .update(s.supervisorAssignments)
      .set({ active: false, effectiveTo: new Date() })
      .where(and(eq(s.supervisorAssignments.thesisId, thesis.id), eq(s.supervisorAssignments.active, true)));

    await db.insert(s.supervisorAssignments).values({
      thesisId: thesis.id,
      lecturerId: lecturer.id,
      supervisorType: "PEMBIMBING_1",
      effectiveFrom: new Date(),
      active: true,
    });

    // Kirim notifikasi ke Dosen Pembimbing
    await notify(
      lecturer.userId,
      "TOPIC_PROPOSED",
      "Pengajuan Judul Topik Mandiri dari Mahasiswa",
      `Mahasiswa ${u.name} (${st.nim}) mengajukan topik mandiri: "${body.title}". Anda telah ditetapkan sebagai Dosen Pembimbing 1.`,
      `thesis:${thesis.id}`
    );

    await audit(u.sub, "TOPIC_PROPOSED_INDEPENDENT", "thesis", thesis.id, {
      title: body.title,
      lecturerId: lecturer.id,
    });

    return c.json({
      ok: true,
      message: `Topik mandiri "${body.title}" berhasil diajukan dan ditetapkan kepada ${lecturer.user.name}.`,
      thesisId: thesis.id,
      title: body.title,
      lecturerName: lecturer.user.name,
    }, 201);
  });
