import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { evaluationSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { audit, lecturerOf, notify, type Env } from "../lib";

export const evaluationRoutes = new Hono<Env>()
  .use(authenticate, requireRole("PEMBIMBING", "KOORDINATOR", "KEPALA_PRODI"))
  // Antrean logbook menunggu validasi dari mahasiswa bimbingan
  .get("/queue", async (c) => {
    const u = c.get("user");
    const lc = await lecturerOf(u.sub);
    if (!lc) return c.json([]);

    // Cari semua penugasan pembimbing aktif untuk dosen ini
    const assignments = await db.query.supervisorAssignments.findMany({
      where: and(eq(s.supervisorAssignments.lecturerId, lc.id), eq(s.supervisorAssignments.active, true)),
    });
    const thesisIds = assignments.map((a) => a.thesisId);
    if (thesisIds.length === 0) return c.json([]);

    const rows = await db.query.logbooks.findMany({
      where: and(inArray(s.logbooks.thesisId, thesisIds), eq(s.logbooks.status, "MENUNGGU_VALIDASI")),
      orderBy: asc(s.logbooks.sessionDate),
      with: {
        thesis: {
          with: {
            student: { with: { user: true } },
            supervisors: { with: { lecturer: { with: { user: true } } } },
          },
        },
        versions: {
          with: {
            evaluations: { with: { lecturer: { with: { user: true } } } },
          },
          orderBy: desc(s.logbookVersions.versionNo),
        },
      },
    });

    // Filter: Tampilkan logbook yang belum divalidasi oleh dosen ini pada versi saat ini
    const pendingForMe = rows.filter((l) => {
      const curVer = l.versions.find((v) => v.versionNo === l.currentVersion);
      if (!curVer) return true;
      const alreadyEvaluatedByMe = curVer.evaluations.some((e) => e.lecturerId === lc.id);
      return !alreadyEvaluatedByMe;
    });

    return c.json(
      pendingForMe.map((l) => {
        const curVer = l.versions.find((v) => v.versionNo === l.currentVersion);
        const activeSupervisors = l.thesis.supervisors.filter((s) => s.active);
        const evals = curVer?.evaluations ?? [];
        const approvedCount = evals.filter((e) => e.decision === "DISETUJUI").length;

        return {
          id: l.id,
          topic: l.topic,
          sessionDate: l.sessionDate.toISOString(),
          version: l.currentVersion,
          progress: l.progress,
          challenges: l.challenges ?? "",
          nextSteps: l.nextSteps ?? "",
          studentName: l.thesis.student.user.name,
          nim: l.thesis.student.nim,
          thesisTitle: l.thesis.title,
          totalSupervisors: activeSupervisors.length,
          approvedCount,
          supervisors: activeSupervisors.map((s) => ({
            lecturerId: s.lecturerId,
            name: s.lecturer.user.name,
            type: s.supervisorType,
            approved: evals.some((e) => e.lecturerId === s.lecturerId && e.decision === "DISETUJUI"),
          })),
        };
      })
    );
  })
  .post("/", zValidator("json", evaluationSchema), async (c) => {
    const u = c.get("user");
    const b = c.req.valid("json");
    const lc = await lecturerOf(u.sub);
    if (!lc) return c.json({ error: "Profil dosen tidak ditemukan" }, 400);

    const lb = await db.query.logbooks.findFirst({
      where: eq(s.logbooks.id, b.logbookId),
      with: {
        thesis: {
          with: {
            student: { with: { user: true } },
            supervisors: { with: { lecturer: { with: { user: true } } } },
          },
        },
      },
    });
    if (!lb) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (lb.status !== "MENUNGGU_VALIDASI") return c.json({ error: "Logbook tidak sedang menunggu validasi" }, 409);

    const activeSupervisors = lb.thesis.supervisors.filter((s) => s.active);
    const isSupervisor = activeSupervisors.some((s) => s.lecturerId === lc.id);
    if (!isSupervisor && u.role !== "KOORDINATOR" && u.role !== "KEPALA_PRODI") {
      return c.json({ error: "Anda bukan dosen pembimbing untuk mahasiswa ini" }, 403);
    }

    const ver = await db.query.logbookVersions.findFirst({
      where: and(eq(s.logbookVersions.logbookId, lb.id), eq(s.logbookVersions.versionNo, lb.currentVersion)),
    });
    if (!ver) return c.json({ error: "Versi logbook tidak ditemukan" }, 409);

    const existingEval = await db.query.supervisorEvaluations.findFirst({
      where: and(eq(s.supervisorEvaluations.logbookVersionId, ver.id), eq(s.supervisorEvaluations.lecturerId, lc.id)),
    });
    if (existingEval) {
      return c.json({ error: "Anda sudah melakukan validasi untuk versi logbook ini" }, 409);
    }

    const [ev] = await db.insert(s.supervisorEvaluations).values({
      logbookVersionId: ver.id,
      lecturerId: lc.id,
      researchProgressScore: b.researchProgressScore,
      scheduleComplianceScore: b.scheduleComplianceScore,
      onTimeCompletionScore: b.onTimeCompletionScore,
      comments: b.comments,
      decision: b.decision,
    }).returning();

    let finalDecision: "DISETUJUI" | "PERLU_REVISI" | "MENUNGGU_VALIDASI" = "MENUNGGU_VALIDASI";

    if (b.decision === "PERLU_REVISI") {
      finalDecision = "PERLU_REVISI";
      await db.update(s.logbooks).set({ status: "PERLU_REVISI" }).where(eq(s.logbooks.id, lb.id));
      await notify(
        lb.thesis.student.userId,
        "LOGBOOK_PERLU_REVISI",
        "Logbook perlu revisi",
        `Logbook "${lb.topic}" memerlukan revisi dari ${u.name}: ${b.comments}`,
        `logbook:${lb.id}`
      );
    } else {
      const allEvals = await db.query.supervisorEvaluations.findMany({
        where: eq(s.supervisorEvaluations.logbookVersionId, ver.id),
      });
      const approvedLecturerIds = new Set(allEvals.filter((e) => e.decision === "DISETUJUI").map((e) => e.lecturerId));
      const allApproved = activeSupervisors.length > 0 && activeSupervisors.every((s) => approvedLecturerIds.has(s.lecturerId));

      if (allApproved) {
        finalDecision = "DISETUJUI";
        await db.update(s.logbooks).set({ status: "DISETUJUI" }).where(eq(s.logbooks.id, lb.id));
        await notify(
          lb.thesis.student.userId,
          "LOGBOOK_DISETUJUI",
          "Logbook telah disetujui",
          `Logbook "${lb.topic}" telah divalidasi dan disetujui oleh seluruh dosen pembimbing (${activeSupervisors.length} pembimbing).`,
          `logbook:${lb.id}`
        );
      } else {
        finalDecision = "MENUNGGU_VALIDASI";
        const remainingCount = activeSupervisors.length - approvedLecturerIds.size;
        await notify(
          lb.thesis.student.userId,
          "LOGBOOK_PARTIAL_APPROVAL",
          "Validasi logbook berjalan",
          `Logbook "${lb.topic}" telah disetujui oleh ${u.name}. Menunggu validasi dari ${remainingCount} pembimbing lainnya.`,
          `logbook:${lb.id}`
        );
      }
    }

    await audit(u.sub, "LOGBOOK_EVALUATE", "logbook", lb.id, { decision: b.decision, finalStatus: finalDecision, evaluationId: ev.id });
    return c.json({ id: ev.id, decision: b.decision, finalStatus: finalDecision });
  });
