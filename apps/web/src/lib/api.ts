import { hc } from "hono/client";
import type { AppType } from "@sita/api/app";

const TOKEN_KEY = "sita_token";
const ROLE_KEY = "sita_role";
const ACTIVE_ROLE_KEY = "sita_role_active";

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },

  // Ambil daftar roles dari localStorage (disimpan dalam bentuk array)
  get roles(): string[] {
    const raw = localStorage.getItem(ROLE_KEY);
    let list: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed.map(String);
        else list = [String(parsed)];
      } catch {
        list = [raw];
      }
    }
    // Jika peran aktif yang di-set berada di luar array, tetap masukkan agar tampil di UI
    const active = localStorage.getItem(ACTIVE_ROLE_KEY);
    if (active && !list.includes(active)) {
      list = [active, ...list];
    }
    return list;
  },

  // Peran aktif yang sedang digunakan (prioritaskan sita_role_active meskipun di luar array)
  get activeRole(): string | null {
    const active = localStorage.getItem(ACTIVE_ROLE_KEY);
    if (active) return active;
    const list = auth.roles;
    return list[0] ?? null;
  },

  // Kompatibilitas dengan pembacaan auth.role
  get role(): string | null {
    return auth.activeRole;
  },

  // Simpan token dan roles (array) ke localStorage
  set(t: string, rolesOrActive?: string | string[], active?: string) {
    localStorage.setItem(TOKEN_KEY, t);
    if (Array.isArray(rolesOrActive)) {
      localStorage.setItem(ROLE_KEY, JSON.stringify(rolesOrActive));
      const chosen = active ?? rolesOrActive[0] ?? "";
      localStorage.setItem(ACTIVE_ROLE_KEY, chosen);
    } else if (rolesOrActive) {
      try {
        const parsed = JSON.parse(rolesOrActive);
        if (Array.isArray(parsed)) {
          localStorage.setItem(ROLE_KEY, JSON.stringify(parsed));
          const chosen = active ?? parsed[0] ?? "";
          localStorage.setItem(ACTIVE_ROLE_KEY, chosen);
          return;
        }
      } catch {}
      localStorage.setItem(ROLE_KEY, JSON.stringify([rolesOrActive]));
      const chosen = active ?? rolesOrActive;
      localStorage.setItem(ACTIVE_ROLE_KEY, chosen);
    }
  },

  // Ganti peran aktif di localStorage
  setActiveRole(r: string) {
    localStorage.setItem(ACTIVE_ROLE_KEY, r);
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(ACTIVE_ROLE_KEY);
  },
};

export const client = hc<AppType>("/", {
  headers: () => {
    const headers: Record<string, string> = {};
    if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
    // Kirim role dari storage untuk memfasilitasi pengujian Privilege Escalation
    if (auth.role) headers["X-User-Role"] = auth.role;
    return headers;
  },
});

type NoErr<T> = T extends { error: string } ? never : T;
export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function unwrap<R extends { ok: boolean; status: number; json(): Promise<any> }>(p: Promise<R>): Promise<NoErr<Awaited<ReturnType<R["json"]>>>> {
  const res = await p;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { auth.clear(); if (!location.pathname.startsWith("/login")) location.href = "/login"; }
    throw new ApiError(body?.error ?? body?.message ?? "Terjadi kesalahan", res.status);
  }
  return body;
}
