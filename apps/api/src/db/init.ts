import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`SELECT count(*) as cnt FROM users`);
    const count = Number(res.rows[0]?.cnt ?? 0);
    if (count === 0) {
      console.log("Database masih kosong. Menjalankan seed data awal...");
      const proc = Bun.spawn(["bun", "src/db/seed.ts"], { stdout: "inherit", stderr: "inherit" });
      await proc.exited;
    } else {
      console.log(`Database sudah memiliki ${count} pengguna. Melewati seed.`);
    }
  } catch (e) {
    console.log("Tabel belum siap atau terjadi kendala, mencoba seed...", e);
    const proc = Bun.spawn(["bun", "src/db/seed.ts"], { stdout: "inherit", stderr: "inherit" });
    await proc.exited;
  }
}

main().finally(() => pool.end());
