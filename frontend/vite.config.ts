import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { watch: { usePolling: true }, proxy: { "/api": { target: loadEnv(mode, ".", "TERA_").TERA_API_PROXY || "http://localhost:8000", ws: true } } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
}));
