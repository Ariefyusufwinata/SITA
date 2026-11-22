import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { evaluationSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { audit, lecturerOf, notify, type Env } from "../lib";

export const evaluationRoutes = new Hono<Env>()
  .use(authenticate, requireRole("PEMBIMBING", "KOORDINATOR"))
  // Antrean logbook menunggu validasi dari mahasiswa bimbingan
  .get("/queue", async (c) => {
    const u = c.get("user");
    const lc = await lecturerOf(u.sub);
    if (!lc) return c.json([]);
    const rows = await db.query.logbooks.findMany({
      where: and(eq(s.logbooks.status, "MENUNGGU_VALIDASI"), eq(s.logbooks.lecturerId, lc.id)),
      orderBy: asc(s.logbooks.sessionDate),
      with: { thesis: { with: { student: { with: { user: true } } } } },
    });
    return c.json(rows.map((l) => ({
      id: l.id, topic: l.topic, sessionDate: l.sessionDate.toISOString(), version: l.currentVersion,
      progress: l.progress, challenges: l.challenges ?? "", nextSteps: l.nextSteps ?? "",
      attachmentName: l.attachmentName, attachmentKey: l.attachmentKey,
      studentName: l.thesis.student.user.name, nim: l.thesis.student.nim, thesisTitle: l.thesis.title,
    })));
  })
  .post("/", zValidator("json", evaluationSchema), async (c) => {
    const u = c.get("user"); const b = c.req.valid("json");
    const lc = await lecturerOf(u.sub);
    if (!lc) return c.json({ error: "Profil dosen tidak ditemukan" }, 400);
    const lb = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, b.logbookId), with: { thesis: { with: { student: true } } } });
    if (!lb) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (lb.status !== "MENUNGGU_VALIDASI") return c.json({ error: "Logbook tidak sedang menunggu validasi" }, 409);
    const ver = await db.query.logbookVersions.findFirst({ where: and(eq(s.logbookVersions.logbookId, lb.id), eq(s.logbookVersions.versionNo, lb.currentVersion)) });
    if (!ver) return c.json({ error: "Versi logbook tidak ditemukan" }, 409);
    const [ev] = await db.insert(s.supervisorEvaluations).values({
      logbookVersionId: ver.id, lecturerId: lc.id, researchProgressScore: b.researchProgressScore, scheduleComplianceScore: b.scheduleComplianceScore,
      onTimeCompletionScore: b.onTimeCompletionScore, comments: b.comments, decision: b.decision,
    }).returning();
    await db.update(s.logbooks).set({ status: b.decision }).where(eq(s.logbooks.id, lb.id));
    const approved = b.decision === "DISETUJUI";
    await notify(lb.thesis.student.userId, "LOGBOOK_" + b.decision, approved ? "Logbook disetujui" : "Logbook perlu revisi",
      approved ? `Logbook "${lb.topic}" telah disetujui pembimbing.` : `Logbook "${lb.topic}" perlu revisi: ${b.comments}`, `logbook:${lb.id}`);
    await audit(u.sub, "LOGBOOK_EVALUATE", "logbook", lb.id, { decision: b.decision, evaluationId: ev.id });
    return c.json({ id: ev.id, decision: b.decision });
  });
