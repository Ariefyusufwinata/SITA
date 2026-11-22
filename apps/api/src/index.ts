import "./env";
import { serve } from "@hono/node-server";
import app from "./app";

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });

console.log(`
🚀 [Backend API] Berjalan di port internal ${port} (diakses via proxy http://localhost:3000/api):
   ➜ Internal Base URL : http://localhost:${port}
   ➜ Public API Path   : http://localhost:3000/api
   ➜ Swagger API Docs  : http://localhost:3000/api/docs (atau http://localhost:3000/docs)
   ➜ OpenAPI JSON Spec : http://localhost:3000/api/openapi.json
   ➜ Paths / Endpoints:
      • Auth          : /api/auth
      • Dashboard     : /api/dashboard
      • Thesis        : /api/thesis
      • Logbooks      : /api/logbooks
      • Topics        : /api/topics
      • Evaluations   : /api/evaluations
      • Notifications : /api/notifications
      • Health Check  : /api/health
`);
