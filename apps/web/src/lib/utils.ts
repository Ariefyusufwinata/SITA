import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

const TZ = "Asia/Jakarta";
/** Tampilkan waktu UTC dari server dalam WIB */
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) + " WIB";
/** yyyy-mm-dd menurut WIB untuk <input type="date"> */
export const toDateInput = (iso: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
