import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  ApplicationEntry,
  MenuGraphic,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  TopLevelEntry,
} from "../src/index";
import type { ApplicationContext, MenuEntryVisitor, PhoneApplicationSession } from "../src/index";

type WebMetadata = { indexing: "index"; panel: "about" | "editor" } | { indexing: "noindex" };

class TypedApplication extends PhoneApplication {
  createSession(_context: ApplicationContext): PhoneApplicationSession {
    return { onKey() {}, tick() {}, render: () => ({ kind: "off" }) };
  }
}

class OtherTypedApplication extends PhoneApplication {
  createSession(_context: ApplicationContext): PhoneApplicationSession {
    return { onKey() {}, tick() {}, render: () => ({ kind: "off" }) };
  }
}

describe("menu model types", () => {
  it("retains metadata types across heterogeneous entries and visitors", () => {
    const reader = new ReaderEntry<WebMetadata>(
      new MenuSlug("about"),
      new MenuOrder(1),
      "About",
      "Body",
      { indexing: "index", panel: "about" },
    );
    const application = new ApplicationEntry<WebMetadata>(
      new MenuSlug("editor"),
      new MenuOrder(2),
      "Editor",
      new TypedApplication("editor"),
      { indexing: "noindex" },
    );
    const otherApplication = new ApplicationEntry<WebMetadata>(
      new MenuSlug("other-application"),
      new MenuOrder(3),
      "Other application",
      new OtherTypedApplication("other-application"),
      { indexing: "noindex" },
    );
    const menu = new PhoneMenu<WebMetadata>([
      new TopLevelEntry(reader, new MenuGraphic("about")),
      new TopLevelEntry(application, new MenuGraphic("editor")),
      new TopLevelEntry(otherApplication, new MenuGraphic("other-application")),
    ]);
    const visitor: MenuEntryVisitor<WebMetadata, WebMetadata | undefined> = {
      visitSubmenu: (entry) => entry.metadata,
      visitList: (entry) => entry.metadata,
      visitReader: (entry) => entry.metadata,
      visitAction: (entry) => entry.metadata,
      visitApplication: (entry) => entry.metadata,
    };

    expectTypeOf(menu.entries[0]!.entry.metadata).toEqualTypeOf<WebMetadata | undefined>();
    expectTypeOf(menu.walk(visitor)).toEqualTypeOf<readonly (WebMetadata | undefined)[]>();
    expect(menu.entries).toHaveLength(3);
  });
});
