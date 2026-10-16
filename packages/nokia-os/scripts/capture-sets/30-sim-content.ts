// Plan 30's goldens (docs/plans/30-sim-content-and-sim-services.md "Golden pipeline additions";
// paths under plan30/): SIM messages, sender names and SIM services (the SIM Toolkit's Menu 14),
// as an explicit table over Task 0's captures. Every golden names its SIM fixture
// (`SIM_CONTENT_SIMS`, the invented content Task 0's generator wrote into `plan30/sims/`, and the
// toolkit its applet played). Each row is imported `pending:30` until the task that implements it
// is done (`DONE_TASKS`, plan 29's pending workflow); `*#06#` is plan 22's screen (`pending:22`).
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet, ShotFile } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import { resources } from "../resource-inputs/30-sim-content.ts";
import {
  buildSoundGolden,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";
import { firstChangedFrame } from "../tree-capture-set.ts";

// ---------------------------------------------------------------- SIM fixtures

/** The fixture names: `plan30/sims/<name>.json`. */
export type SimContentSimName =
  | "empty"
  | "sms"
  | "smsread"
  | "order"
  | "names2"
  | "slots10"
  | "slots15"
  | "slots30"
  | "lnd"
  | "stk";

/** The applet scripts: `plan30/sims/stk-<name>.json`. */
export type SimContentToolkitName = "main" | "lachlan" | "title14";

/**
 * Task 0's fixtures as its generator states them (`sims/index.json`): `gen_v639_plan30.py check
 * <this file>` reads the object literal between the BEGIN/END lines and compares each SIM's phone
 * book and messages (in slot order) and the toolkits with the fixtures it wrote. Time stamps are
 * the generator's `DD.MM.YYYY HH:MM:SS`; `slot` places a message (1-based), `centre` is the
 * service-centre address the generator wrote into every record; `qualifier: 0` is DISPLAY TEXT's
 * clear-after-delay. `SIM_CONTENT_SIMS` below turns them into `StockSimCard` values.
 */
// BEGIN SIM_CONTENT_SIMS
const SIMS_JSON = {
  empty: { phoneBook: { entries: [] }, messages: { slots: 15, entries: [] } },
  sms: {
    phoneBook: {
      entries: [
        { name: "Ben", number: "0400000002" },
        { name: "Carl", number: "0400000003" },
        { name: "Dave", number: "+61400000004" },
        { name: "Bob", number: "0412345678" },
        { name: "Intl", number: "+61412345678" },
      ],
    },
    messages: {
      slots: 15,
      entries: [
        {
          slot: 1,
          number: "0400000002",
          text: "Lunch at 12?",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "+61412345678",
          text: "This message is exactly one hundred and sixty septets long, which is the most one SMS can carry in the GSM default alphabet. It ends right here with a dot.    .",
          sentAt: "13.10.2026 08:05:00",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0499000001",
          text: "Ext: 5€ [a] {b} ~c | d ^e \\f",
          sentAt: "13.10.2026 08:05:00",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 5,
          number: "+61400000003",
          text: "Plus sixty-one form",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 7,
          number: "0412345679",
          text: "Last digit differs",
          sentAt: "13.10.2026 08:05:00",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 9,
          number: "0400000004",
          text: "National form",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  smsread: {
    phoneBook: {
      entries: [
        { name: "Ben", number: "0400000002" },
        { name: "Carl", number: "0400000003" },
        { name: "Dave", number: "+61400000004" },
        { name: "Bob", number: "0412345678" },
        { name: "Intl", number: "+61412345678" },
      ],
    },
    messages: {
      slots: 15,
      entries: [
        {
          slot: 1,
          number: "0400000002",
          text: "Lunch at 12?",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "+61412345678",
          text: "This message is exactly one hundred and sixty septets long, which is the most one SMS can carry in the GSM default alphabet. It ends right here with a dot.    .",
          sentAt: "13.10.2026 08:05:00",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0499000001",
          text: "Ext: 5€ [a] {b} ~c | d ^e \\f",
          sentAt: "13.10.2026 08:05:00",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 5,
          number: "+61400000003",
          text: "Plus sixty-one form",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 7,
          number: "0412345679",
          text: "Last digit differs",
          sentAt: "13.10.2026 08:05:00",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 9,
          number: "0400000004",
          text: "National form",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  order: {
    phoneBook: { entries: [] },
    messages: {
      slots: 15,
      entries: [
        {
          slot: 1,
          number: "0400000201",
          text: "Old unread",
          sentAt: "12.10.2026 09:15:30",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "0400000202",
          text: "New read",
          sentAt: "13.10.2026 08:05:00",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0400000203",
          text: "New unread",
          sentAt: "13.10.2026 08:05:00",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 4,
          number: "0400000204",
          text: "Old read",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 6,
          number: "0400000206",
          text: "Oldest unread",
          sentAt: "01.01.2026 07:00:00",
          read: false,
          centre: "+123456789",
        },
        {
          slot: 8,
          number: "0400000208",
          text: "Newest read",
          sentAt: "13.10.2026 10:00:00",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  names2: {
    phoneBook: {
      entries: [
        { name: "Ann", number: "0412345678" },
        { name: "Zed", number: "+61498765432" },
        { name: "Sam", number: "123456" },
      ],
    },
    messages: { slots: 15, entries: [] },
  },
  slots10: {
    phoneBook: { entries: [] },
    messages: {
      slots: 10,
      entries: [
        {
          slot: 1,
          number: "0400000100",
          text: "Message 01",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "0400000101",
          text: "Message 02",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0400000102",
          text: "Message 03",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 4,
          number: "0400000103",
          text: "Message 04",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 5,
          number: "0400000104",
          text: "Message 05",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 6,
          number: "0400000105",
          text: "Message 06",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 7,
          number: "0400000106",
          text: "Message 07",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 8,
          number: "0400000107",
          text: "Message 08",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 9,
          number: "0400000108",
          text: "Message 09",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  slots15: {
    phoneBook: { entries: [] },
    messages: {
      slots: 15,
      entries: [
        {
          slot: 1,
          number: "0400000100",
          text: "Message 01",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "0400000101",
          text: "Message 02",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0400000102",
          text: "Message 03",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 4,
          number: "0400000103",
          text: "Message 04",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 5,
          number: "0400000104",
          text: "Message 05",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 6,
          number: "0400000105",
          text: "Message 06",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 7,
          number: "0400000106",
          text: "Message 07",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 8,
          number: "0400000107",
          text: "Message 08",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 9,
          number: "0400000108",
          text: "Message 09",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 10,
          number: "0400000109",
          text: "Message 10",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 11,
          number: "0400000110",
          text: "Message 11",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 12,
          number: "0400000111",
          text: "Message 12",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 13,
          number: "0400000112",
          text: "Message 13",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 14,
          number: "0400000113",
          text: "Message 14",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  slots30: {
    phoneBook: { entries: [] },
    messages: {
      slots: 30,
      entries: [
        {
          slot: 1,
          number: "0400000100",
          text: "Message 01",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 2,
          number: "0400000101",
          text: "Message 02",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 3,
          number: "0400000102",
          text: "Message 03",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 4,
          number: "0400000103",
          text: "Message 04",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 5,
          number: "0400000104",
          text: "Message 05",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 6,
          number: "0400000105",
          text: "Message 06",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 7,
          number: "0400000106",
          text: "Message 07",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 8,
          number: "0400000107",
          text: "Message 08",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 9,
          number: "0400000108",
          text: "Message 09",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 10,
          number: "0400000109",
          text: "Message 10",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 11,
          number: "0400000110",
          text: "Message 11",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 12,
          number: "0400000111",
          text: "Message 12",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 13,
          number: "0400000112",
          text: "Message 13",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 14,
          number: "0400000113",
          text: "Message 14",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 15,
          number: "0400000114",
          text: "Message 15",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 16,
          number: "0400000115",
          text: "Message 16",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 17,
          number: "0400000116",
          text: "Message 17",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 18,
          number: "0400000117",
          text: "Message 18",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 19,
          number: "0400000118",
          text: "Message 19",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 20,
          number: "0400000119",
          text: "Message 20",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 21,
          number: "0400000120",
          text: "Message 21",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 22,
          number: "0400000121",
          text: "Message 22",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 23,
          number: "0400000122",
          text: "Message 23",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 24,
          number: "0400000123",
          text: "Message 24",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 25,
          number: "0400000124",
          text: "Message 25",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 26,
          number: "0400000125",
          text: "Message 26",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 27,
          number: "0400000126",
          text: "Message 27",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 28,
          number: "0400000127",
          text: "Message 28",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
        {
          slot: 29,
          number: "0400000128",
          text: "Message 29",
          sentAt: "12.10.2026 09:15:30",
          read: true,
          centre: "+123456789",
        },
      ],
    },
  },
  lnd: {
    phoneBook: {
      entries: [
        { name: "Ben", number: "0400000002" },
        { name: "Carl", number: "0400000003" },
        { name: "Dave", number: "+61400000004" },
        { name: "Bob", number: "0412345678" },
        { name: "Intl", number: "+61412345678" },
      ],
    },
    messages: { slots: 15, entries: [] },
  },
  stk: { phoneBook: { entries: [] }, messages: { slots: 15, entries: [] } },
  toolkits: {
    main: {
      title: "SIM services",
      items: [
        { id: "short", label: "Ten chars!", steps: [{ kind: "text", text: "Hello from the SIM" }] },
        {
          id: "text-160",
          label: "Sixteen chars ok",
          steps: [
            {
              kind: "text",
              text: "This message is exactly one hundred and sixty septets long, which is the most one SMS can carry in the GSM default alphabet. It ends right here with a dot.    .",
            },
          ],
        },
        {
          id: "text-240",
          label: "Text 240",
          steps: [
            {
              kind: "text",
              text: "A long SIM text page: the toolkit can show up to two hundred and forty characters in one DISPLAY TEXT command, which the phone has to page or scroll. the toolkit can show up to two hundred and forty characters in one DISPLAY TEXT command, .",
            },
          ],
        },
        {
          id: "two-texts",
          label: "Two texts",
          steps: [
            { kind: "text", text: "First page" },
            { kind: "text", text: "Second page" },
          ],
        },
        {
          id: "auto-clear",
          label: "Auto clear",
          steps: [{ kind: "text", text: "Clears itself", qualifier: 0 }],
        },
        {
          id: "list",
          label: "List",
          steps: [
            {
              kind: "select",
              title: "Places",
              items: [
                { id: "home", label: "Home", steps: [{ kind: "text", text: "Home sweet home" }] },
                { id: "work", label: "Work", steps: [{ kind: "text", text: "Work page" }] },
              ],
            },
          ],
        },
        {
          id: "no-title",
          label: "No title",
          steps: [
            {
              kind: "select",
              items: [
                { id: "one", label: "One", steps: [{ kind: "text", text: "One" }] },
                { id: "two", label: "Two", steps: [{ kind: "text", text: "Two" }] },
              ],
            },
          ],
        },
        {
          id: "nested",
          label: "Nested",
          steps: [
            {
              kind: "select",
              title: "Level 1",
              items: [
                {
                  id: "deeper",
                  label: "Deeper",
                  steps: [
                    {
                      kind: "select",
                      title: "Level 2",
                      items: [
                        { id: "leaf", label: "Leaf", steps: [{ kind: "text", text: "Leaf text" }] },
                      ],
                    },
                  ],
                },
                { id: "flat", label: "Flat", steps: [{ kind: "text", text: "Flat text" }] },
              ],
            },
          ],
        },
        {
          id: "call-alpha",
          label: "Call alpha",
          steps: [{ kind: "call", number: "0412345678", confirm: "Call Lachlan?" }],
        },
        { id: "call-plain", label: "Call plain", steps: [{ kind: "call", number: "0412345678" }] },
        {
          id: "text-call",
          label: "Text then call",
          steps: [
            { kind: "text", text: "Calling next" },
            { kind: "call", number: "0298765432", confirm: "Ring office?" },
          ],
        },
        {
          id: "long-label",
          label: "Twenty-four characters!!",
          steps: [{ kind: "text", text: "Long label item" }],
        },
      ],
    },
    lachlan: {
      title: "LACHLAN",
      items: [{ id: "info", label: "Info", steps: [{ kind: "text", text: "Lachlan's SIM" }] }],
    },
    title14: {
      title: "Portfolio menu",
      items: [
        { id: "about", label: "About", steps: [{ kind: "text", text: "About me" }] },
        { id: "work", label: "Work", steps: [{ kind: "text", text: "Work" }] },
        {
          id: "contact",
          label: "Contact",
          steps: [{ kind: "call", number: "0412345678", confirm: "Call me?" }],
        },
      ],
    },
  },
} as const;
// END SIM_CONTENT_SIMS

/** A time stamp as a `StockTimestamp` (plan 18). */
export interface SimContentStamp {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** One SIM message as a `StockSimMessage`. */
export interface SimContentMessage {
  readonly number: string;
  readonly text: string;
  readonly sentAt: SimContentStamp;
  readonly read: boolean;
  readonly centre: string;
}

/** A toolkit step and item as `StockToolkitStep` / `StockToolkitItem`. */
export type SimContentStep =
  | { readonly kind: "text"; readonly text: string; readonly clear?: "delay" }
  | { readonly kind: "select"; readonly title?: string; readonly items: readonly SimContentItem[] }
  | { readonly kind: "call"; readonly number: string; readonly confirm?: string };
export interface SimContentItem {
  readonly id: string;
  readonly label: string;
  readonly steps: readonly SimContentStep[];
}
export interface SimContentToolkit {
  readonly title: string;
  readonly items: readonly SimContentItem[];
}

/** A SIM fixture as a `StockSimCard` value (plan 30 D2, D3). */
export interface SimContentSim {
  readonly id: string;
  readonly phoneBook: { readonly entries: readonly { name: string; number: string }[] };
  readonly messages: {
    readonly slots: number;
    readonly entries: readonly (SimContentMessage | null)[];
  };
  readonly toolkit?: SimContentToolkit;
}

/** `DD.MM.YYYY HH:MM:SS`. */
function stamp(text: string): SimContentStamp {
  const m = /^(\d\d)\.(\d\d)\.(\d{4}) (\d\d):(\d\d):(\d\d)$/.exec(text);
  if (m === null) throw new Error(`bad fixture time stamp ${text}`);
  const [day, month, year, hour, minute, second] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return { year, month, day, hour, minute, second };
}

interface FixtureMessage {
  readonly slot: number;
  readonly number: string;
  readonly text: string;
  readonly sentAt: string;
  readonly read: boolean;
  readonly centre: string;
}

function messagesOf(spec: {
  readonly slots: number;
  readonly entries: readonly FixtureMessage[];
}): SimContentSim["messages"] {
  const list = spec.entries;
  const last = Math.max(0, ...list.map((m) => m.slot));
  const entries = Array.from({ length: last }, (_, i): SimContentMessage | null => {
    const m = list.find((message) => message.slot === i + 1);
    if (m === undefined) return null;
    const { number, text, read, centre } = m;
    return { number, text, sentAt: stamp(m.sentAt), read, centre };
  });
  return { slots: spec.slots, entries };
}

function stepOf(s: Record<string, unknown>): SimContentStep {
  if (s.kind === "text") {
    return s.qualifier === 0
      ? { kind: "text", text: s.text as string, clear: "delay" }
      : { kind: "text", text: s.text as string };
  }
  if (s.kind === "select") {
    return {
      kind: "select",
      ...(s.title === undefined ? {} : { title: s.title as string }),
      items: (s.items as readonly Record<string, unknown>[]).map(itemOf),
    };
  }
  return {
    kind: "call",
    number: s.number as string,
    ...(s.confirm === undefined ? {} : { confirm: s.confirm as string }),
  };
}

function itemOf(item: Record<string, unknown>): SimContentItem {
  return {
    id: item.id as string,
    label: item.label as string,
    steps: (item.steps as readonly Record<string, unknown>[]).map(stepOf),
  };
}

/** Task 0's applet scripts as `StockSimToolkit` values. */
export const SIM_CONTENT_TOOLKITS: Readonly<Record<SimContentToolkitName, SimContentToolkit>> =
  Object.fromEntries(
    Object.entries(SIMS_JSON.toolkits).map(([name, toolkit]) => [
      name,
      {
        title: toolkit.title,
        items: (toolkit.items as readonly Record<string, unknown>[]).map(itemOf),
      },
    ]),
  ) as unknown as Record<SimContentToolkitName, SimContentToolkit>;

/**
 * Task 0's SIM fixtures as `StockSimCard` values (without a toolkit: a capture log's `# toolkit:`
 * header adds one, `simContentCard`). Every fixture is the emulator SIM's identity, `sim-1`.
 */
export const SIM_CONTENT_SIMS: Readonly<Record<SimContentSimName, SimContentSim>> =
  Object.fromEntries(
    Object.entries(SIMS_JSON)
      .filter(([name]) => name !== "toolkits")
      .map(([name, spec]) => {
        const sim = spec as {
          readonly phoneBook: { readonly entries: readonly { name: string; number: string }[] };
          readonly messages: Parameters<typeof messagesOf>[0];
        };
        return [
          name,
          {
            id: "sim-1",
            phoneBook: { entries: sim.phoneBook.entries.map((e) => ({ ...e })) },
            messages: messagesOf(sim.messages),
          },
        ];
      }),
  ) as unknown as Record<SimContentSimName, SimContentSim>;

/** The card a capture ran with: fixture `sim`, with the applet script `toolkit` (or none). */
export function simContentCard(
  sim: SimContentSimName,
  toolkit: SimContentToolkitName | undefined,
): SimContentSim {
  const card = SIM_CONTENT_SIMS[sim];
  return toolkit === undefined ? card : { ...card, toolkit: SIM_CONTENT_TOOLKITS[toolkit] };
}

// ---------------------------------------------------------------- statuses

/**
 * The tasks whose goldens are asserted: each row names the task that implements it, and is
 * `pending:30` until that task is listed here (plan 29's pending workflow).
 */
export const DONE_TASKS: ReadonlySet<number> = new Set<number>([]);

/** The plan 30 task that implements a golden. */
export type SimContentTask = 4 | 5 | 7 | 8;

/** Goldens another plan's screen shows: `*#06#` (plan 22). */
type Owner = "22";

function statusOf(task: SimContentTask, owner: Owner | undefined): GoldenStatus {
  if (owner !== undefined) return `pending:${owner}`;
  return DONE_TASKS.has(task) ? "asserted" : "pending:30";
}

// ---------------------------------------------------------------- table

interface Row {
  readonly id: string;
  /**
   * Under plan30/: a recording directory (a timeline), a scroll directory (`scroll`), or the
   * directory of `shots` (a still).
   */
  readonly dir: string;
  /** Files under `dir` without `.png` (a still), named by their path with `/` as `-`. */
  readonly shots?: readonly string[];
  /** `dir` is a scroll (`01.png`, `02.png`, …), one still per screen. */
  readonly scroll?: true;
  readonly sim: SimContentSimName;
  readonly toolkit?: SimContentToolkitName;
  readonly task: SimContentTask;
  readonly owner?: Owner;
  readonly note: string;
}

const range = (prefix: string, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, "0")}`);

/** A message's pages and Details: `page/01..pages`, `details/01..03`. */
const readShots = (pages: number, details: readonly number[] = [1, 2, 3]): string[] => [
  ...range("page/", 1, pages),
  ...details.map((n) => `details/0${n}`),
];

/** The sender cases of `names/` (the `sms` fixture plus one network arrival each). */
const NAME_CASES: readonly (readonly [string, string])[] = [
  ["exact", "0400000002: Ben, stored the same"],
  ["plus61", "+61400000002 (the harness drops the +): Ben 0400000002"],
  ["national-of-plus", "0400000004: Dave, stored +61400000004"],
  ["plus-exact", "+61400000004 (arrives 61400000004): Dave"],
  ["last-digit", "0400000001: nobody (Ben's number but the last digit)"],
  ["unknown", "0499999999: nobody"],
  ["bob-k6", "0412945678: nobody (differs from Bob in digit 6 from the end)"],
  ["bob-k7", "0419345678: nobody (digit 7)"],
  ["bob-k8", "0492345678: nobody (digit 8)"],
  ["bob-k9", "0812345678: nobody (digit 9)"],
  [
    "bob-k10",
    "5412345678: nobody, though its last 9 digits are Bob's and Intl's (the shared-suffix gap)",
  ],
  [
    "bob-9digits",
    "412345678: nobody, though it is Bob's and Intl's last 9 digits (the shared-suffix gap)",
  ],
  ["bob-plus", "+61412345678 (arrives 61412345678): nobody (the shared-suffix gap)"],
  ["bob-plus44", "+44412345678 (arrives 44412345678): Bob"],
];

/** `names/digits`: one Inbox list per arrival's number (the `names2` fixture). */
const DIGIT_SHOTS = [
  "0061412345678",
  "0123456",
  "0312345678",
  "0402345678",
  "0412345678",
  "0412345679",
  "0412945678",
  "0413345678",
  "0498765432",
  "123456",
  "12345678",
  "23456",
  "2345678",
  "412345678",
  "44412345678",
  "4498765432",
  "498765432",
  "5412345678",
  "61412345678",
  "61498765432",
  "9123456",
  "98765432",
];

const TOOLKITS: readonly SimContentToolkitName[] = ["main", "lachlan", "title14"];

const ROWS: readonly Row[] = [
  // ------------------------------------------------ SIM messages (M): power-on
  {
    id: "sim/sms-boot-unread",
    dir: "sms/boot",
    shots: ["unread-after-c", "unread-inbox"],
    sim: "sms",
    task: 4,
    note: "SIM sms (three unread): standby after power-on shows only the envelope; the Inbox lists the unread first.",
  },
  {
    id: "sim/sms-boot-read",
    dir: "sms/boot",
    shots: ["read-after-c", "read-inbox"],
    sim: "smsread",
    task: 4,
    note: "SIM smsread (all read): standby after power-on without the envelope; the Inbox in slot order.",
  },
  {
    id: "sim/sms-boot-empty",
    dir: "sms/boot",
    shots: ["empty-after-c"],
    sim: "empty",
    task: 4,
    note: "SIM empty: standby after power-on.",
  },
  {
    id: "sim/sms-boot-factory",
    dir: "sms/boot",
    shots: ["factory-standby"],
    sim: "sms",
    task: 4,
    note: "SIM sms on the factory image: standby after power-on shows only the envelope (no notice, no tone).",
  },
  // ------------------------------------------------ Inbox, reading, Details
  {
    id: "sim/sms-inbox-open",
    dir: "sms/inbox/open",
    sim: "sms",
    task: 4,
    note: "SIM sms: Inbox's Select: Opening, then the list on the first unread message (named senders).",
  },
  {
    id: "sim/sms-inbox-list",
    dir: "sms/inbox/list",
    scroll: true,
    sim: "sms",
    task: 4,
    note: "SIM sms: the Inbox list, ▼ per image: unread (slots 2, 3, 7), then read (slots 1, 5, 9), past the wrap.",
  },
  ...[1, 2, 3, 4, 5, 6].map(
    (n): Row => ({
      id: `sim/sms-read-${n}`,
      dir: `sms/read/${n}`,
      shots: readShots(n === 1 ? 5 : 3),
      sim: "sms",
      task: 4,
      note: `SIM sms: Inbox message ${n}: its pages (text, Sender:, Sent:), then Details (Sender:, Message centre:, Time:).`,
    }),
  ),
  {
    id: "sim/sms-read-1-open",
    dir: "sms/read/1/open",
    sim: "sms",
    task: 4,
    note: "SIM sms: Read on message 1 (Intl's 160 septets): Opening message, its first page.",
  },
  {
    id: "sim/sms-read-2-open",
    dir: "sms/read/2/open",
    sim: "sms",
    task: 4,
    note: "SIM sms: Read on message 2: the extension-table characters [ ] { } ~ | ^ drawn as ?.",
  },
  {
    id: "sim/sms-order-list",
    dir: "sms/order/list",
    scroll: true,
    sim: "order",
    task: 4,
    note: "SIM order: unread first, then read, each in slot order whatever their time stamps; ▼ per image.",
  },
  {
    id: "sim/sms-erase",
    dir: "sms/erase/erase",
    sim: "sms",
    task: 4,
    note: "SIM sms, 0499000001 read before: Erase message?'s OK on Intl: Erasing message, Erased, the list re-sorted.",
  },
  {
    id: "sim/sms-erase-after",
    dir: "sms/erase",
    shots: [...range("list-after/", 1, 4), ...range("reboot-list/", 1, 4)],
    sim: "sms",
    task: 4,
    note: "SIM sms: the list after the erase, ▼ per image, then the same after a cold power-on with the written SIM.",
  },
  ...(["10", "15", "30"] as const).flatMap((slots): Row[] => [
    ...[1, 2, 3].map(
      (n): Row => ({
        id: `sim/sms-slots-${slots}-arrive-${n}`,
        dir: `sms/slots/${slots}/arrive-${n}`,
        sim: `slots${slots}`,
        task: 4,
        note:
          n === 1
            ? `SIM slots${slots} (one free slot): an arrival takes it (1 message received).`
            : `SIM slots${slots}, full: arrival ${n}: No space for new messages, the envelope blinking.`,
      }),
    ),
    {
      id: `sim/sms-slots-${slots}-list`,
      dir: `sms/slots/${slots}`,
      shots: range("list/", 1, 3),
      sim: `slots${slots}`,
      task: 4,
      note: `SIM slots${slots}: the Inbox after the arrivals, ▼ per image: the arrival first (unread), then the full SIM's messages in slot order.`,
    },
  ]),
  {
    id: "sim/sms-restore-list",
    dir: "sms/restore",
    shots: range("list-after/", 1, 4),
    sim: "sms",
    task: 4,
    note: "SIM sms on the factory image: the Inbox after Restore factory settings keeps every SIM message.",
  },
  // ------------------------------------------------ sender names (N)
  ...NAME_CASES.map(
    ([slug, what]): Row => ({
      id: `sim/names-${slug}`,
      dir: `names/${slug}`,
      shots: ["list", "page/02", "details/01"],
      sim: "sms",
      task: 5,
      note: `SIM sms, an arrival from ${what}: the Inbox list, Sender: and Details' Sender:.`,
    }),
  ),
  {
    id: "sim/names-exact-arrive",
    dir: "names/exact/arrive",
    sim: "sms",
    task: 5,
    note: "SIM sms: Ben's arrival at standby: 4 messages received (the notice names nobody).",
  },
  {
    id: "sim/names-exact-notice-read",
    dir: "names/exact/notice-read",
    sim: "sms",
    task: 5,
    note: "SIM sms: Read on the notice: Opening, the Inbox list with Ben named.",
  },
  {
    id: "sim/names-digits",
    dir: "names/digits",
    shots: DIGIT_SHOTS,
    sim: "names2",
    task: 5,
    note: "SIM names2 (Ann 0412345678, Zed +61498765432, Sam 123456): one arrival per image (its number), the Inbox list: the last-9-digits rule.",
  },
  // ------------------------------------------------ SIM services (K): carousel
  {
    id: "sim/stk-carousel-main-up",
    dir: "stk/carousel/main/up-to-last",
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: "SIM stk, toolkit main: ▲ from Phone book wraps to Menu 14: SIM services, 14, the icon's 11 frames.",
  },
  ...(["lachlan", "title14"] as const).map(
    (toolkit): Row => ({
      id: `sim/stk-carousel-${toolkit}`,
      dir: `stk/carousel/${toolkit}`,
      shots: ["last"],
      sim: "stk",
      toolkit,
      task: 7,
      note: `SIM stk, toolkit ${toolkit}: Menu 14 settled after ▲ from Phone book: the title as the label (${toolkit === "lachlan" ? "LACHLAN" : "Portfolio menu shows Portfolio"}).`,
    }),
  ),
  {
    id: "sim/stk-carousel-main-down-wrap",
    dir: "stk/carousel/main/down-wrap",
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: "SIM stk: ▼ on Menu 14 wraps to Phone book.",
  },
  {
    id: "sim/stk-carousel-main-up-again",
    dir: "stk/carousel/main/up-again",
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: "SIM stk: ▲ on Menu 14: Profiles (12).",
  },
  {
    id: "sim/stk-carousel-main-menu-13",
    dir: "stk/carousel/main/menu-13",
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: "SIM stk: Menu 1 3 at standby: Invalid shortcut (there is no 13), then standby.",
  },
  {
    id: "sim/stk-carousel-main-menu-14",
    dir: "stk/carousel/main/menu-14",
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: "SIM stk: Menu 1 4 at standby: the slot, then the level.",
  },
  // ------------------------------------------------ the level
  ...TOOLKITS.flatMap((toolkit): Row[] => [
    {
      id: `sim/stk-level-${toolkit}-open`,
      dir: `stk/level/${toolkit}/open`,
      sim: "stk",
      toolkit,
      task: 7,
      note: `SIM stk, toolkit ${toolkit}: Select on Menu 14: the items (no title, no menu number, OK).`,
    },
    {
      id: `sim/stk-level-${toolkit}-rows`,
      dir: `stk/level/${toolkit}`,
      shots: range("rows/", 1, { main: 13, lachlan: 1, title14: 3 }[toolkit]),
      sim: "stk",
      toolkit,
      task: 7,
      note: `SIM stk, toolkit ${toolkit}: the level, ▼ per image to the wrap (long labels cut with ...).`,
    },
  ]),
  {
    id: `sim/stk-level-main-c`,
    dir: `stk/level/main/c`,
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: `SIM stk, toolkit main: C in the level: the carousel on Menu 14, its icon restarting.`,
  },
  {
    id: `sim/stk-level-main-up`,
    dir: `stk/level/main/up`,
    sim: "stk",
    toolkit: "main",
    task: 7,
    note: `SIM stk, toolkit main: ▲ in the level.`,
  },
  // ------------------------------------------------ DISPLAY TEXT
  ...(
    [
      ["short", "open", "Ten chars!'s text: Wait, then Hello from the SIM."],
      ["short", "ok", "OK on the text: the level, the item still selected."],
      ["short", "c", "C on the text: Wait, then the level."],
      ["short", "wait-60s", "a wait-for-user text left alone: the level after ≈54 s."],
      ["text-160", "open", "Sixteen chars ok's 160 characters: Wait 241 ms, its first page."],
      ["text-160", "ok", "OK on the 160-character text: the level."],
      ["text-160", "c", "C on the 160-character text."],
      ["text-240", "open", "Text 240: Wait 311 ms, its first page."],
      ["text-240", "ok", "OK on the 240-character text."],
      ["text-240", "c", "C on the 240-character text."],
      ["two", "open", "Two texts: Wait, the first."],
      ["two", "ok-1", "OK on the first: the second."],
      ["two", "ok-2", "OK on the second: the level."],
      ["two", "c-1", "C on the first: Wait, the level."],
      ["auto", "open", "Auto clear (clear after a delay): Wait, its text."],
      ["auto", "wait-60s", "the clear-after-delay text clears itself after ≈3.58 s."],
    ] as const
  ).map(
    ([text, rec, what]): Row => ({
      id: `sim/stk-text-${text}-${rec}`,
      dir: `stk/text/${text}/${rec}`,
      sim: "stk",
      toolkit: "main",
      task: 7,
      note: `SIM stk: ${what}`,
    }),
  ),
  ...(["text-160", "text-240"] as const).map(
    (text): Row => ({
      id: `sim/stk-text-${text}-pages`,
      dir: `stk/text/${text}/page`,
      scroll: true,
      sim: "stk",
      toolkit: "main",
      task: 7,
      note: `SIM stk: ▼ through ${text}'s pages, four lines each.`,
    }),
  ),
  // ------------------------------------------------ SELECT ITEM
  ...(
    [
      ["list", "open", "List: Wait, the list (its title Places not drawn)."],
      ["list", "select", "OK on Work: Wait, Work page."],
      ["list", "select-ok", "OK on Work page: the list again (the harness re-issues it)."],
      ["list", "c", "C on the list: Wait, the level."],
      ["list", "text-c", "C on Work page: Wait, the list."],
      ["nested", "open", "Nested: Wait, Level 1's list."],
      ["nested", "level-2", "OK on Deeper: Wait, Level 2's list."],
      ["nested", "leaf", "OK on Leaf: Wait, Leaf text."],
      ["nested", "leaf-ok", "OK on Leaf text: Level 2's list."],
      ["nested", "level-2-c", "C on Level 2's list: Wait, Level 1's list."],
      ["nested", "level-1-c", "C on Level 1's list: Wait, the level."],
      ["no-title", "open", "No title: Wait, the list."],
      ["no-title", "select", "OK on Two: Wait, Two."],
      ["no-title", "select-ok", "OK on Two's text: the list again."],
    ] as const
  ).map(
    ([list, rec, what]): Row => ({
      id: `sim/stk-select-${list}-${rec}`,
      dir: `stk/select/${list}/${rec}`,
      sim: "stk",
      toolkit: "main",
      task: 7,
      note: `SIM stk: ${what}`,
    }),
  ),
  ...(["list", "no-title"] as const).map(
    (list): Row => ({
      id: `sim/stk-select-${list}-rows`,
      dir: `stk/select/${list}/rows`,
      scroll: true,
      sim: "stk",
      toolkit: "main",
      task: 7,
      note: `SIM stk: ▼ through ${list === "list" ? "List" : "No title"}'s items.`,
    }),
  ),
  // ------------------------------------------------ IMEI (I): plan 22's *#06#
  {
    id: "sim/imei-screen",
    dir: "imei",
    shots: ["screen"],
    sim: "empty",
    task: 8,
    owner: "22",
    note: "IMEI 490154203310018 written by the emulator's provisioning: *#06#: Serial No., 4901542033 / 10018.",
  },
];

/** The SIM fixture and toolkit a golden's capture ran with, by golden id. */
export const SIM_CONTENT_GOLDEN_SIMS: Readonly<
  Record<string, { readonly sim: SimContentSimName; readonly toolkit?: SimContentToolkitName }>
> = Object.fromEntries(
  ROWS.map((row) => [
    row.id,
    { sim: row.sim, ...(row.toolkit === undefined ? {} : { toolkit: row.toolkit }) },
  ]),
);

/** The image name of a shot file: its path under the row's directory, `/` as `-`. */
const shotName = (file: string): string => file.replace(/\//g, "-");

function lcdEntries(io: CaptureIo | undefined): CaptureSetEntry[] {
  return ROWS.map((row): CaptureSetEntry => {
    const status = statusOf(row.task, row.owner);
    const note = row.note;
    const dir = `plan30/${row.dir}`;
    if (row.shots !== undefined) {
      const files: ShotFile[] = row.shots.map((s) => ({
        file: `${dir}/${s}.png`,
        name: shotName(s),
      }));
      return {
        id: row.id,
        kind: "still",
        status,
        prefer: { source: { kind: "shots", files }, note },
      };
    }
    if (row.scroll) {
      return {
        id: row.id,
        kind: "still",
        status,
        prefer: { source: { kind: "scroll", dir }, note },
      };
    }
    const frames = io?.frames.recording(dir);
    return {
      id: row.id,
      kind: "timeline",
      status,
      prefer: {
        source: { kind: "recording", dir },
        triggerFrame: frames === undefined ? 1 : firstChangedFrame(frames),
        note,
      },
    };
  });
}

// ---------------------------------------------------------------- sounds

interface SoundRow {
  readonly id: string;
  readonly dir: string;
  readonly note: string;
}

/** The toolkit screens on the factory image: key beeps only, no tone of their own (D13). */
const SOUND_ROWS: readonly SoundRow[] = [
  {
    id: "sound/stk/carousel-up",
    dir: "carousel-up",
    note: "▲ from Phone book to Menu 14: ▲'s beep only.",
  },
  { id: "sound/stk/level-open", dir: "level-open", note: "Select on Menu 14: Select's beep only." },
  {
    id: "sound/stk/text-open",
    dir: "text-open",
    note: "OK on Ten chars!: Wait, the text: OK's beep only.",
  },
  { id: "sound/stk/text-ok", dir: "text-ok", note: "OK on the text: the level: OK's beep only." },
  { id: "sound/stk/text-c", dir: "text-c", note: "C on the text: Wait, the level: C's beep only." },
  {
    id: "sound/stk/select-open",
    dir: "select-open",
    note: "OK on List: Wait, the list: OK's beep only.",
  },
  {
    id: "sound/stk/select-select",
    dir: "select-select",
    note: "OK on Home: Wait, its text: OK's beep only.",
  },
  {
    id: "sound/stk/select-c",
    dir: "select-c",
    note: "C on the list: Wait, the level: C's beep only.",
  },
  {
    id: "sound/stk/auto-open",
    dir: "auto-open",
    note: "OK on Auto clear: Wait, the text: OK's beep only.",
  },
  {
    id: "sound/stk/auto-wait",
    dir: "auto-wait",
    note: "The clear-after-delay text clears itself: silent.",
  },
];

export const SIM_CONTENT_SOUNDS: readonly SoundCaptureEntry[] = SOUND_ROWS.map((row) => ({
  id: row.id,
  dir: `plan30/sound/stk/${row.dir}`,
  state: "factory",
  status: statusOf(7, undefined),
  note: `SIM stk, toolkit main (factory image): ${row.note}`,
}));

/** The plan 30 task that implements each golden (sound goldens included), by id. */
export const SIM_CONTENT_TASKS: Readonly<Record<string, number>> = Object.fromEntries([
  ...ROWS.map((row) => [row.id, row.task]),
  ...SOUND_ROWS.map((row) => [row.id, 7]),
]);

export function simContentSounds(io: SoundCaptureIo): SoundGolden[] {
  return SIM_CONTENT_SOUNDS.map((entry) => buildSoundGolden(entry, io));
}

// ---------------------------------------------------------------- the set

export const SIM_CONTENT_NOT_IMPORTED: Readonly<Record<string, string>> = {
  "plan30/**/*@8x.png": "previews",
  "plan30/text.json, recordings.json, logs/, terminal-profile.txt":
    "OCR, recording parents, the applet logs and the terminal profile (the spec restates it)",
  "plan30/sims/": "the SIM fixtures and applet scripts (restated as SIM_CONTENT_SIMS)",
  "plan30/sms/boot/*/ (recordings), *-standby but factory-standby, *-inbox but unread/read":
    "the power-on recordings type the virgin image's date prompt and dismiss its first standby prompt (setup artefacts nokia-os's skip boot does not show); their standby and Inbox stills are imported",
  "plan30/sms/inbox/list-up.png, standby.png, sms/read/*/list.png, open/ but 1 and 2, options/":
    "the same screens as the imported lists, plan 18's Options list",
  "plan30/sms/order/read-*": "each message's pages: plan 18's layout, imported for sms/read",
  "plan30/sms/erase/{list-before,confirm,after,reboot-standby}.png":
    "the screens around the imported erase recording and lists",
  "plan30/sms/slots/*/{arrive-*-end,standby}.png, messages-menu/":
    "the recordings' last frames; the Messages level (plan 14's)",
  "plan30/sms/restore/{restore/,code-prompt.png,list-before.png}":
    "plan 15's Restore flow; the list before equals sim/sms-inbox-list",
  "plan30/names/*/{page/01,page/03,details/02,details/03}.png":
    "the text and time pages (plan 18's layout); a network arrival's Message centre (the emulator network's +1234567890, where plan 18's model shows Set 1's centre: plan 18's)",
  "plan30/names/*/{notice.png,chat.png,reply-*,use-number/,read/,arrive/,notice-read/} but exact's arrive and notice-read":
    "the notice (counts every unread message), Chat (Chat name: empty), Reply (the virgin centre's Set list), Use number (plan 22): unchanged by names",
  "plan30/lnd/":
    "EF_LND is never read (D8): standby ▲ and Dialled numbers are plan 22's empty screens, already its goldens",
  "plan30/stk/carousel/main/{last,menu-13-end,menu-14-end,phone-book}.png, down-back, lachlan and title14's recordings and other stills":
    "the same screens and icon animation as the imported recordings (lachlan and title14 keep their settled label)",
  "plan30/stk/level/*/held-c, stk/text/*/held-c, stk/select/*/*held*":
    "held C: the firmware's long press reaches standby ≈530 ms after the down, the kernel's at 800 ms (plan 19's known gap); C's screens are imported",
  "plan30/stk/level/*/carousel.png": "the carousel stills (the recordings' first frames)",
  "plan30/stk/text/short/{open-*,after-ok*,keys,page}, text-160/open-*, text-240/open-*, two/open-c, stk/select/*/open-*, list/c-2":
    "the opening recordings again before another key; a one-frame keys recording",
  "plan30/stk/call/":
    "SET UP CALL never completes in the emulator (a blank OK screen): the call confirm is composed (D4, D6)",
  "plan30/stk/in-call/": "a call's Options (plan 22's); SIM services is not reachable in a call",
  "plan30/sound/stk/{call-*,select-open-2,text-open-2,text-open-3} (and every sound/stk LCD frame)":
    "the frozen SET UP CALL screen; repeats of the imported sounds",
  "plan30/imei/{virgin,live,code,code-c,version,c,leave}, *-standby.png":
    "plan 22's virgin *#06#, its number entry and *#0000#; every IMEI screen repeats imei/screen",
  "plan30/**/*.wav, plan30/**/*.events.csv but sound/stk's": "the LCD sections' audio",
  "scratch-plan30/": "exploration probes, never imported",
};

export const simContent: PlanCaptureSet = {
  plan: "30",
  resources,
  lcd: (io) => lcdEntries(io),
  sounds: (io) => simContentSounds(io.sound),
  notImported: SIM_CONTENT_NOT_IMPORTED,
};
