import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  // Deterministic build hash for the *#06# IMEI gag (no Date.now()).
  define: { __BUILD_HASH__: JSON.stringify(process.env.BUILD_HASH ?? "devbuild") },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["three", "react", "react-dom", "@react-three/fiber"],
  },
  ssr: {
    // raw .ts exports can't be require()'d at SSR runtime — force-bundle the
    // workspace source into the server build. Nitro handles the rest.
    noExternal: [
      "@hellotimber/phone-core",
      "@hellotimber/phone-screen",
      "@hellotimber/phone-3d",
      "@hellotimber/snake",
    ],
  },
  // Nitro builds the server output and auto-detects the host (Vercel sets VERCEL
  // in CI → it emits .vercel/output). No deploy script / vercel.json needed.
  // Skip it under Vitest: nitro's dev environment crashes in the test harness
  // (it expects a real dev/build server), and tests never need the server build.
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    ...(process.env.VITEST ? [] : [nitro()]),
    viteReact(),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});

export default config;
