import { createPhone } from "../src/index";
import type { MenuNode, Phone, PhoneConfig } from "../src/index";

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
