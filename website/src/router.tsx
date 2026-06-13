import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getPhoneRuntime } from "./phone/phone";
import { connectPhoneToRouter } from "./phone/router-sync";
import { routeTree } from "./routeTree.gen";

let disconnect: (() => void) | null = null;

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    const { phone } = getPhoneRuntime();
    disconnect?.();
    disconnect = connectPhoneToRouter(router, phone);
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
