// Plan 19 Task 6: the name list's painters against their goldens (literal models), and the
// widget in a flow.
import { rowsWindowTop, type PhoneKey } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { paintWidget, type WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import {
  shownName,
  sortEntries,
  type PhoneBookEntry,
} from "@hellotimber/phone-services/phone-book/entries";
import { nameList, type NameListView } from "../src/widgets/name-list";
import { flowRig } from "./support/flow-rig.ts";
import { lcdMismatch } from "./support/golden.ts";
import { loadGolden } from "./support/goldens.ts";

function sorted(sim: keyof typeof PHONE_BOOK_SIMS): readonly PhoneBookEntry[] {
  return sortEntries(
    (PHONE_BOOK_SIMS[sim].phoneBook?.entries ?? []).flatMap((contact, i) =>
      contact === null ? [] : [{ ...contact, location: i + 1 }],
    ),
  );
}

function expectImage(model: WidgetModel, id: string, image: string): void {
  const fb = new Framebuffer();
  paintWidget(fb, model);
  const golden = loadGolden(id);
  const found = golden.images.find((i) => i.name === image);
  if (found === undefined) throw new Error(`${id} has no image ${image}`);
  const mismatch = lcdMismatch(fb.pixels, { id, image: found }, `${id} ${image}`);
  if (mismatch !== undefined) throw new Error(mismatch);
}

const CONTENT = sorted("content");
const at = (i: number) => CONTENT[((i % CONTENT.length) + CONTENT.length) % CONTENT.length]!;
const pad = (i: number) => String(i).padStart(2, "0");

describe("name list painters (S3)", () => {
  it("draws Large font: the icon, the large name broken by character, the soft key", () => {
    for (let i = 0; i <= 23; i++) {
      expectImage(
        { kind: "name-list", view: "large", name: shownName(at(i)), softkey: "Call" },
        "phone-book/view-large",
        `down-${pad(i)}`,
      );
    }
  });

  it("draws Name, number: the small name, then the number's last digits right-aligned", () => {
    for (let i = 0; i <= 23; i++) {
      const entry = at(i);
      expectImage(
        { kind: "name-list", view: "page", name: entry.name, value: entry.number, softkey: "Call" },
        "phone-book/view-number",
        `down-${pad(i)}`,
      );
    }
    const sort = sorted("sort");
    for (let i = 0; i <= 32; i++) {
      const entry = sort[i % sort.length]!;
      expectImage(
        { kind: "name-list", view: "page", name: entry.name, value: entry.number, softkey: "Call" },
        "phone-book/view-sort",
        `down-${pad(i)}`,
      );
    }
  });

  it("draws Name list: three full-width rows, the selected one inverted, cut names with ...", () => {
    let top: number | undefined;
    const shot = (selected: number, image: string, move?: "up" | "down") => {
      top = rowsWindowTop(top, selected, CONTENT.length, 3, move);
      const rows = [0, 1, 2].map((r) => shownName(at(top! + r)));
      expectImage(
        {
          kind: "name-list",
          view: "list",
          rows,
          selected: (selected - top! + 23) % 23,
          softkey: "Call",
        },
        "phone-book/view-list",
        image,
      );
    };
    shot(0, "down-00");
    for (let i = 1; i <= 24; i++) shot(i % 23, `down-${pad(i)}`, "down");
    for (let i = 1; i <= 4; i++) shot((((24 - i) % 23) + 23) % 23, `up-${pad(i)}`, "up");
  });

  it("draws the Assign tone page: the name, its tone right-aligned below (any view)", () => {
    const pages: readonly [string, number][] = [
      ["page-01", 0],
      ["page-02", 1],
      ["page-03", 2],
      ["page-16", 15],
      ["page-20", 19],
      ["page-23", 22],
      ["page-24", 0],
      ["page-up", 1],
    ];
    for (const [image, i] of pages) {
      expectImage(
        { kind: "name-list", view: "page", name: at(i).name, value: "Default", softkey: "Assign" },
        "phone-book/tone-pages",
        image,
      );
    }
    for (const [image, i] of [
      ["list-page-01", 0],
      ["list-page-02", 1],
      ["number-page-01", 0],
      ["number-page-02", 1],
    ] as const) {
      expectImage(
        { kind: "name-list", view: "page", name: at(i).name, value: "Default", softkey: "Assign" },
        "phone-book/tone-pages-views",
        image,
      );
    }
  });

  it("draws Service Nos.: plan 14's rows and rail, no icon", () => {
    const items = PHONE_BOOK_SIMS.content.serviceNumbers!.map((s) => s.name);
    for (const [image, selected] of [
      ["down-1", 1],
      ["down-2", 0],
      ["up-1", 0],
      ["up-2", 1],
    ] as const) {
      expectImage(
        { kind: "service-list", items, selected, windowTop: 0, softkey: "Call" },
        "phone-book/service-scroll",
        image,
      );
    }
  });
});

describe("nameList in a flow (D6)", () => {
  const list = (
    view: NameListView | "page",
    extra: Partial<Parameters<typeof nameList>[0]> = {},
    chosen: PhoneBookEntry[] = [],
  ) =>
    flowRig(() =>
      nameList({
        entries: () => CONTENT,
        view,
        softkey: "Call",
        choose: (entry) => void chosen.push(entry),
        ...extra,
      }),
    );

  const expectFrame = (rig: ReturnType<typeof list>, id: string, image: string) => {
    const golden = loadGolden(id);
    const found = golden.images.find((i) => i.name === image)!;
    const mismatch = lcdMismatch(rig.frame(), { id, image: found }, `${id} ${image}`);
    if (mismatch !== undefined) throw new Error(mismatch);
  };

  it("opens on the first name and moves with ▲/▼, wrapping, the rows window in Name list view", () => {
    const rig = list("list");
    expectFrame(rig, "phone-book/view-list", "down-00");
    for (let i = 1; i <= 24; i++) {
      rig.press("down");
      rig.advance(200);
      expectFrame(rig, "phone-book/view-list", `down-${pad(i)}`);
    }
    for (let i = 1; i <= 24; i++) {
      rig.press("up");
      rig.advance(200);
      if (i <= 4 || i === 24) expectFrame(rig, "phone-book/view-list", `up-${pad(i)}`);
    }
    const large = list("large");
    for (let i = 1; i <= 23; i++) large.press("down");
    expectFrame(large, "phone-book/view-large", "down-23");
  });

  it("opens on a given index, on the top row", () => {
    const rig = list("list", { start: 5 });
    expect(rig.frame()).toEqual(
      (() => {
        const fb = new Framebuffer();
        paintWidget(fb, {
          kind: "name-list",
          view: "list",
          rows: ["Carl", "Dave", "Eve"],
          selected: 0,
          softkey: "Call",
        });
        return fb.pixels;
      })(),
    );
  });

  for (const view of ["large", "list"] as const) {
    it(`jumps on letter keys with their multi-tap cycle (${view}: phone-book/letters-${view})`, () => {
      const golden = loadGolden(`phone-book/letters-${view}`);
      for (const { name } of golden.images) {
        const rig = list(view);
        const inert = /^inert-(.+)$/.exec(name);
        if (inert !== null) {
          const key = { star: "*", hash: "#" }[inert[1]!] ?? inert[1]!;
          rig.press(key as PhoneKey);
          rig.advance(300);
        } else {
          const [key, presses] = name.split("-");
          for (let p = 0; p < Number(presses); p++) {
            rig.press(key as PhoneKey);
            rig.advance(100);
          }
        }
        expectFrame(rig, `phone-book/letters-${view}`, name);
      }
    });
  }

  it("starts a new one-letter query after the commit timeout (phone-book/letters-commit)", () => {
    const rig = list("list");
    rig.press("5");
    rig.advance(1700);
    rig.press("5"); // J again, not K
    expect(rig.frame()).toEqual(
      (() => {
        const again = list("list");
        again.press("5");
        return again.frame();
      })(),
    );
    rig.advance(1700);
    rig.press("2");
    rig.advance(100);
    rig.press("2"); // B
    const b = list("list");
    b.press("2");
    b.press("2");
    expect(rig.frame()).toEqual(b.frame());
  });

  it("hands the highlighted entry to the soft key", () => {
    const chosen: PhoneBookEntry[] = [];
    const rig = list("large", {}, chosen);
    rig.press("down");
    rig.press("navi");
    expect(chosen).toEqual([at(1)]);
  });

  it("goes back at C's down", () => {
    const held = list("large");
    held.session.onKey({ type: "down", key: "c" });
    expect(held.exits).toEqual([{ atMs: 0, options: undefined }]);
    const custom: string[] = [];
    const own = list("large", { back: () => void custom.push("back") });
    own.press("c");
    expect(custom).toEqual(["back"]);
  });

  it("selects an entry by location after an edit, keeping the highlight's row", () => {
    let entries = [...CONTENT];
    let control: ReturnType<typeof nameList> | undefined;
    const rig = flowRig(() => {
      control = nameList({
        entries: () => entries,
        view: "list",
        softkey: "Erase",
        choose: () => {},
      });
      return control;
    });
    for (let i = 0; i < 4; i++) rig.press("down"); // Bob, on the bottom row (Ånna Ben [Bob])
    entries = entries.filter((e) => e.name !== "Bob");
    control!.select();
    const fb = new Framebuffer();
    paintWidget(fb, {
      kind: "name-list",
      view: "list",
      rows: ["Ånna", "Ben", "Carl"],
      selected: 2,
      softkey: "Erase",
    });
    expect(rig.frame()).toEqual(fb.pixels);
  });

  it("shows Assign tone's pages: the name and its tone", () => {
    const rig = list("page", { value: () => "Default", softkey: "Assign" });
    expectFrame(rig, "phone-book/tone-pages", "page-01");
  });
});
