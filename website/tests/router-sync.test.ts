import { createFirmwarePhone, createMemoryStorage } from "@hellotimber/nokia-os";
import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import { homeFirmware } from "../src/home/firmware";
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

/** A homepage phone at standby; `press` sends a key and lets it settle. */
function homePhone(on = true) {
  const phone = createFirmwarePhone(
    homeFirmware(() => {}),
    {
      carrier: "LACHLAN",
      boot: "skip",
      storage: createMemoryStorage(),
      t9: {},
    },
  );
  let now = 0;
  const wait = (ms: number) => {
    const end = now + ms;
    while (now < end) phone.tick(++now);
  };
  const press = (key: PhoneKey) => {
    phone.send({ type: "down", key });
    wait(50);
    phone.send({ type: "up", key });
    wait(1000);
  };
  phone.tick(0);
  if (on) {
    phone.send({ type: "down", key: "power" });
    wait(1000);
    phone.send({ type: "up", key: "power" });
    wait(1000);
  }
  return { phone, press, wait };
}

function connect(router: ReturnType<typeof fakeRouter>, phone: Phone): () => void {
  return connectPhoneToRouter(router as unknown as AnyRouter, phone);
}

const carouselItem = (phone: Phone) =>
  phone.screen.kind === "menu-carousel" ? phone.screen.label : phone.screen.kind;

describe("connectPhoneToRouter", () => {
  it("opens the phone at a deep link's section, even from off", () => {
    const router = fakeRouter("/work");
    const { phone, wait } = homePhone(false);
    connect(router, phone);
    wait(3000);
    expect(phone.path).toBe("menu/work");
    expect(router.navigations).toEqual([]);
  });

  it("opens Snake II for /snake and Chat for /chat", () => {
    const router = fakeRouter("/");
    const { phone } = homePhone();
    connect(router, phone);
    router.settle("/snake");
    expect(phone.path).toBe("menu/games/snake");
    router.settle("/chat");
    expect(phone.path).toBe("menu/chat");
    expect(router.navigations).toEqual([]);
  });

  it("goes to a section's route when the phone enters it, and stays there inside it", () => {
    const router = fakeRouter("/");
    const { phone, press } = homePhone();
    connect(router, phone);
    press("navi");
    expect(router.navigations).toEqual([]);
    press("down");
    press("navi");
    expect(router.navigations).toEqual([{ to: "/work", replace: false }]);
    press("navi");
    expect(phone.path).toBe("menu/work/tambo");
    expect(router.navigations).toHaveLength(1);
  });

  it("returns to / when C leaves a section, the carousel on its item", () => {
    const router = fakeRouter("/about");
    const { phone, press } = homePhone();
    connect(router, phone);
    press("c");
    expect(router.navigations).toEqual([{ to: "/", replace: false }]);
    expect(carouselItem(phone)).toBe("About");
  });

  it("puts the carousel on the section's item when the URL goes back to /", () => {
    const router = fakeRouter("/work");
    const { phone, press } = homePhone();
    connect(router, phone);
    press("navi");
    expect(phone.path).toBe("menu/work/tambo");
    router.settle("/");
    expect(phone.path).toBe("menu");
    expect(carouselItem(phone)).toBe("Work");
    expect(router.navigations).toEqual([]);
  });

  it("replaces the entry when the phone drops to standby", () => {
    const router = fakeRouter("/work");
    const { phone, wait } = homePhone();
    connect(router, phone);
    phone.send({ type: "down", key: "c" });
    wait(2000);
    phone.send({ type: "up", key: "c" });
    wait(100);
    expect(phone.path).toBe("standby");
    expect(router.navigations).toEqual([{ to: "/", replace: true }]);
  });

  it("leaves the phone alone on a route it isn't on", () => {
    const router = fakeRouter("/");
    const { phone } = homePhone();
    connect(router, phone);
    router.settle("/writing/how-i-built-a-nokia-3310");
    expect(phone.path).toBe("standby");
  });

  it("stops syncing once disconnected", () => {
    const router = fakeRouter("/");
    const { phone, press } = homePhone();
    const disconnect = connect(router, phone);
    disconnect();
    router.settle("/about");
    expect(phone.path).toBe("standby");
    press("navi");
    press("navi");
    expect(router.navigations).toEqual([]);
  });
});
