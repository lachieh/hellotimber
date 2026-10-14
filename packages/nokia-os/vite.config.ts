import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  run: {
    tasks: {
      // Re-runs every generator whose inputs are committed (scripts/regenerate.ts). Never
      // replayed from the cache: it must write the files, not only print what it wrote.
      regenerate: { command: "node scripts/regenerate.ts", cache: false },
    },
  },
});
