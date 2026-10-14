// Re-runs every generator whose inputs are committed (goldens, scripts' tables), in order:
//
//   mise exec -- vp run @hellotimber/nokia-os#regenerate
//
// Generated files are shared outputs harvested across every plan's goldens: a merge conflict in
// one is resolved by taking either side and running this (after the inputs merged). Each
// generator is deterministic (inputs in sorted order, no clock or randomness) and idempotent,
// and tests/resources.test.ts fails while a generated file differs from what it writes. The
// importers that read the capture corpus (`import-captures`, `import-tree`) are not here: rerun
// those with $REF. Runs under Node's type stripping: imports only sibling scripts.
import { writeResources } from "./extract-resources.ts";

/** The generators, in dependency order: each returns the files it changed. */
export const GENERATORS: readonly { readonly name: string; readonly run: () => string[] }[] = [
  // Fonts, menu icons, boot, status, widget sprites and timelines, Snake II and sounds, from
  // goldens/ (src/resources/generated/).
  { name: "extract-resources", run: writeResources },
];

for (const { name, run } of GENERATORS) {
  const written = run();
  console.log(`${name}: ${written.length === 0 ? "up to date" : `wrote ${written.join(", ")}`}`);
}
