import { defineConfig } from "vitest/config";
import path from "node:path";

// `npm run docs` — regenera docs/METHODOLOGY_CATALOG.md a partir do registro.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["scripts/**/*.test.ts"] },
});
