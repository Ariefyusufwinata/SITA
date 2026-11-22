import { timestamp, uuid } from "drizzle-orm/pg-core";

export const pk = () => uuid("id").primaryKey().defaultRandom();
/** Semua timestamp disimpan dalam UTC (timestamptz). */
export const ts = (name: string) => timestamp(name, { withTimezone: true });
export const createdAt = () => ts("created_at").notNull().defaultNow();
