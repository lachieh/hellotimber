import {
  ActionEntry,
  ApplicationEntry,
  createPhone,
  ListEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  StaticMenuListSource,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  ScreenModel,
} from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

class PassiveApplication extends PhoneApplication {
  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey(event) {
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick() {},
      render: () => ({ kind: "confirm", text: "Write", softkey: "" }),
    };
  }
}

/** Small but representative tree: submenus, lists, a reader, an app, and an action. */
export function testMenu(
  application: PhoneApplication = new PassiveApplication("write-message"),
): PhoneMenu {
  return new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(
        slug("phone-book"),
        order(1),
        "Phone book",
        new MenuLevel([
          new ListEntry(
            slug("search"),
            order(1),
            "Search",
            new StaticMenuListSource([
              {
                id: "alice",
                label: "Alice",
                body: "Alice's card. Email alice@example.com. Likes long walks through menu trees.",
              },
              { id: "bob", label: "Bob", body: "Bob's card." },
            ]),
          ),
          new ReaderEntry(slug("memory-status"), order(2), "Memory status", "SIM memory 2/2 used."),
        ]),
      ),
      new MenuGraphic("phone-book"),
    ),
    new TopLevelEntry(
      new SubmenuEntry(
        slug("messages"),
        order(2),
        "Messages",
        new MenuLevel([
          new ApplicationEntry(slug("write"), order(1), "Write messages", application),
          new ListEntry(
            slug("inbox"),
            order(2),
            "Inbox",
            new StaticMenuListSource([{ id: "hello", label: "Hello", body: "First message." }]),
          ),
        ]),
      ),
      new MenuGraphic("messages"),
    ),
    new TopLevelEntry(
      new ReaderEntry(slug("chat"), order(3), "Chat", "> hi\n< hello"),
      new MenuGraphic("chat"),
    ),
    new TopLevelEntry(
      new SubmenuEntry(
        slug("call-register"),
        order(4),
        "Call register",
        new MenuLevel([
          new ListEntry(
            slug("dialled-numbers"),
            order(1),
            "Dialled numbers",
            new StaticMenuListSource([{ id: "proj", label: "Project X", body: "Shipped 2025." }]),
          ),
        ]),
      ),
      new MenuGraphic("call-register"),
    ),
    new TopLevelEntry(
      new ActionEntry(slug("github"), order(5), "GitHub", {
        kind: "href",
        value: "https://github.com/example",
      }),
      new MenuGraphic("github"),
    ),
  ]);
}

export function testConfig(
  overrides: Partial<PhoneConfig> = {},
  application?: PhoneApplication,
): PhoneConfig {
  return {
    menu: application === undefined ? testMenu() : testMenu(application),
    bootMs: 0,
    ...overrides,
  };
}

/** A phone that has been powered on (bootMs 0 -> straight to standby). */
export function bootedPhone(
  overrides: Partial<PhoneConfig> = {},
  application?: PhoneApplication,
): Phone {
  const phone = createPhone(testConfig(overrides, application));
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

export interface FakeApp {
  application: PhoneApplication;
  keys: KeyEvent[];
  ticks: number[];
  deactivations: DeactivationReason[];
}

/** Records delegated keys/ticks; exits itself when it sees a C key-up. */
export function makeFakeApp(appId = "write-message"): FakeApp {
  const keys: KeyEvent[] = [];
  const ticks: number[] = [];
  const deactivations: DeactivationReason[] = [];
  class FakeApplication extends PhoneApplication {
    createSession(context: ApplicationContext): PhoneApplicationSession {
      return {
        onKey(event): void {
          keys.push(event);
          if (event.type === "up" && event.key === "c") context.exit();
        },
        tick(dtMs): void {
          ticks.push(dtMs);
        },
        render(): ScreenModel {
          return {
            kind: "custom",
            appId,
            frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
          };
        },
        onDeactivate(reason): void {
          deactivations.push(reason);
        },
      };
    }
  }
  return { application: new FakeApplication(appId), keys, ticks, deactivations };
}
