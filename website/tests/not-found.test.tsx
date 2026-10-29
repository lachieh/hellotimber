// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import Panel from "../src/panels/NotFoundPanel";

const { ready, navigate } = vi.hoisted(() => {
  type Runtime = { phone: { navigate: (path: string) => void } };
  let resolve: (runtime: Runtime) => void = () => {};
  const promise = new Promise<Runtime>((done) => {
    resolve = done;
  });
  return { ready: { promise, resolve }, navigate: vi.fn() };
});
vi.mock("../src/phone/stock-phone", () => ({
  getPhoneRuntime() {
    throw ready.promise;
  },
  loadPhoneRuntime: () => ready.promise,
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: import("react").ReactNode }) => <a href="/">{children}</a>,
}));

it("keeps a direct 404 visible while the stock runtime loads, then opens SIM services", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<Panel />);
  });
  expect(container.textContent).toContain("Page not found");
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => {
    ready.resolve({ phone: { navigate } });
  });
  expect(navigate).toHaveBeenCalledWith("menu/sim-services");
  await act(async () => {
    root.unmount();
  });
  vi.unstubAllGlobals();
});
