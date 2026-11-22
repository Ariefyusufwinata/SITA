import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { thesisRoutes } from "./routes/thesis";
import { logbookRoutes } from "./routes/logbooks";
import { evaluationRoutes } from "./routes/evaluations";
import { notificationRoutes } from "./routes/notifications";
import { topicRoutes } from "./routes/topics";

const app = new Hono()
  .use(logger())
  .use("/api/*", cors({ origin: (o) => o, allowHeaders: ["Authorization", "Content-Type"] }))
  .get("/api/v1/health", (c) => c.json({ ok: true }))
  .route("/api/v1/auth", authRoutes)
  .route("/api/v1/dashboard", dashboardRoutes)
  .route("/api/v1/thesis", thesisRoutes)
  .route("/api/v1/logbooks", logbookRoutes)
  .route("/api/v1/evaluations", evaluationRoutes)
  .route("/api/v1/notifications", notificationRoutes)
  .route("/api/v1/topics", topicRoutes);

export type AppType = typeof app;
export default app;
