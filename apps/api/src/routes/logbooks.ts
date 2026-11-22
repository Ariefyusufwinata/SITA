import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LOGBOOK_STATUSES, logbookSaveSchema } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { activeTerm, activeThesisOfStudent, audit, notify, studentOf, lecturerOf, type Env } from "../lib";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const ALLOWED = [".pdf", ".docx", ".pptx"];
const MAX_BYTES = 20 * 1024 * 1024;

const shape = (l: typeof s.logbooks.$inferSelect & { lecturer?: any; thesis?: any }) => ({
  id: l.id, thesisId: l.thesisId, lecturerId: l.lecturerId, lecturerName: l.lecturer?.user?.name ?? null,
  studentName: l.thesis?.student?.user?.name ?? null, nim: l.thesis?.student?.nim ?? null,
  sessionDate: l.sessionDate.toISOString(), topic: l.topic, progress: l.progress, challenges: l.challenges ?? "", nextSteps: l.nextSteps ?? "",
  status: l.status, currentVersion: l.currentVersion, attachmentName: l.attachmentName, attachmentKey: l.attachmentKey,
});
const withRel = { lecturer: { with: { user: true } }, thesis: { with: { student: { with: { user: true } } } } } as const;

async function submitVersion(l: typeof s.logbooks.$inferSelect, actorId: string) {
  const version = l.currentVersion + 1;
  await db.insert(s.logbookVersions).values({
    logbookId: l.id, versionNo: version,
    payloadJson: { topic: l.topic, progress: l.progress, challenges: l.challenges, nextSteps: l.nextSteps, sessionDate: l.sessionDate, lecturerId: l.lecturerId, attachmentName: l.attachmentName, attachmentKey: l.attachmentKey },
  });
  await db.update(s.logbooks).set({ status: "MENUNGGU_VALIDASI", currentVersion: version }).where(eq(s.logbooks.id, l.id));
  const lec = await db.query.lecturers.findFirst({ where: eq(s.lecturers.id, l.lecturerId) });
  if (lec) await notify(lec.userId, "LOGBOOK_SUBMITTED", "Logbook baru menunggu validasi", `Logbook "${l.topic}" (versi ${version}) diajukan.`, `logbook:${l.id}`);
  await audit(actorId, "LOGBOOK_SUBMIT", "logbook", l.id, { version });
}

export const logbookRoutes = new Hono<Env>()
  .use(authenticate)
  // Daftar logbook; mahasiswa = miliknya, pembimbing = bimbingannya, lainnya = semua
  .get("/", zValidator("query", z.object({ status: z.enum(LOGBOOK_STATUSES).optional() })), async (c) => {
    const u = c.get("user");
    const { status } = c.req.valid("query");
    let thesisId: string | undefined, lecturerId: string | undefined;
    if (u.role === "MAHASISWA") {
      const st = await studentOf(u.sub); const th = st && (await activeThesisOfStudent(st.id));
      if (!th) return c.json([]);
      thesisId = th.id;
    } else if (u.role === "PEMBIMBING") {
      lecturerId = (await lecturerOf(u.sub))?.id;
      if (!lecturerId) return c.json([]);
    }
    const rows = await db.query.logbooks.findMany({
      where: and(thesisId ? eq(s.logbooks.thesisId, thesisId) : undefined, lecturerId ? eq(s.logbooks.lecturerId, lecturerId) : undefined, status ? eq(s.logbooks.status, status) : undefined),
      orderBy: desc(s.logbooks.sessionDate), with: withRel,
    });
    return c.json(rows.map(shape));
  })
  // Pembimbing aktif untuk dropdown form
  .get("/supervisors", requireRole("MAHASISWA"), async (c) => {
    const st = await studentOf(c.get("user").sub); const th = st && (await activeThesisOfStudent(st.id));
    if (!th) return c.json([]);
    const as = await db.query.supervisorAssignments.findMany({ where: and(eq(s.supervisorAssignments.thesisId, th.id), eq(s.supervisorAssignments.active, true)), with: { lecturer: { with: { user: true } } } });
    return c.json(as.map((a) => ({ lecturerId: a.lecturerId, name: a.lecturer.user.name, type: a.supervisorType })));
  })
  // Unggah lampiran ke /uploads (ekstensi dasar saja)
  .post("/upload", requireRole("MAHASISWA"), async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) return c.json({ error: "File tidak ditemukan" }, 400);
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) return c.json({ error: `Ekstensi tidak diizinkan. Gunakan: ${ALLOWED.join(", ")}` }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: "Ukuran file maksimal 20 MB" }, 400);
    await mkdir(UPLOAD_DIR, { recursive: true });
    const key = `${randomUUID()}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, key), Buffer.from(await file.arrayBuffer()));
    await audit(c.get("user").sub, "FILE_UPLOAD", "file", key, { name: file.name, size: file.size });
    return c.json({ attachmentKey: key, attachmentName: file.name }, 201);
  })
  .get("/files/:key", async (c) => {
    const key = path.basename(c.req.param("key"));
    try {
      const buf = await readFile(path.join(UPLOAD_DIR, key));
      const l = await db.query.logbooks.findFirst({ where: eq(s.logbooks.attachmentKey, key) });
      c.header("Content-Disposition", `attachment; filename="${encodeURIComponent(l?.attachmentName ?? key)}"`);
      c.header("Content-Type", "application/octet-stream");
      return c.body(buf);
    } catch { return c.json({ error: "File tidak ditemukan" }, 404); }
  })
  .get("/:id", async (c) => {
    const l = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, c.req.param("id")), with: { ...withRel, versions: { with: { evaluations: true }, orderBy: desc(s.logbookVersions.versionNo) } } });
    if (!l) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    return c.json({
      ...shape(l),
      versions: l.versions.map((v) => ({ id: v.id, versionNo: v.versionNo, submittedAt: v.submittedAt.toISOString(), payload: v.payloadJson as Record<string, unknown>,
        evaluation: v.evaluations[0] ? { ...v.evaluations[0], decidedAt: v.evaluations[0].decidedAt.toISOString() } : null })),
    });
  })
  // Buat logbook baru (simpan draft atau langsung ajukan)
  .post("/", requireRole("MAHASISWA"), zValidator("json", logbookSaveSchema), async (c) => {
    const u = c.get("user"); const b = c.req.valid("json");
    const st = await studentOf(u.sub); const th = st && (await activeThesisOfStudent(st.id)); const term = await activeTerm();
    if (!th || !term) return c.json({ error: "Tesis aktif / semester aktif tidak ditemukan" }, 400);
    const [row] = await db.insert(s.logbooks).values({
      thesisId: th.id, lecturerId: b.lecturerId, termId: term.id, sessionDate: new Date(b.sessionDate), topic: b.topic, progress: b.progress,
      challenges: b.challenges, nextSteps: b.nextSteps, attachmentName: b.attachmentName ?? null, attachmentKey: b.attachmentKey ?? null, status: "DRAFT",
    }).returning();
    await audit(u.sub, "LOGBOOK_CREATE", "logbook", row.id);
    if (b.submit) await submitVersion(row, u.sub);
    return c.json({ id: row.id, status: b.submit ? "MENUNGGU_VALIDASI" : "DRAFT" }, 201);
  })
  // Edit (hanya DRAFT / PERLU_REVISI) + opsional ajukan ulang
  .put("/:id", requireRole("MAHASISWA"), zValidator("json", logbookSaveSchema), async (c) => {
    const u = c.get("user"); const b = c.req.valid("json");
    const cur = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, c.req.param("id")) });
    if (!cur) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (cur.status !== "DRAFT" && cur.status !== "PERLU_REVISI") return c.json({ error: "Logbook hanya dapat diubah saat Draft atau Perlu Revisi" }, 409);
    const [row] = await db.update(s.logbooks).set({
      lecturerId: b.lecturerId, sessionDate: new Date(b.sessionDate), topic: b.topic, progress: b.progress, challenges: b.challenges, nextSteps: b.nextSteps,
      attachmentName: b.attachmentName ?? null, attachmentKey: b.attachmentKey ?? null,
    }).where(eq(s.logbooks.id, cur.id)).returning();
    await audit(u.sub, "LOGBOOK_UPDATE", "logbook", row.id);
    if (b.submit) await submitVersion(row, u.sub);
    return c.json({ id: row.id, status: b.submit ? "MENUNGGU_VALIDASI" : row.status });
  })
  .delete("/:id", requireRole("MAHASISWA"), async (c) => {
    const cur = await db.query.logbooks.findFirst({ where: eq(s.logbooks.id, c.req.param("id")) });
    if (!cur) return c.json({ error: "Logbook tidak ditemukan" }, 404);
    if (cur.status !== "DRAFT") return c.json({ error: "Hanya draft yang dapat dibatalkan" }, 409);
    await db.update(s.logbooks).set({ status: "DIBATALKAN" }).where(eq(s.logbooks.id, cur.id));
    await audit(c.get("user").sub, "LOGBOOK_CANCEL", "logbook", cur.id);
    return c.json({ ok: true });
  });
