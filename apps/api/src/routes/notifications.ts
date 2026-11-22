import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "../db";
import { authenticate } from "../middleware/auth";
import type { Env } from "../lib";

export const notificationRoutes = new Hono<Env>()
  .use(authenticate)
  .get("/", async (c) => {
    const uid = c.get("user").sub;
    const rows = await db.query.notifications.findMany({ where: eq(s.notifications.recipientUserId, uid), orderBy: desc(s.notifications.createdAt), limit: 30 });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.notifications).where(and(eq(s.notifications.recipientUserId, uid), isNull(s.notifications.readAt)));
    return c.json({ unread: n, items: rows.map((r) => ({ id: r.id, eventType: r.eventType, title: r.title, message: r.message, objectRef: r.objectRef, read: !!r.readAt, createdAt: r.createdAt.toISOString() })) });
  })
  .post("/read-all", async (c) => {
    const uid = c.get("user").sub;
    await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.recipientUserId, uid), isNull(s.notifications.readAt)));
    return c.json({ ok: true });
  })
  .post("/:id/read", async (c) => {
    await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.id, c.req.param("id")), eq(s.notifications.recipientUserId, c.get("user").sub)));
    return c.json({ ok: true });
  });
