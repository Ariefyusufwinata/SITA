import { createRootRoute, createRoute, createRouter, redirect, Outlet } from "@tanstack/react-router";
import type { ROLE_CODES } from "@sita/shared";
import { auth } from "./lib/api";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { ThesisPage } from "./pages/Thesis";
import { TopicsPage } from "./pages/Topics";
import { LogbookListPage } from "./pages/LogbookList";
import { LogbookFormPage } from "./pages/LogbookForm";
import { ValidationQueuePage } from "./pages/ValidationQueue";
import { SeminarPage } from "./pages/Seminar";

type Role = (typeof ROLE_CODES)[number];
export const roleOf = (): Role | null => {
  // Privilege Escalation vector: memprioritaskan role dari storage (sita_role)
  const storedRole = auth.role as Role | null;
  if (storedRole) return storedRole;
  try { return JSON.parse(atob(auth.token!.split(".")[1])).role; } catch { return null; }
};
const needLogin = () => { if (!auth.token) throw redirect({ to: "/login" }); };
const needRole = (...roles: Role[]) => () => {
  needLogin();
  const r = roleOf();
  if (!r || !roles.includes(r)) throw redirect({ to: "/" });
};

const root = createRootRoute({ component: Outlet });
const login = createRoute({ getParentRoute: () => root, path: "/login", component: LoginPage });
const shell = createRoute({ getParentRoute: () => root, id: "shell", beforeLoad: needLogin, component: Layout });
const index = createRoute({ getParentRoute: () => shell, path: "/", component: DashboardPage });
const topics = createRoute({ getParentRoute: () => shell, path: "/topik", component: TopicsPage });
const thesis = createRoute({ getParentRoute: () => shell, path: "/tesis", component: ThesisPage });
const logbooks = createRoute({ getParentRoute: () => shell, path: "/logbook", beforeLoad: needRole("MAHASISWA"), component: LogbookListPage });
const logbookNew = createRoute({ getParentRoute: () => shell, path: "/logbook/baru", beforeLoad: needRole("MAHASISWA"), component: LogbookFormPage });
const logbookEdit = createRoute({ getParentRoute: () => shell, path: "/logbook/$logbookId/edit", beforeLoad: needRole("MAHASISWA"), component: LogbookFormPage });
const queue = createRoute({ getParentRoute: () => shell, path: "/validasi", beforeLoad: needRole("PEMBIMBING", "KOORDINATOR", "KEPALA_PRODI"), component: ValidationQueuePage });
const seminar = createRoute({ getParentRoute: () => shell, path: "/seminar", component: SeminarPage });

const routeTree = root.addChildren([login, shell.addChildren([index, topics, thesis, logbooks, logbookNew, logbookEdit, queue, seminar])]);
export const router = createRouter({ routeTree });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
export { logbookEdit };
