// The posts' compiled MDX, by slug: only the post route imports this, so its chunk carries them.
import type { MDXContent } from "mdx/types";
import { slugOfFile } from "./posts";

const MODULES = import.meta.glob<MDXContent>("../../content/writing/*.mdx", {
  import: "default",
  eager: true,
});

export const POST_BODIES: Readonly<Record<string, MDXContent>> = Object.fromEntries(
  Object.entries(MODULES).map(([file, body]) => [slugOfFile(file), body]),
);
