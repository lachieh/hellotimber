import {
  createPhone,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "@hellotimber/phone-core";
import type { Phone } from "@hellotimber/phone-core";
import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { siteMenu } from "../src/content/menu";
import { connectPhoneToRouter } from "../src/phone/router-sync";
import { screenToText } from "../src/phone/screen-text";

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

const chat = new ReaderEntry(new MenuSlug("chat"), new MenuOrder(1), "Chat", "> hi");
const games = new SubmenuEntry(
  new MenuSlug("games"),
  new MenuOrder(2),
  "Games",
  new MenuLevel([new ReaderEntry(new MenuSlug("snake"), new MenuOrder(1), "Snake II", "stub")]),
);
const menu = new PhoneMenu([
  new TopLevelEntry(chat, new MenuGraphic("chat")),
  new TopLevelEntry(games, new MenuGraphic("games")),
]);

function bootedPhone(): Phone {
  const phone = createPhone({ menu, bootMs: 0 });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

function connect(router: ReturnType<typeof fakeRouter>, phone: Phone): () => void {
  return connectPhoneToRouter(router as unknown as AnyRouter, phone);
}

function press(phone: Phone, key: Parameters<Phone["pressKey"]>[0]): void {
  phone.send({ type: "down", key });
  phone.send({ type: "up", key });
}

describe("connectPhoneToRouter", () => {
  it("aligns the phone to the URL on connect (deep link, even from off)", () => {
    const router = fakeRouter("/menu/games/snake");
    const phone = createPhone({ menu, bootMs: 0 }); // off — navigate boots it
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

  it("keeps immediate hierarchical shortcuts, routes, and spoken output synchronized", () => {
    const router = fakeRouter("/");
    const phone = createPhone({ menu: siteMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    connect(router, phone);
    let spoken = screenToText(phone.screen);
    phone.subscribe((snapshot) => {
      spoken = screenToText(snapshot.screen);
    });

    press(phone, "navi");
    expect(phone.path).toBe("menu");
    expect(router.state.location.pathname).toBe("/menu");
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Phone book",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    expect(spoken).toContain("Menu 1.");

    press(phone, "5");
    expect(phone.path).toBe("menu/tones");
    expect(router.state.location.pathname).toBe("/menu/tones");
    expect(phone.screen).toMatchObject({
      kind: "list",
      title: "Tones",
      menuIndicator: { segments: [5], awaitingNext: true },
    });
    expect(spoken).toContain("Menu 5. Enter another digit.");

    press(phone, "3");
    expect(phone.path).toBe("menu/tones/incoming-call-alert");
    expect(router.state.location.pathname).toBe("/menu/tones/incoming-call-alert");
    expect(phone.screen).toMatchObject({
      kind: "reader",
      title: "Incoming call alert",
      menuIndicator: { segments: [5, 3], awaitingNext: true },
    });
    expect(spoken).toContain("Menu 5 then 3. Enter another digit.");

    router.navigations.length = 0;
    router.settle("/menu/tones");
    expect(phone.path).toBe("menu/tones");
    expect(phone.screen).toMatchObject({
      menuIndicator: { segments: [5], awaitingNext: false },
    });
    expect(spoken).not.toContain("Enter another digit.");
    expect(router.navigations).toEqual([]);

    router.settle("/menu/tones/incoming-call-alert");
    expect(phone.screen).toMatchObject({
      menuIndicator: { segments: [5, 3], awaitingNext: false },
    });
    expect(spoken).not.toContain("Enter another digit.");

    press(phone, "c");
    expect(phone.path).toBe("menu/tones");
    expect(router.state.location.pathname).toBe("/menu/tones");
    expect(phone.screen).toMatchObject({
      menuIndicator: { segments: [5], awaitingNext: false },
    });
  });

  it("does not leak shortcut digits into an app and resumes app input after cancellation", () => {
    const phone = createPhone({ menu: siteMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);

    press(phone, "navi");
    press(phone, "9");
    expect(phone.path).toBe("menu/calculator");
    expect(phone.screen).toMatchObject({ kind: "editor", title: "Calculator", text: "0" });

    press(phone, "#");
    expect(phone.screen).toMatchObject({ kind: "editor", text: "0." });
    press(phone, "5");
    expect(phone.screen).toMatchObject({ kind: "editor", text: "0.5" });
  });
});
