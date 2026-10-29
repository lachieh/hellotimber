import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { loadPhoneRuntime } from "./phone/stock-phone";
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
    void loadPhoneRuntime().then(({ phone }) => {
      disconnect?.();
      disconnect = connectPhoneToRouter(router, phone);
    });
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
