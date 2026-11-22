import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { LOGBOOK_STATUSES, logbookSaveSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { activeTerm, activeThesisOfStudent, audit, notify, studentOf, lecturerOf, type Env } from "../lib";

const shape = (l: typeof s.logbooks.$inferSelect & { lecturer?: any; thesis?: any }) => ({
  id: l.id,
  thesisId: l.thesisId,
  lecturerId: l.lecturerId,
  lecturerName: l.lecturer?.user?.name ?? null,
  studentName: l.thesis?.student?.user?.name ?? null,
  nim: l.thesis?.student?.nim ?? null,
  sessionDate: l.sessionDate.toISOString(),
  topic: l.topic,
  progress: l.progress,
  challenges: l.challenges ?? "",
  nextSteps: l.nextSteps ?? "",
  status: l.status,
  currentVersion: l.currentVersion,
});

const withRel = {
  lecturer: { with: { user: true } },
  thesis: { with: { student: { with: { user: true } }, supervisors: { with: { lecturer: { with: { user: true } } } } } },
} as const;

async function submitVersion(l: typeof s.logbooks.$inferSelect, actorId: string) {
  const version = l.currentVersion + 1;
  await db.insert(s.logbookVersions).values({
    logbookId: l.id,
    versionNo: version,
    payloadJson: {
      topic: l.topic,
      progress: l.progress,
      challenges: l.challenges,
      nextSteps: l.nextSteps,
      sessionDate: l.sessionDate,
      lecturerId: l.lecturerId,
    },
  });
  await db.update(s.logbooks).set({ status: "MENUNGGU_VALIDASI", currentVersion: version }).where(eq(s.logbooks.id, l.id));

  // Beritahu seluruh dosen pembimbing aktif tesis ini
  const supervisors = await db.query.supervisorAssignments.findMany({
    where: and(eq(s.supervisorAssignments.thesisId, l.thesisId), eq(s.supervisorAssignments.active, true)),
    with: { lecturer: true },
  });
  for (const sup of supervisors) {
    if (sup.lecturer) {
      await notify(
        sup.lecturer.userId,
        "LOGBOOK_SUBMITTED",
        "Logbook baru menunggu validasi",
        `Logbook "${l.topic}" (versi ${version}) diajukan dan membutuhkan validasi Anda.`,
        `logbook:${l.id}`
      );
    }
  }
  await audit(actorId, "LOGBOOK_SUBMIT", "logbook", l.id, { version });
}

export const logbookRoutes = new Hono<Env>()
  .use(authenticate)
  // Daftar logbook
  .get("/", zValidator("query", z.object({ status: z.enum(LOGBOOK_STATUSES).optional() })), async (c) => {
    const u = c.get("user");
    const { status } = c.req.valid("query");
    let thesisId: string | undefined;

    if (u.role === "MAHASISWA") {
      const st = await studentOf(u.sub);
      const th = st && (await activeThesisOfStudent(st.id));
      if (!th) return c.json([]);
      thesisId = th.id;
    } else if (u.role === "PEMBIMBING") {
      const lc = await lecturerOf(u.sub);
      if (!lc) return c.json([]);
      const as = await db.query.supervisorAssignments.findMany({
        where: and(eq(s.supervisorAssignments.lecturerId, lc.id), eq(s.supervisorAssignments.active, true)),
      });
      const tIds = as.map((a) => a.thesisId);
      if (tIds.length === 0) return c.json([]);

      const rows = await db.query.logbooks.findMany({
        where: and(inArray(s.logbooks.thesisId, tIds), status ? eq(s.logbooks.status, status) : undefined),
        orderBy: desc(s.logbooks.sessionDate),
        with: {
          ...withRel,
          versions: { with: { evaluations: { with: { lecturer: { with: { user: true } } } } }, orderBy: desc(s.logbookVersions.versionNo) },
        },
      });

      return c.json(
        rows.map((r) => {
          const curVer = r.versions.find((v) => v.versionNo === r.currentVersion);
          const activeSups = r.thesis?.supervisors?.filter((s: any) => s.active) ?? [];
          const evals = curVer?.evaluations ?? [];
          const approvedCount = evals.filter((e) => e.decision === "DISETUJUI").length;
          return {
            ...shape(r),
            totalSupervisors: activeSups.length,
            approvedCount,
            evaluationsSummary: activeSups.map((s: any) => ({
              name: s.lecturer?.user?.name,
              type: s.supervisorType,
              decision: evals.find((e) => e.lecturerId === s.lecturerId)?.decision ?? "MENUNGGU",
            })),
          };
        })
      );
    }

    const rows = await db.query.logbooks.findMany({
      where: and(thesisId ? eq(s.logbooks.thesisId, thesisId) : undefined, status ? eq(s.logbooks.status, status) : undefined),
      orderBy: desc(s.logbooks.sessionDate),
      with: {
        ...withRel,
        versions: { with: { evaluations: { with: { lecturer: { with: { user: true } } } } }, orderBy: desc(s.logbookVersions.versionNo) },
      },
    });

    return c.json(
      rows.map((r) => {
        const curVer = r.versions.find((v) => v.versionNo === r.currentVersion);
        const activeSups = r.thesis?.supervisors?.filter((s: any) => s.active) ?? [];
        const evals = curVer?.evaluations ?? [];
        const approvedCount = evals.filter((e) => e.decision === "DISETUJUI").length;
        return {
          ...shape(r),
          totalSupervisors: activeSups.length,
          approvedCount,
          evaluationsSummary: activeSups.map((s: any) => ({
            name: s.lecturer?.user?.name,
            type: s.supervisorType,
            decision: evals.find((e) => e.lecturerId === s.lecturerId)?.decision ?? "MENUNGGU",
          })),
        };
      })
    );
  })
  // Pembimbing aktif untuk dropdown form
  .get("/supervisors", requireRole("MAHASISWA"), async (c) => {
    const st = await studentOf(c.get("user").sub);
    const th = st && (await activeThesisOfStudent(st.id));
    if (!th) return c.json([]);
    const as = await db.query.supervisorAssignments.findMany({
      where: and(eq(s.supervisorAssignments.thesisId, th.id), eq(s.supervisorAssignments.active, true)),
      with: { lecturer: { with: { user: true } } },
    });
    return c.json(
      as.map((a) => ({
        lecturerId: a.lecturerId,
        name: a.lecturer.user.name,
        type: a.supervisorType,
      }))
    );
  })
  .get("/:id", async (c) => {
    const l = await db.query.logbooks.findFirst({
      where: eq(s.logbooks.id, c.req.param("id")),
      with: {
        ...withRel,
        versions: {
          with: { evaluations: { with: { lecturer: { with: { user: true } } } } },
          orderBy: desc(s.logbookVersions.versionNo),
        },
      },
    });
    if (!l) return c.json({ error: "Logbook tidak ditemukan" }, 404);

    const activeSupervisors = l.thesis?.supervisors?.filter((s: any) => s.active) ?? [];
    const curVer = l.versions.find((v) => v.versionNo === l.currentVersion);
    const curEvals = curVer?.evaluations ?? [];

    return c.json({
      ...shape(l),
      totalSupervisors: activeSupervisors.length,
      approvedCount: curEvals.filter((e) => e.decision === "DISETUJUI").length,
      supervisors: activeSupervisors.map((s: any) => ({
        lecturerId: s.lecturerId,
        name: s.lecturer?.user?.name,
        type: s.supervisorType,
        approved: curEvals.some((e) => e.lecturerId === s.lecturerId && e.decision === "DISETUJUI"),
      })),
      versions: l.versions.map((v) => {
        const evals = v.evaluations.map((e) => ({
          id: e.id,
          lecturerId: e.lecturerId,
          lecturerName: e.lecturer?.user?.name ?? "Dosen Pembimbing",
          researchProgressScore: e.researchProgressScore,
          scheduleComplianceScore: e.scheduleComplianceScore,
          onTimeCompletionScore: e.onTimeCompletionScore,
          comments: e.comments,
          decision: e.decision,
          decidedAt: e.decidedAt.toISOString(),
        }));
        return {
          id: v.id,
          versionNo: v.versionNo,
          submittedAt: v.submittedAt.toISOString(),
          payload: v.payloadJson as Record<string, unknown>,
          evaluations: evals,
          evaluation: evals[0] ?? null,
        };
      }),
    });
  })
  // Buat logbook baru
  .post("/", requireRole("MAHASISWA"), zValidator("json", logbookSaveSchema), async (c) => {
    const u = c.get("user");
    const b = c.req.valid("json");
    const st = await studentOf(u.sub);
    const th = st && (await activeThesisOfStudent(st.id));
    const term = await activeTerm();
    if (!th || !term) return c.json({ error: "Tesis aktif / semester aktif tidak ditemukan" }, 400);

    const [row] = await db
      .insert(s.logbooks)
      .values({
        thesisId: th.id,
        lecturerId: b.lecturerId,
        termId: term.id,
        sessionDate: new Date(b.sessionDate),
        topic: b.topic,
        progress: b.progress,
        challenges: b.challenges,
        nextSteps: b.nextSteps,
        status: "DRAFT",
      })
      .returning();

    await audit(u.sub, "LOGBOOK_CREATE", "logbook", row.id);
    if (b.submit) await submitVersion(row, u.sub);
    return c.json(shape(row), 201);
  })
  // Edit logbook (hanya DRAFT atau PERLU_REVISI)
  .put("/:id", requireRole("MAHASISWA"), zValidator("json", logbookSaveSchema), async (c) => {
    const u = c.get("user");
    const b = c.req.valid("json");
    const cur = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, c.req.param("id")) });
    if (!cur) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (cur.status !== "DRAFT" && cur.status !== "PERLU_REVISI") return c.json({ error: "Logbook terkunci" }, 409);

    const [row] = await db
      .update(s.logbooks)
      .set({
        lecturerId: b.lecturerId,
        sessionDate: new Date(b.sessionDate),
        topic: b.topic,
        progress: b.progress,
        challenges: b.challenges,
        nextSteps: b.nextSteps,
      })
      .where(eq(s.logbooks.id, cur.id))
      .returning();

    await audit(u.sub, "LOGBOOK_UPDATE", "logbook", row.id);
    if (b.submit) await submitVersion(row, u.sub);
    return c.json(shape(row));
  })
  .delete("/:id", requireRole("MAHASISWA"), async (c) => {
    const cur = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, c.req.param("id")) });
    if (!cur) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (cur.status !== "DRAFT") return c.json({ error: "Hanya draf yang dapat dibatalkan" }, 409);
    await db.update(s.logbooks).set({ status: "DIBATALKAN" }).where(eq(s.logbooks.id, cur.id));
    await audit(c.get("user").sub, "LOGBOOK_CANCEL", "logbook", cur.id);
    return c.json({ ok: true });
  });
