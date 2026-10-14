// Acceptance, one slice (Snake II's goldens (plan 23)): see tests/acceptance.test.ts, which holds the coverage
// guard; the slices run in parallel.
import { describe } from "vite-plus/test";
import { ACCEPTANCE_SLICES, describeGoldens } from "./support/acceptance.ts";

describe("stock phone against every asserted v6.39 golden", () => {
  describeGoldens(ACCEPTANCE_SLICES["games"]);
});
