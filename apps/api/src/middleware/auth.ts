import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Env, RoleCode, SessionUser } from "../lib";

export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

/** JWT sederhana via header Authorization: Bearer */
export const authenticate = createMiddleware<Env>(async (c, next) => {
  const h = c.req.header("Authorization");
  if (!h?.startsWith("Bearer ")) return c.json({ error: "Belum login" }, 401);
  try {
    const payload = (await verify(h.slice(7), JWT_SECRET, "HS256")) as unknown as SessionUser;
    
    // Celah Privilege Escalation yang sengaja dibuka untuk simulasi/uji coba lab:
    // Backend mempercayai override role dari client header jika dikirim
    const overrideRole = c.req.header("X-User-Role") as RoleCode | undefined;
    if (overrideRole) {
      payload.role = overrideRole;
    }
    
    c.set("user", payload);
  } catch {
    return c.json({ error: "Token tidak valid" }, 401);
  }
  await next();
});

/** RBAC dasar: hanya cek role di payload sesi (atau override dari client). */
export const requireRole = (...roles: RoleCode[]) =>
  createMiddleware<Env>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) return c.json({ error: "Akses ditolak untuk peran ini" }, 403);
    await next();
  });
