import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import remarkFrontmatter from "remark-frontmatter";
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite-plus";
import { CATALOGUE_CODE_THEME } from "./src/writing/code-theme.ts";
import { proseWords, splitFrontmatter } from "./src/writing/frontmatter.ts";

const FRONTMATTER_QUERY = "?frontmatter";

/**
 * `post.mdx?frontmatter`: a post's frontmatter block and word count, without its body, so the
 * Writing list (and the homepage phone, which reads it) doesn't carry every post.
 */
function writingFrontmatter(): Plugin {
  return {
    name: "hellotimber:writing-frontmatter",
    enforce: "pre",
    async load(id) {
      if (!id.endsWith(`.mdx${FRONTMATTER_QUERY}`)) return null;
      const file = id.slice(0, -FRONTMATTER_QUERY.length);
      this.addWatchFile(file);
      const { block, body } = splitFrontmatter(await readFile(file, "utf8"));
      return `export default ${JSON.stringify({ block, words: proseWords(body) })};`;
    },
  };
}

/**
 * Posts compile from MDX at build time, code highlighted by Shiki into static HTML (no client
 * highlighter). Queried imports (`?frontmatter`) aren't MDX: @mdx-js/rollup drops the query, so
 * they're kept away from it here.
 */
function writingMdx(): Plugin {
  const plugin = mdx({
    remarkPlugins: [remarkFrontmatter],
    rehypePlugins: [
      [rehypeShiki, { theme: CATALOGUE_CODE_THEME, langs: ["ts", "tsx", "css", "sh", "text"] }],
    ],
  }) as Plugin & { transform: (code: string, id: string) => unknown };
  const transform = plugin.transform;
  return {
    ...plugin,
    enforce: "pre",
    transform(code, id) {
      return id.includes("?") ? null : transform.call(this, code, id);
    },
  } as Plugin;
}

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
      "@hellotimber/nokia-os",
      "@hellotimber/nokia-kit",
      "@hellotimber/phone-services",
    ],
  },
  // Nitro builds the server output and auto-detects the host (Vercel sets VERCEL
  // in CI → it emits .vercel/output). No deploy script / vercel.json needed.
  // Skip it under Vitest: nitro's dev environment crashes in the test harness
  // (it expects a real dev/build server), and tests never need the server build.
  plugins: [
    devtools(),
    tailwindcss(),
    writingFrontmatter(),
    writingMdx(),
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
