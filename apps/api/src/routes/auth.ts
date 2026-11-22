import { Hono } from "hono";
import { sign } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import { eq, or } from "drizzle-orm";
import { devLoginSchema, ROLE_LABELS } from "@sita/shared";
import { db, schema as s } from "../db";
import { authenticate, JWT_SECRET } from "../middleware/auth";
import { audit, type Env, type RoleCode } from "../lib";

async function rolesOf(userId: string): Promise<RoleCode[]> {
  const rows = await db.query.userRoles.findMany({ where: eq(s.userRoles.userId, userId), with: { role: true } });
  return rows.map((r) => r.role.code);
}

export const authRoutes = new Hono<Env>()
  // Daftar akun untuk Quick Role Switcher
  .get("/dev-users", async (c) => {
    const users = await db.query.users.findMany({ with: { student: true, lecturer: true, userRoles: { with: { role: true } } } });
    return c.json(users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      defaultPassword: u.passwordHash,
      nim: u.student?.nim ?? null,
      nip: u.lecturer?.nip ?? null,
      roles: u.userRoles.map((r) => ({ code: r.role.code, label: ROLE_LABELS[r.role.code] })),
    })));
  })
  // Endpoint login dev instan
  .post("/dev-login", zValidator("json", devLoginSchema), async (c) => {
    const { identifier, userId, role } = c.req.valid("json");
    let user = userId ? await db.query.users.findFirst({ where: eq(s.users.id, userId) }) : undefined;
    if (!user && identifier) {
      const st = await db.query.students.findFirst({ where: eq(s.students.nim, identifier) });
      const lc = await db.query.lecturers.findFirst({ where: eq(s.lecturers.nip, identifier) });
      user = await db.query.users.findFirst({
        where: or(
          eq(s.users.username, identifier),
          eq(s.users.email, identifier),
          st ? eq(s.users.id, st.userId) : undefined,
          lc ? eq(s.users.id, lc.userId) : undefined
        ),
      });
    }
    if (!user || !user.active) return c.json({ error: "Akun tidak ditemukan" }, 404);
    const roles = await rolesOf(user.id);
    if (!roles.includes(role)) return c.json({ error: `Akun ini tidak memiliki peran ${ROLE_LABELS[role]}` }, 403);
    
    // Token Steal target: Long-lived token tanpa rotasi refresh token (24 jam)
    const session = { sub: user.id, name: user.name, role, exp: Math.floor(Date.now() / 1000) + 86400 };
    const token = await sign(session, JWT_SECRET);
    await audit(user.id, "LOGIN", "user", user.id, { role });
    return c.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email, role, roles } });
  })
  // Endpoint login dengan Username & Password
  .post("/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const username = (body.username || body.identifier || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!username) return c.json({ error: "Username wajib diisi" }, 400);
    if (!password) return c.json({ error: "Password wajib diisi" }, 400);

    const st = await db.query.students.findFirst({ where: eq(s.students.nim, username) });
    const lc = await db.query.lecturers.findFirst({ where: eq(s.lecturers.nip, username) });

    const user = await db.query.users.findFirst({
      where: or(
        eq(s.users.username, username),
        eq(s.users.email, username),
        st ? eq(s.users.id, st.userId) : undefined,
        lc ? eq(s.users.id, lc.userId) : undefined
      ),
    });

    if (!user) return c.json({ error: "Username tidak ditemukan" }, 404);

    // Verifikasi password (cocok dengan password_hash di database)
    const valid = user.passwordHash ? user.passwordHash === password : true;
    if (!valid) return c.json({ error: "Password salah" }, 401);

    const roles = await rolesOf(user.id);
    const requestedRole = body.role as RoleCode | undefined;
    const activeRole = requestedRole && roles.includes(requestedRole) ? requestedRole : (roles[0] ?? "MAHASISWA");

    const session = { sub: user.id, name: user.name, role: activeRole, exp: Math.floor(Date.now() / 1000) + 86400 };
    const token = await sign(session, JWT_SECRET);
    await audit(user.id, "LOGIN_CREDENTIALS", "user", user.id, { role: activeRole });

    return c.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, email: user.email, role: activeRole, roles },
    });
  })
  .get("/me", authenticate, async (c) => {
    const u = c.get("user");
    const user = await db.query.users.findFirst({ where: eq(s.users.id, u.sub), with: { student: true, lecturer: true } });
    if (!user) return c.json({ error: "Akun tidak ditemukan" }, 404);
    return c.json({ id: user.id, name: user.name, email: user.email, role: u.role, roles: await rolesOf(user.id), nim: user.student?.nim ?? null, nip: user.lecturer?.nip ?? null });
  });
