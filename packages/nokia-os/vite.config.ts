import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Replays that take 1-3 s alone pass vitest's 5 s default when every workspace suite (and
    // other worktrees') share the machine; a hung test still fails, a minute later.
    testTimeout: 60_000,
  },
  run: {
    tasks: {
      // Re-runs every generator whose inputs are committed (scripts/regenerate.ts). Never
      // replayed from the cache: it must write the files, not only print what it wrote.
      regenerate: { command: "node scripts/regenerate.ts", cache: false },
    },
  },
});
