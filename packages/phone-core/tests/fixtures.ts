import { createPhone } from "../src/index";
import type {
  AppFactory,
  KeyEvent,
  MenuNode,
  Phone,
  PhoneApp,
  PhoneConfig,
  ScreenModel,
} from "../src/index";

/** Small but representative tree: submenus, lists, a reader, an app node, an action node. */
export function testMenu(): MenuNode[] {
  return [
    {
      type: "submenu",
      id: "phone-book",
      label: "Phone book",
      children: [
        {
          type: "list",
          id: "search",
          label: "Search",
          items: [
            {
              id: "alice",
              label: "Alice",
              body: "Alice's card. Email alice@example.com. Likes long walks through menu trees.",
            },
            { id: "bob", label: "Bob", body: "Bob's card." },
          ],
        },
        {
          type: "reader",
          id: "memory-status",
          label: "Memory status",
          body: "SIM memory 2/2 used.",
        },
      ],
    },
    {
      type: "submenu",
      id: "messages",
      label: "Messages",
      children: [
        { type: "app", id: "write", label: "Write messages", appId: "write-message" },
        {
          type: "list",
          id: "inbox",
          label: "Inbox",
          items: [{ id: "hello", label: "Hello", body: "First message." }],
        },
      ],
    },
    { type: "reader", id: "chat", label: "Chat", body: "> hi\n< hello" },
    {
      type: "submenu",
      id: "call-register",
      label: "Call register",
      children: [
        {
          type: "list",
          id: "dialled-numbers",
          label: "Dialled numbers",
          items: [{ id: "proj", label: "Project X", body: "Shipped 2025." }],
        },
      ],
    },
    {
      type: "action",
      id: "github",
      label: "GitHub",
      action: { kind: "href", value: "https://github.com/example" },
    },
  ];
}

export function testConfig(overrides: Partial<PhoneConfig> = {}): PhoneConfig {
  return { menu: testMenu(), bootMs: 0, ...overrides };
}

/** A phone that has been powered on (bootMs 0 → straight to standby). */
export function bootedPhone(overrides: Partial<PhoneConfig> = {}): Phone {
  const phone = createPhone(testConfig(overrides));
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

export interface FakeApp {
  factory: AppFactory;
  keys: KeyEvent[];
  ticks: number[];
  exitCount(): number;
}

/** Records delegated keys/ticks; exits itself when it sees a 'c' key-up. */
export function makeFakeApp(appId = "write-message"): FakeApp {
  const keys: KeyEvent[] = [];
  const ticks: number[] = [];
  let exited = 0;
  const factory: AppFactory = (ctx) => {
    const app: PhoneApp = {
      onKey(e: KeyEvent): void {
        keys.push(e);
        if (e.type === "up" && e.key === "c") ctx.exit();
      },
      tick(dtMs: number): void {
        ticks.push(dtMs);
      },
      render(): ScreenModel {
        return {
          kind: "custom",
          appId,
          frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
        };
      },
      onExit(): void {
        exited += 1;
      },
    };
    return app;
  };
  return { factory, keys, ticks, exitCount: () => exited };
}
