import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/preload.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
