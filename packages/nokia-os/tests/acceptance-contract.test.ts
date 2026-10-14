import * as testApi from "vite-plus/test";
import * as goldenIndex from "../scripts/golden-index.ts";

const registration = {
  status: "pending:18c",
  callbacks: [] as (() => void)[],
  todos: [] as string[],
  expectedFailures: 0,
};
testApi.vi.doMock("vite-plus/test", () => {
  const it = Object.assign(
    (_name: string, callback: () => void) => registration.callbacks.push(callback),
    {
      todo: (name: string) => registration.todos.push(name),
      fails: (_name: string, callback: () => void) => {
        registration.expectedFailures++;
        registration.callbacks.push(callback);
      },
    },
  );
  return { ...testApi, it, describe: (_name: string, callback: () => void) => callback() };
});
testApi.vi.doMock("../scripts/golden-index.ts", () => ({
  ...goldenIndex,
  readPlanIndex: () => [{ id: "glyphs/specimen", status: registration.status, kind: "still" }],
}));
const { acceptancePlan } = await import("./support/acceptance.ts");

testApi.test(
  "pending evidence stays todo; promotion requires a scenario even with a known gap",
  () => {
    const { expect, vi } = testApi;
    acceptancePlan({ plan: "18c", scenarios: {} });
    expect(registration.todos).toEqual(["glyphs/specimen (pending: plan 18c)"]);
    expect(registration.callbacks).toEqual([]);
    registration.status = "asserted";
    acceptancePlan({ plan: "18c", scenarios: {} });
    expect(registration.callbacks[0]).toThrow("no scenario for glyphs/specimen");
    acceptancePlan({
      plan: "18c",
      scenarios: {},
      knownGaps: { "glyphs/specimen": "missing driver" },
    });
    expect(registration.callbacks[1]).toThrow("no scenario for glyphs/specimen");
    expect(registration.expectedFailures).toBe(0);
    const drive = vi.fn();
    acceptancePlan({ plan: "18c", scenarios: { "glyphs/specimen": drive } });
    registration.callbacks[2]!();
    expect(drive).toHaveBeenCalledExactlyOnceWith("glyphs/specimen");
  },
);
