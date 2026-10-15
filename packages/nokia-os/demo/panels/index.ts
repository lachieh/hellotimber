// Every demo panel, one line each (demo/main.ts mounts them in plan order): a plan adds its demo
// controls as `demo/panels/<slug>.ts` exporting a `DemoPanel` and one `export` line here.
// Nothing else may be exported here.
export { goldensPanel } from "./goldens";
export { lightsPanel } from "./lights";
export { phonePanel } from "./phone";
export { soundPanel } from "./sound";
export { storagePanel } from "./storage";
