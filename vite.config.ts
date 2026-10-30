import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // O backend nao configura CORS; o proxy do dev server evita o bloqueio
      // do navegador sem precisar alterar nada no Java.
      "/rpc": BACKEND,
      "/status": BACKEND,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/teste/setup.ts"],
    css: false,
  },
});
