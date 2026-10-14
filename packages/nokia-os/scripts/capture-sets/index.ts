// Every plan's capture set, one line each: a plan adds `scripts/capture-sets/<NN>-<slug>.ts`
// exporting its `PlanCaptureSet` and one `export` line here. The importer runs them in plan
// order (`captureSets`); each writes only its own goldens and `goldens/index/<NN>.json`.
export { foundation } from "./13-foundation.ts";
export { menuDepth } from "./14-menu-depth.ts";
export { storageAndSettings } from "./15-storage-and-settings.ts";
export { tonesAndSound } from "./16-tones-and-sound.ts";
export { snakeII } from "./23-snake-ii.ts";
export { keyguardAndBacklight } from "./25-keyguard-and-backlight.ts";
