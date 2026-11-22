import { hc } from "hono/client";
import type { AppType } from "@sita/api/app";

const TOKEN_KEY = "sita_token";
const ROLE_KEY = "sita_role";

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get role() { return localStorage.getItem(ROLE_KEY); },
  set(t: string, r?: string) {
    localStorage.setItem(TOKEN_KEY, t);
    if (r) localStorage.setItem(ROLE_KEY, r);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
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

export async function uploadAttachment(file: File) {
  const fd = new FormData(); fd.append("file", file);
  const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` };
  if (auth.role) headers["X-User-Role"] = auth.role;
  const res = await fetch("/api/v1/logbooks/upload", { method: "POST", body: fd, headers });
  const body = await res.json();
  if (!res.ok) throw new ApiError(body.error ?? "Gagal mengunggah", res.status);
  return body as { attachmentKey: string; attachmentName: string };
}

export async function downloadAttachment(key: string, name: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` };
  if (auth.role) headers["X-User-Role"] = auth.role;
  const res = await fetch(`/api/v1/logbooks/files/${key}`, { headers });
  if (!res.ok) throw new Error("Gagal mengunduh");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
