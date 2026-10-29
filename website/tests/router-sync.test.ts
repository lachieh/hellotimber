import { createStockPhone, createMemoryStorage } from "@hellotimber/nokia-os";
import { PORTFOLIO_SIM } from "../src/content/sim";
import type { Phone } from "@hellotimber/phone-core";
import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { connectPhoneToRouter } from "../src/phone/router-sync";

// ── minimal fake router: subscribe/navigate/state, navigations recorded ──
interface ResolvedEvent {
  toLocation: { pathname: string };
  pathChanged: boolean;
}

function fakeRouter(initialPathname: string) {
  const listeners = new Set<(e: ResolvedEvent) => void>();
  const fake = {
    state: { location: { pathname: initialPathname } },
    navigations: [] as { to: string; replace?: boolean }[],
    subscribe(_ev: "onResolved", cb: (e: ResolvedEvent) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    navigate(opts: { to: string; replace?: boolean }): Promise<void> {
      fake.navigations.push(opts);
      fake.settle(opts.to); // a real router resolves then fires onResolved
      return Promise.resolve();
    },
    /** Simulate a settled navigation (also used for back/forward). */
    settle(pathname: string): void {
      const changed = fake.state.location.pathname !== pathname;
      fake.state.location = { pathname };
      // Snapshot so a listener disconnecting during dispatch cannot skip siblings.
      // oxlint-disable-next-line no-useless-spread
      for (const cb of [...listeners]) cb({ toLocation: { pathname }, pathChanged: changed });
    },
  };
  return fake;
}

function bootedPhone(): Phone {
  const phone = createStockPhone({
    carrier: "LACHLAN",
    boot: "skip",
    storage: createMemoryStorage(),
    sim: PORTFOLIO_SIM,
  });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

function connect(router: ReturnType<typeof fakeRouter>, phone: Phone): () => void {
  return connectPhoneToRouter(router as unknown as AnyRouter, phone);
}

describe("connectPhoneToRouter", () => {
  it("aligns the phone to the URL on connect (deep link, even from off)", () => {
    const router = fakeRouter("/menu/games/snake");
    const phone = bootedPhone(); // off — navigate boots it
    connect(router, phone);
    expect(phone.path).toBe("menu/games/snake");
    expect(router.navigations).toEqual([]); // alignment never touches the URL
  });

  it("URL → phone: a settled navigation drives the phone", () => {
    const router = fakeRouter("/");
    const phone = bootedPhone();
    connect(router, phone);
    router.settle("/menu/chat");
    expect(phone.path).toBe("menu/chat");
  });

  it("URL → phone echo is suppressed: no router.navigate bounce", () => {
    const router = fakeRouter("/");
    const phone = bootedPhone();
    connect(router, phone);
    router.settle("/menu/games");
    expect(phone.path).toBe("menu/games");
    expect(router.navigations).toEqual([]); // pathchange happened under the echo flag
  });

  it("phone → URL: keypad navigation pushes exactly one URL (no loop)", () => {
    const router = fakeRouter("/");
    const phone = bootedPhone();
    connect(router, phone);
    phone.pressKey("navi"); // standby → menu carousel
    expect(phone.path).toBe("menu");
    expect(router.navigations).toEqual([{ to: "/menu", replace: false }]);
    // the fake settled the URL, the bridge saw it, the idempotence guard stopped it
  });

  it("phone → URL: returning to standby replaces history", () => {
    const router = fakeRouter("/menu/chat");
    const phone = bootedPhone();
    connect(router, phone);
    phone.navigate("standby"); // e.g. hold-C
    expect(router.navigations).toEqual([{ to: "/", replace: true }]);
  });

  it("unknown URLs settle the phone on standby without navigating the router", () => {
    const router = fakeRouter("/");
    const phone = bootedPhone();
    connect(router, phone);
    phone.pressKey("navi");
    router.navigations.length = 0;
    router.settle("/some/unknown/page");
    expect(phone.path).toBe("standby"); // phonePathFromUrl shape fallback
    expect(router.navigations).toEqual([]); // echo flag swallows the pathchange
  });

  it("disconnect stops both directions", () => {
    const router = fakeRouter("/");
    const phone = bootedPhone();
    const disconnect = connect(router, phone);
    disconnect();
    router.settle("/menu/chat");
    expect(phone.path).toBe("standby");
    phone.pressKey("navi");
    expect(router.navigations).toEqual([]);
  });

  it("aligns SIM projects without an echo", () => {
    const phone = bootedPhone();
    const router = fakeRouter("/menu/sim-services/projects");
    connect(router, phone);
    expect(phone.path).toBe("menu/sim-services/projects");
    expect(router.navigations).toEqual([]);
  });
  it("standby name browsing keeps the root URL", () => {
    const phone = bootedPhone();
    const router = fakeRouter("/");
    connect(router, phone);
    phone.pressKey("down");
    expect(phone.path).toBe("standby");
    expect(router.navigations).toEqual([]);
  });
});
