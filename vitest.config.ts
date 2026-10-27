import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    setupFiles: ["./src/test/vitest.setup.ts"],
    include: ["src/**/*.test.ts", "electron/**/*.test.ts", "scripts/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
