// Acceptance, one slice (the other sound goldens (plan 16)): see tests/acceptance.test.ts, which holds the coverage
// guard; the slices run in parallel.
import { describe } from "vite-plus/test";
import { ACCEPTANCE_SLICES, describeGoldens } from "./support/acceptance.ts";

describe("stock phone against every asserted v6.39 golden", () => {
  describeGoldens(ACCEPTANCE_SLICES["sound"]);
});
