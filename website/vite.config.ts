import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

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
    // raw .ts exports can't be require()'d by Node at SSR runtime;
    // force-bundle workspace source into the server build
    noExternal: [
      "@hellotimber/phone-core",
      "@hellotimber/phone-screen",
      "@hellotimber/phone-3d",
      "@hellotimber/snake",
    ],
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});

export default config;
