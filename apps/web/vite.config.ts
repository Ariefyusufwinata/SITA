import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  const apiPort = env.PORT || "3001";

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "server-info",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            setTimeout(() => {
              console.log(`
🌐 [SITA Fullstack] Frontend & Backend bersatu di Port 3000:
   ➜ Aplikasi Web (Frontend) : http://localhost:3000
   ➜ Rute Halaman Web:
      • Login         : http://localhost:3000/login
      • Dashboard     : http://localhost:3000/
      • Topik Riset   : http://localhost:3000/topik
      • Tesis         : http://localhost:3000/tesis
      • Logbook       : http://localhost:3000/logbook
      • Validasi      : http://localhost:3000/validasi
   ➜ Swagger API Docs (Interactive): http://localhost:3000/api/docs (atau http://localhost:3000/docs)
   ➜ OpenAPI JSON Schema           : http://localhost:3000/api/openapi.json
   ➜ Backend API (Proxy)           : http://localhost:3000/api
`);
            }, 100);
          });
        },
      },
    ],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    envDir: path.resolve(import.meta.dirname, "../.."),
    server: {
      port: 3000,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/docs": `http://localhost:${apiPort}`,
      },
    },
  };
});
