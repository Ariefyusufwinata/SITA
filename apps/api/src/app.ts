import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiSpec } from "./openapi";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { thesisRoutes } from "./routes/thesis";
import { logbookRoutes } from "./routes/logbooks";
import { evaluationRoutes } from "./routes/evaluations";
import { notificationRoutes } from "./routes/notifications";
import { topicRoutes } from "./routes/topics";
import { seminarRoutes } from "./routes/seminars";

const app = new Hono()
  .use(logger())
  .use("/api/*", cors({ origin: (o) => o, allowHeaders: ["Authorization", "Content-Type", "X-User-Role"] }))
  .get("/", (c) => c.json({ name: "SITA (Sistem Integrasi Tracking Akademik) API", status: "running", docs: "/api/docs", health: "/api/health" }))
  .get("/api/health", (c) => c.json({ ok: true }))
  .get("/api/openapi.json", (c) => c.json(openApiSpec))
  .get("/api/docs", swaggerUI({ url: "/api/openapi.json" }))
  .get("/docs", swaggerUI({ url: "/api/openapi.json" }))
  .route("/api/auth", authRoutes)
  .route("/api/dashboard", dashboardRoutes)
  .route("/api/thesis", thesisRoutes)
  .route("/api/logbooks", logbookRoutes)
  .route("/api/evaluations", evaluationRoutes)
  .route("/api/notifications", notificationRoutes)
  .route("/api/topics", topicRoutes)
  .route("/api/seminars", seminarRoutes);

export type AppType = typeof app;
export default app;
