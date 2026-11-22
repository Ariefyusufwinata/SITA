import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { seminarSubmissionSchema, seminarEvaluationSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { activeThesisOfStudent, audit, lecturerOf, notify, studentOf, type Env } from "../lib";

export const seminarRoutes = new Hono<Env>()
  .use(authenticate)

  // 1. Cek Kelayakan Seminar (Syarat: Minimal 4x Logbook Bimbingan Disetujui)
  .get("/eligibility", async (c) => {
    const u = c.get("user");
    const st = await studentOf(u.sub);
    if (!st) {
      return c.json({
        eligible: false,
        message: "Hanya mahasiswa yang dapat mendaftar seminar",
        approvedCount: 0,
        minRequired: 4,
        thesis: null as { id: string; title: string; stage: string } | null,
      });
    }

    const th = await activeThesisOfStudent(st.id);
    if (!th) {
      return c.json({
        eligible: false,
        message: "Tesis aktif tidak ditemukan",
        approvedCount: 0,
        minRequired: 4,
        thesis: null as { id: string; title: string; stage: string } | null,
      });
    }

    // Hitung logbook bimbingan yang berstatus DISETUJUI
    const approvedLogbooks = await db.query.logbooks.findMany({
      where: and(eq(s.logbooks.thesisId, th.id), eq(s.logbooks.status, "DISETUJUI")),
    });

    const approvedCount = approvedLogbooks.length;
    const minRequired = 4;
    const eligible = approvedCount >= minRequired;

    return c.json({
      eligible,
      approvedCount,
      minRequired,
      thesis: {
        id: th.id,
        title: th.title,
        stage: th.stage,
      },
    });
  })

  // 2. Ambil Pendaftaran Seminar Mahasiswa yang Sedang Login
  .get("/my", async (c) => {
    const u = c.get("user");
    const st = await studentOf(u.sub);
    if (!st) return c.json({ error: "Data mahasiswa tidak ditemukan" }, 404);

    const th = await activeThesisOfStudent(st.id);
    if (!th) return c.json({ error: "Tesis aktif tidak ditemukan" }, 404);

    const seminar = await db.query.seminars.findFirst({
      where: eq(s.seminars.thesisId, th.id),
      orderBy: desc(s.seminars.createdAt),
      with: {
        evaluations: {
          with: { lecturer: { with: { user: true } } },
        },
      },
    });

    return c.json(seminar ?? null);
  })

  // 3. Mahasiswa Mendaftarkan Seminar (Kumpul Link Dokumen Proposal Thesis)
  .post("/", requireRole("MAHASISWA"), zValidator("json", seminarSubmissionSchema), async (c) => {
    const u = c.get("user");
    const st = await studentOf(u.sub);
    if (!st) return c.json({ error: "Data mahasiswa tidak ditemukan" }, 400);

    const th = await activeThesisOfStudent(st.id);
    if (!th) return c.json({ error: "Tesis aktif tidak ditemukan" }, 400);

    // Validasi syarat: Minimal 4x logbook bimbingan disetujui
    const approvedLogbooks = await db.query.logbooks.findMany({
      where: and(eq(s.logbooks.thesisId, th.id), eq(s.logbooks.status, "DISETUJUI")),
    });

    if (approvedLogbooks.length < 4) {
      return c.json({
        error: `Belum memenuhi syarat pendaftaran seminar! Minimal 4x bimbingan disetujui (saat ini baru ${approvedLogbooks.length}x).`,
      }, 400);
    }

    const body = c.req.valid("json");

    // Simpan pendaftaran seminar
    const [row] = await db
      .insert(s.seminars)
      .values({
        thesisId: th.id,
        proposalDocumentUrl: body.proposalDocumentUrl,
        presentationNotes: body.presentationNotes,
        status: "MENUNGGU_PENILAIAN",
      })
      .returning();

    // Perbarui stage tesis menjadi SEMINAR
    await db.update(s.thesisProjects).set({ stage: "SEMINAR" }).where(eq(s.thesisProjects.id, th.id));

    await audit(u.sub, "SEMINAR_SUBMIT", "seminar", row.id, { thesisId: th.id });
    return c.json(row, 201);
  })

  // 4. Daftar Semua Pengajuan Seminar (Dosen Penguji, Koordinator, Kepala Prodi)
  .get("/", async (c) => {
    const all = await db.query.seminars.findMany({
      orderBy: desc(s.seminars.createdAt),
      with: {
        thesis: {
          with: {
            student: { with: { user: true } },
            supervisors: { with: { lecturer: { with: { user: true } } } },
          },
        },
        evaluations: {
          with: { lecturer: { with: { user: true } } },
        },
      },
    });

    return c.json(
      all.map((sem) => ({
        id: sem.id,
        thesisId: sem.thesisId,
        thesisTitle: sem.thesis.title,
        studentName: sem.thesis.student.user.name,
        nim: sem.thesis.student.nim,
        proposalDocumentUrl: sem.proposalDocumentUrl,
        presentationNotes: sem.presentationNotes,
        status: sem.status,
        outcome: sem.outcome,
        createdAt: sem.createdAt.toISOString(),
        evaluationsCount: sem.evaluations.length,
        evaluationsRequired: 2,
        evaluations: sem.evaluations.map((ev) => ({
          id: ev.id,
          examinerName: ev.lecturer.user.name,
          examinerRole: ev.examinerRole,
          theoryMasteryScore: ev.theoryMasteryScore,
          methodologyScore: ev.methodologyScore,
          writingQualityScore: ev.writingQualityScore,
          averageScore: ((ev.theoryMasteryScore + ev.methodologyScore + ev.writingQualityScore) / 3).toFixed(1),
          comments: ev.comments,
          decision: ev.decision,
          submittedAt: ev.submittedAt.toISOString(),
        })),
      }))
    );
  })

  // 5. Detail Satu Seminar
  .get("/:id", async (c) => {
    const sem = await db.query.seminars.findFirst({
      where: eq(s.seminars.id, c.req.param("id")),
      with: {
        thesis: {
          with: {
            student: { with: { user: true } },
            supervisors: { with: { lecturer: { with: { user: true } } } },
          },
        },
        evaluations: {
          with: { lecturer: { with: { user: true } } },
        },
      },
    });

    if (!sem) return c.json({ error: "Data seminar tidak ditemukan" }, 404);

    return c.json({
      id: sem.id,
      thesisId: sem.thesisId,
      thesisTitle: sem.thesis.title,
      studentName: sem.thesis.student.user.name,
      nim: sem.thesis.student.nim,
      proposalDocumentUrl: sem.proposalDocumentUrl,
      presentationNotes: sem.presentationNotes,
      status: sem.status,
      outcome: sem.outcome,
      createdAt: sem.createdAt.toISOString(),
      evaluationsCount: sem.evaluations.length,
      evaluationsRequired: 2,
      evaluations: sem.evaluations.map((ev) => ({
        id: ev.id,
        examinerId: ev.lecturerId,
        examinerName: ev.lecturer.user.name,
        examinerRole: ev.examinerRole,
        theoryMasteryScore: ev.theoryMasteryScore,
        methodologyScore: ev.methodologyScore,
        writingQualityScore: ev.writingQualityScore,
        averageScore: ((ev.theoryMasteryScore + ev.methodologyScore + ev.writingQualityScore) / 3).toFixed(1),
        comments: ev.comments,
        decision: ev.decision,
        submittedAt: ev.submittedAt.toISOString(),
      })),
    });
  })

  // 6. Penilaian Seminar oleh 2 Dosen Penguji
  .post("/evaluate", requireRole("PENGUJI", "KOORDINATOR", "KEPALA_PRODI"), zValidator("json", seminarEvaluationSchema), async (c) => {
    const u = c.get("user");
    const body = c.req.valid("json");

    const lc = await lecturerOf(u.sub);
    if (!lc) return c.json({ error: "Hanya dosen penguji yang dapat melakukan penilaian" }, 403);

    const sem = await db.query.seminars.findFirst({
      where: eq(s.seminars.id, body.seminarId),
      with: { evaluations: true, thesis: { with: { student: true } } },
    });
    if (!sem) return c.json({ error: "Seminar tidak ditemukan" }, 404);

    // Cek apakah dosen penguji ini sudah memberikan penilaian
    const existingEval = sem.evaluations.find((e) => e.lecturerId === lc.id);
    if (existingEval) {
      return c.json({ error: "Anda sudah memberikan penilaian untuk seminar ini" }, 400);
    }

    if (sem.evaluations.length >= 2) {
      return c.json({ error: "Seminar ini sudah dinilai lengkap oleh 2 dosen penguji" }, 400);
    }

    // Tentukan peran penguji (Penguji 1 atau Penguji 2)
    const examinerRole = sem.evaluations.length === 0 ? "PENGUJI_1" : "PENGUJI_2";

    const [newEval] = await db
      .insert(s.seminarEvaluations)
      .values({
        seminarId: sem.id,
        lecturerId: lc.id,
        examinerRole,
        theoryMasteryScore: body.theoryMasteryScore,
        methodologyScore: body.methodologyScore,
        writingQualityScore: body.writingQualityScore,
        comments: body.comments,
        decision: body.decision,
      })
      .returning();

    // Hitung total penilaian setelah submit ini
    const totalEvals = sem.evaluations.length + 1;
    let finalOutcome = sem.outcome;
    let finalStatus = sem.status;

    // Jika sudah lengkap 2 dosen penguji yang menilai
    if (totalEvals >= 2) {
      finalStatus = "SELESAI";
      const allDecisions = [...sem.evaluations.map((e) => e.decision), body.decision];
      if (allDecisions.includes("TIDAK_LULUS")) {
        finalOutcome = "TIDAK_LULUS";
      } else if (allDecisions.includes("LULUS_DENGAN_REVISI")) {
        finalOutcome = "LULUS_DENGAN_REVISI";
      } else {
        finalOutcome = "LULUS";
      }

      await db
        .update(s.seminars)
        .set({ status: finalStatus, outcome: finalOutcome, updatedAt: new Date() })
        .where(eq(s.seminars.id, sem.id));

      // Beri notifikasi ke mahasiswa pemilik tesis
      await notify(
        sem.thesis.student.userId,
        "SEMINAR_EVALUATED",
        "Hasil Seminar Proposal Diumumkan",
        `Seminar proposal thesis Anda telah dinilai oleh 2 dosen penguji dengan hasil akhir: ${finalOutcome}.`,
        sem.id
      );
    }

    await audit(u.sub, "SEMINAR_EVALUATE", "seminar_evaluation", newEval.id, {
      seminarId: sem.id,
      examinerRole,
      decision: body.decision,
      totalEvals,
    });

    return c.json({
      evaluation: newEval,
      seminarStatus: finalStatus,
      seminarOutcome: finalOutcome,
      evaluationsCount: totalEvals,
      isCompleted: totalEvals >= 2,
    });
  });
