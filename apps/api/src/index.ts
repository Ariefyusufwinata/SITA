import "./env";
import { serve } from "@hono/node-server";
import app from "./app";

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`SITA API berjalan di http://localhost:${port}`);
