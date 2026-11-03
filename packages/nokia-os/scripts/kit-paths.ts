// Where the generators write into @hellotimber/nokia-kit: its generated resources and T9 word
// list. Resolved through the workspace link, so no path reaches into the sibling package by hand.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const KIT_DIR = dirname(
  createRequire(import.meta.url).resolve("@hellotimber/nokia-kit/package.json"),
);
/** The resource modules scripts/extract-resources.ts writes. */
export const KIT_RESOURCES_GENERATED = join(KIT_DIR, "src/ui/resources/generated");
/** The English T9 word list scripts/build-t9-dictionary.ts writes. */
export const KIT_T9_ENGLISH_GENERATED = join(KIT_DIR, "src/ui/text/t9/generated/english.ts");
