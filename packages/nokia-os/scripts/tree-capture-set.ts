// Golden selection for the v6.39 menu tree (plan 14 "Golden selection", rules S1-S8).
//
// `treeCaptureSet` walks `tree.json` in tree order and returns capture-set entries that the
// importer appends to plan 13's CAPTURE_SET. It reads captures only through the injected
// `TreeCaptureIo`, so tests run it on a hand-written mini tree. Paths are relative to
// `$REF/captures/6.39`. Pure: imports only sibling scripts.
import { MENU_SLUGS, type CaptureSetEntry } from "./capture-set.ts";
import type { GoldenScenario, GoldenStatus } from "./golden-format.ts";

// ---------------------------------------------------------------- tree.json (the fields used)

export interface TreeJsonOption {
  readonly number: string;
  readonly label: string;
  readonly softkey: string | null;
  /** One-line summary of what confirming it shows (`timed-note "Done", then back`). */
  readonly result: string;
  readonly highlighted_on_entry: boolean;
}

export interface TreeJsonNode {
  readonly number: string;
  readonly label: string;
  readonly kind: "submenu" | "leaf";
  readonly opens: {
    readonly screen?: string;
    readonly softkey?: string | null;
    readonly highlighted_on_entry?: string | null;
    readonly no_highlight_on_entry?: boolean;
    readonly splash_first?: boolean;
    readonly options?: readonly TreeJsonOption[];
    /** Where a leaf went by itself within 3.5 s (timed notes). */
    readonly then?: { readonly back_to_list?: boolean; readonly to_standby?: boolean };
  };
  readonly children?: readonly TreeJsonNode[];
}

export interface TreeJson {
  readonly root: { readonly children: readonly TreeJsonNode[] };
}

// ---------------------------------------------------------------- tables

/**
 * Same-as subtrees (S6): everything strictly below each key is the subtree below its value,
 * renumbered. The keys' own level lists stay under S1. Task 13 proves the structures equal.
 */
export const SAME_AS: Readonly<Record<string, string>> = {
  "7-2": "7-1",
  "7-4": "7-1",
  "12-3-2": "12-2-2",
  "12-4-2": "12-2-2",
  "12-5-2": "12-2-2",
  "12-6-2": "12-2-2",
};

/**
 * Leaves that open the placeholder, by node pattern → owner plan (plan 14 "Leaf ownership").
 * A pattern is a menu number whose segments may be `*` (any one segment); a trailing `-**`
 * also matches everything below.
 */
export const PLACEHOLDER_OWNERS: Readonly<Record<string, string>> = {
  "2-1": "18", // Write messages: text editor
  "2-4": "18", // Picture messages: nothing in the virgin EEPROM
  "2-5": "18", // Templates
  "2-6": "18", // Smileys
  "2-8-4-1-**": "18", // Topics: lists of box-glyph names (virgin EEPROM)
  "2-8-4-2-**": "18",
  "2-8-4-3-**": "18",
  "2-10": "18", // Service command editor
  "3": "18", // Chat
  "5-4-*": "16", // Composer slots
  "5-9-4": "18", // Screen saver › Screen saver: nothing in the virgin EEPROM
  "12-*-2-9-4": "18",
  "6-2-1-3": "15", // Русский: native-language note, then that UI
  "6-2-1-4": "15", // Български
  "6-2-1-5": "15", // Українська
  "6-2-3": "15", // Welcome note: text editor
  "8-2-1": "24", // Space impact › New game
  "8-3-1": "24", // Bantumi › New game
  "8-4-1-1": "24", // Pairs II › Time trial › New game
  "8-4-2-1": "24", // Pairs II › Puzzle › New game
  "9": "20", // Calculator
  "11-4": "21", // Stopwatch
  "12-*-1": "17", // Profiles › Activate
};

/** Leaf screen kinds a stock widget or placeholder handles; anything else is an import error. */
export const LEAF_KINDS: readonly string[] = [
  "timed-note",
  "static-note",
  "progress-note",
  "confirm-query",
  "info-screen",
  "text-input",
  "number-input",
  "code-prompt",
  "level-bar",
  "text-editor",
  "text-pages",
  "application",
  "symbol-table",
  "no-response",
  "returns-immediately",
  "standby",
];

/** Lists whose entries ▼ walks and OK/the page's soft key confirms. */
const LIST_SCREENS = ["option-list", "info-pages"] as const;

/** Two recordings are equal when every step matches within this many ms (D8, S4). */
export const SHARE_TOLERANCE_MS = 2;

/**
 * Pending goldens keep at most this many frames: gameplay recordings (Snake II: 694 frames) are
 * evidence for their owner plan, which recaptures what it asserts (D6 repo size).
 */
export const MAX_PENDING_FRAMES = 40;

/**
 * Leaves whose recording keeps only MAX_PENDING_FRAMES frames although asserted, by number → the
 * plan whose game goldens assert the rest: Snake II's New game at the virgin level (plan 23
 * "Capture set"; its 694 frames are one cell per ≈8 ms).
 */
export const ASSERTED_EARLY: Readonly<Record<string, string>> = { "8-1-1": "23" };

// ---------------------------------------------------------------- io

/** One distinct LCD state of a `record` directory; `image` identifies the pixels. */
export interface RecordingFrame {
  readonly image: string;
  readonly startMs: number;
  readonly durationMs: number;
}

export interface TreeCaptureIo {
  /** The frames of `<dir>/timings.csv`, or undefined when the recording is missing. */
  recording(dir: string): readonly RecordingFrame[] | undefined;
  /** The `NN.png` names (without `.png`) in a scroll directory, sorted; undefined when missing. */
  scrollImages(dir: string): readonly string[] | undefined;
}

export interface TreeCaptureTables {
  readonly sameAs?: Readonly<Record<string, string>>;
  readonly placeholders?: Readonly<Record<string, string>>;
  readonly assertedEarly?: Readonly<Record<string, string>>;
}

export class TreeCaptureError extends Error {
  constructor(number: string, message: string) {
    super(`tree node ${number}: ${message}`);
    this.name = "TreeCaptureError";
  }
}

// ---------------------------------------------------------------- helpers

export function matchesPattern(number: string, pattern: string): boolean {
  const deep = pattern.endsWith("-**");
  const want = (deep ? pattern.slice(0, -3) : pattern).split("-");
  const have = number.split("-");
  if (deep ? have.length < want.length : have.length !== want.length) return false;
  return want.every((segment, i) => segment === "*" || segment === have[i]);
}

export function placeholderOwner(
  number: string,
  placeholders: Readonly<Record<string, string>> = PLACEHOLDER_OWNERS,
): string | undefined {
  for (const [pattern, plan] of Object.entries(placeholders)) {
    if (matchesPattern(number, pattern)) return plan;
  }
  return undefined;
}

function isBelow(number: string, root: string): boolean {
  return number.startsWith(`${root}-`);
}

function screenOf(node: TreeJsonNode): string {
  if (node.kind === "submenu") return "submenu";
  const screen = node.opens.screen;
  if (screen === undefined) throw new TreeCaptureError(node.number, "has no opens.screen");
  return screen;
}

function isList(screen: string): screen is (typeof LIST_SCREENS)[number] {
  return (LIST_SCREENS as readonly string[]).includes(screen);
}

/** Index of the entry a list opens on, or null for a list that opens unset (no highlight). */
function listOpening(node: TreeJsonNode): number | null {
  if (node.opens.no_highlight_on_entry) return null;
  const options = node.opens.options ?? [];
  const i = options.findIndex((option) => option.highlighted_on_entry);
  return i < 0 ? 0 : i;
}

function listSignature(node: TreeJsonNode): string {
  return JSON.stringify([
    screenOf(node),
    (node.opens.options ?? []).map((option) => option.label),
    listOpening(node),
    node.opens.softkey ?? null,
  ]);
}

function topSlug(number: string): string {
  const top = Number(number.split("-")[0]);
  const slug = MENU_SLUGS[top - 1];
  if (slug === undefined) throw new TreeCaptureError(number, "is not under a top-level menu 1-12");
  return slug;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------- recording equality (S4, S5)

/** Index of the first frame that differs from frame 0 (D8), or 0 when nothing changes. */
export function firstChangedFrame(frames: readonly RecordingFrame[]): number {
  const i = frames.findIndex((frame) => frame.image !== frames[0]!.image);
  return i < 0 ? 0 : i;
}

/**
 * What a recording shows after its trigger, up to the return to its starting screen: the part
 * that two leaves must share to share a golden. Frame 0 (the parent list with the entry
 * highlighted) and the return to it differ per leaf, so they are not compared; whether the
 * recording returns is.
 */
interface Response {
  readonly frames: readonly RecordingFrame[];
  readonly returns: boolean;
  /** The last compared frame was cut off by the end of the recording (a lower bound). */
  readonly open: boolean;
}

function response(frames: readonly RecordingFrame[]): Response {
  const trigger = firstChangedFrame(frames);
  if (trigger === 0) return { frames: [], returns: false, open: true };
  const rest = frames.slice(trigger);
  const back = rest.findIndex((frame) => frame.image === frames[0]!.image);
  if (back >= 0) return { frames: rest.slice(0, back), returns: true, open: false };
  return { frames: rest, returns: false, open: true };
}

export function sameResponse(a: readonly RecordingFrame[], b: readonly RecordingFrame[]): boolean {
  const ra = response(a);
  const rb = response(b);
  if (ra.returns !== rb.returns || ra.frames.length !== rb.frames.length) return false;
  return ra.frames.every((frame, i) => {
    const other = rb.frames[i]!;
    if (frame.image !== other.image) return false;
    const last = i === ra.frames.length - 1;
    if (last && ra.open) return true; // both cut off by the recording's end
    return Math.abs(frame.durationMs - other.durationMs) <= SHARE_TOLERANCE_MS;
  });
}

// ---------------------------------------------------------------- selection

interface Candidate {
  readonly number: string;
  readonly label: string;
  readonly dir: string;
  readonly frames: readonly RecordingFrame[];
  readonly status: GoldenStatus;
}

interface Group {
  readonly scenario: "leaf" | "choose";
  readonly members: Candidate[];
}

/** S1-S8 applied to `tree` in tree order. */
export function treeCaptureSet(
  tree: TreeJson,
  io: TreeCaptureIo,
  tables: TreeCaptureTables = {},
): CaptureSetEntry[] {
  const sameAs = tables.sameAs ?? SAME_AS;
  const placeholders = tables.placeholders ?? PLACEHOLDER_OWNERS;
  const assertedEarly = tables.assertedEarly ?? ASSERTED_EARLY;
  const statusOf = (number: string): GoldenStatus => {
    const plan = placeholderOwner(number, placeholders);
    return plan === undefined || number in assertedEarly ? "asserted" : `pending:${plan}`;
  };
  const entries: CaptureSetEntry[] = [];
  const groups: Group[] = [];
  const signatures = new Set<string>();

  const scroll = (node: TreeJsonNode): readonly string[] => {
    const dir = `plan14/scroll/${node.number}`;
    const images = io.scrollImages(dir);
    if (images === undefined || images.length === 0) {
      throw new TreeCaptureError(node.number, `missing capture ${dir}`);
    }
    return images;
  };

  const record = (number: string, label: string, scenario: Group["scenario"]): void => {
    const dir = `plan14/open/${number}`;
    const frames = io.recording(dir);
    if (frames === undefined || frames.length === 0) {
      throw new TreeCaptureError(number, `missing capture ${dir}`);
    }
    const candidate: Candidate = { number, label, dir, frames, status: statusOf(number) };
    const group = groups.find(
      (g) =>
        g.scenario === scenario &&
        g.members[0]!.status === candidate.status &&
        sameResponse(g.members[0]!.frames, frames),
    );
    if (group) group.members.push(candidate);
    else groups.push({ scenario, members: [candidate] });
  };

  /** A still golden from the first `count` images of a scroll; the rest are listed as omitted. */
  const scrollEntry = (
    node: TreeJsonNode,
    kind: "sub" | "options",
    scenario: GoldenScenario,
    count: number,
    note: string,
  ): void => {
    const images = scroll(node);
    if (images.length < count) {
      throw new TreeCaptureError(
        node.number,
        `plan14/scroll/${node.number} has ${plural(images.length, "image")}, expected ${count}`,
      );
    }
    const omitted: Record<string, string> = {};
    for (const name of images.slice(count)) omitted[name] = "past the wrap";
    entries.push({
      id: `tree/${topSlug(node.number)}/${node.number}.${kind}`,
      kind: "still",
      status: statusOf(node.number),
      scenario,
      covers: [node.number],
      prefer: { source: { kind: "scroll", dir: `plan14/scroll/${node.number}` }, note, omitted },
    });
  };

  const visitList = (node: TreeJsonNode, screen: (typeof LIST_SCREENS)[number]): void => {
    const options = node.opens.options ?? [];
    if (options.length === 0) throw new TreeCaptureError(node.number, `${screen} without entries`);
    const opening = listOpening(node);
    const signature = listSignature(node);
    const what = screen === "info-pages" ? "info pages" : "option list";
    if (signatures.has(signature)) {
      // S3: a list already asserted by its signature's .options golden: only its first screen.
      const first = scroll(node)[0]!;
      entries.push({
        id: `tree/${topSlug(node.number)}/${node.number}.open`,
        kind: "still",
        status: statusOf(node.number),
        scenario: "open",
        covers: [node.number],
        prefer: {
          source: { kind: "shot", file: `plan14/scroll/${node.number}/${first}.png` },
          note: `${node.label} (${node.number}): the ${what} as it opens; its entries match an earlier .options golden.`,
        },
      });
      return;
    }
    signatures.add(signature);
    // S2: every entry, ▼ from the opening state (an unset list first shows no highlight).
    const count = options.length + (opening === null ? 1 : 0);
    scrollEntry(
      node,
      "options",
      "options",
      count,
      `${node.label} (${node.number}): ${what}, ${
        opening === null
          ? "opens unset (no highlight), then"
          : `opens on ${options[opening]!.label}, then`
      } ▼ per image.`,
    );
    // S5: the entry one ▼ from the opening state, plus every entry whose result differs from its
    // siblings' (the most common result; when no result repeats, every entry differs).
    const counts = new Map<string, number>();
    for (const option of options) counts.set(option.result, (counts.get(option.result) ?? 0) + 1);
    const [mode, modeCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const common = modeCount > 1 ? mode : undefined;
    const next = opening === null ? 0 : (opening + 1) % options.length;
    options.forEach((option, i) => {
      if (i === next || option.result !== common) record(option.number, option.label, "choose");
    });
  };

  const visit = (node: TreeJsonNode, depth: number, below: string | undefined): void => {
    const screen = screenOf(node);
    if (below === undefined) {
      if (depth === 1) {
        // Level 0/1 belong to plan 13's goldens (menu/NN-<slug>, .sub, .anim).
      } else if (screen === "submenu") {
        const count = node.children?.length ?? 0;
        scrollEntry(
          node,
          "sub",
          "list",
          count,
          `${node.label} (${node.number}): ${node.opens.splash_first ? "Select, splash, " : "Select, "}then ▼ per image from the opening item.`,
        );
      } else if (isList(screen)) {
        visitList(node, screen);
      } else if (LEAF_KINDS.includes(screen)) {
        record(node.number, node.label, "leaf");
      } else {
        throw new TreeCaptureError(node.number, `unknown leaf kind "${screen}"`);
      }
    }
    const root = below ?? (node.number in sameAs ? node.number : undefined);
    for (const child of node.children ?? []) {
      visit(child, depth + 1, root !== undefined && isBelow(child.number, root) ? root : undefined);
    }
  };

  for (const top of tree.root.children) visit(top, 1, undefined);

  for (const group of groups) {
    const first = group.members[0]!;
    const covers = group.members.map((member) => member.number);
    const frames = first.frames;
    const trigger = firstChangedFrame(frames);
    const others =
      group.members.length > 1
        ? ` Shared by ${covers.join(", ")}: their recordings match after the trigger (±${SHARE_TOLERANCE_MS} ms); image a is each one's own starting screen.`
        : "";
    const early = assertedEarly[first.number];
    const cut =
      (first.status !== "asserted" || early !== undefined) && frames.length > MAX_PENDING_FRAMES;
    const last = frames.length - 1;
    entries.push({
      id: `tree/${topSlug(first.number)}/${first.number}.${group.scenario}`,
      kind: "timeline",
      status: first.status,
      scenario: group.scenario,
      covers,
      prefer: {
        source: cut
          ? { kind: "composite", parts: [{ dir: first.dir, from: 0, to: MAX_PENDING_FRAMES - 1 }] }
          : { kind: "recording", dir: first.dir },
        ...(cut
          ? {
              omitted: {
                [`${pad3(MAX_PENDING_FRAMES)}-${pad3(last)}`]:
                  early === undefined
                    ? `after the first ${MAX_PENDING_FRAMES} frames; the owner plan recaptures`
                    : `after the first ${MAX_PENDING_FRAMES} frames; plan ${early}'s game goldens assert the rest`,
              },
            }
          : {}),
        triggerFrame: trigger,
        note: `${first.label} (${first.number}) highlighted at frame 0; ${
          group.scenario === "leaf" ? "Select" : "OK"
        } ${trigger === 0 ? "changes nothing" : `redraws at frame ${trigger} (D8)`}.${others}`,
      },
    });
  }
  return entries;
}

// ---------------------------------------------------------------- probes (S7)

/** A plan 14 Task 0 probe: a still (shots) or a timeline (a `record` directory). */
interface ProbeSpec {
  readonly name: string;
  readonly dir: string;
  readonly note: string;
  /** Stills: the shot names to keep, in order (default: every NN.png in `dir`). */
  readonly shots?: readonly string[];
  /** Stills: shots left out, with the reason. */
  readonly omitted?: Readonly<Record<string, string>>;
  /**
   * Default asserted. `pending:<plan>` for a probe whose behaviour a later plan owns (plan 14
   * closeout decision 3): digits and C at standby after Invalid shortcut start a number
   * (standby number entry, plan 22); Reminders after Erase › All hides View all and Erase
   * (reminder data, plan 21).
   */
  readonly status?: GoldenStatus;
}

const PROBE_DIR = "plan14/probe";

const PROBE_STILLS: readonly ProbeSpec[] = [
  {
    name: "wrap-down",
    dir: "wrap-down",
    note: "P1: Phone book ▼×9 (Voice tags), then ▼ per image past the wrap.",
  },
  ...(["reminders", "phone-book-erase", "games", "profiles"] as const).flatMap((list) =>
    (["down", "up"] as const).map((key) => ({
      name: `wrap-small-${list}-${key}`,
      dir: `wrap-small/${list}-${key}`,
      note: `P2: the list as it opens, then ${key === "down" ? "▼" : "▲"} per image through the wrap.`,
    })),
  ),
  {
    name: "return-top-row",
    dir: "return/top-row",
    note: "P3: Phone book ▼×5 ▲×2 (Erase on the top row), Select, C.",
  },
  {
    name: "return-bottom-row",
    dir: "return/bottom-row",
    note: "P3: Phone book ▼×3 (Erase on the bottom row), Select, C.",
  },
  {
    name: "return-wrapped",
    dir: "return/wrapped",
    note: "P3: Phone book ▲ (Voice tags on top), Select, C.",
  },
  {
    name: "reenter",
    dir: "reenter",
    note: "P4: Phone book ▼×5, C, Select: the window is rebuilt.",
  },
  {
    name: "unset-down",
    dir: "unset/down",
    note: "P10: Ringing volume opens unset, then ▼ per image.",
  },
  { name: "unset-up", dir: "unset/up", note: "P10: Ringing volume opens unset, then ▲ per image." },
  {
    name: "unset-reopen",
    dir: "unset/reopen",
    note: "P10: after ▼×6, C (the page) and Select: still unset.",
  },
  {
    name: "profile-share",
    dir: "profile-share",
    note: "P11: Tones › Ringing volume → Level 3; General's page and list show it, Silent's do not.",
    shots: [
      "01-level-3",
      "02-tones-page",
      "general-page",
      "general-list",
      "silent-page",
      "silent-list",
      "tones-page",
      "tones-list",
    ],
  },
  ...(
    [
      ["8-1-6", 5],
      ["8-2-4", 5],
      ["8-3-3", 5],
      ["8-4-1-5", 5],
      ["8-4-2-5", 4],
    ] as const
  ).map(([number, keep]) => ({
    name: `games-instructions-${number}`,
    dir: `games/instructions-${number}`,
    note: `P12: Instructions (${number}), More per image: the pages cycle back to the first.`,
    omitted: Object.fromEntries(
      Array.from({ length: 12 - keep }, (_, i) => [
        String(keep + i + 1).padStart(2, "0"),
        "the pages repeat",
      ]),
    ),
  })),
  {
    name: "set-delay",
    dir: "set-delay",
    note: "P13: Set delay opens unset (7-3-0), ▼ to 5 seconds.",
  },
  {
    name: "multiselect",
    dir: "multiselect",
    note: "P14: Language as it opens; after Unmark, ▼, Mark and C: Save changes?",
    shots: ["00", "after-c"],
  },
  {
    name: "prepaid-credit-info-display",
    dir: "prepaid/credit-info-display",
    note: "P15: Prepaid credit page 1, Select (On/Off list on Off), then ▼ per image.",
  },
  {
    name: "prepaid-recharge-status",
    dir: "prepaid/recharge-status",
    note: "P15: Prepaid credit page 4, Select (info pages), then ▼ per image.",
  },
];

const PROBE_TIMELINES: readonly ProbeSpec[] = [
  {
    name: "return-note",
    dir: "return/note/rec",
    note: "P3: Phone book ▼×4, Select on Edit: the note returns to the same window.",
  },
  ...(
    [
      ["m1", "Menu 1: waits for a second digit, then opens Phone book."],
      ["m1-8", "Menu 1 8: Invalid shortcut, then standby."],
      [
        "m1-8-1",
        "Menu 1 8 1: Invalid shortcut, then the digit starts a number at standby.",
        "pending:22",
      ],
      ["m1-8-1-2", "Menu 1 8 1 2: Invalid shortcut, then the number 12.", "pending:22"],
      ["m1-1-0", "Menu 1 1 0: Clock (11), then 11-0 and Invalid shortcut when the window ends."],
      ["m1-2", "Menu 1 2: Profiles (12) opens after the delay, then 12- and dots."],
      ["m8-1", "Menu 8 1: the Snake II splash, the Games list at 8-1, then the game menu."],
      ["m8-1-2", "Menu 8 1 2: the 2 skips the splash; the game menu ends on New game."],
      ["m8-6", "Menu 8 6: Games list at 8-6 without the soft key, then Settings opens."],
      ["m8-6-3", "Menu 8 6 3: the Shakes page, then its option list opens."],
      [
        "m1-wait-9",
        "Menu 1, wait (Phone book opens), 9: Speed dials on the top row, then its prompt.",
      ],
      ["m1-9-c/rec", "Menu 1 9: Invalid shortcut, then C at standby.", "pending:22"],
    ] as readonly (readonly [string, string, GoldenStatus?])[]
  ).map(([dir, note, status]) => ({
    name: `shortcut-${dir.replace("/rec", "")}`,
    dir: `shortcut/${dir}`,
    note: `P5: ${note}`,
    ...(status === undefined ? {} : { status }),
  })),
  {
    name: "note-keys-done-down-300",
    dir: "note-keys/done-down-300",
    note: "P6: Name list OK, ▼ 300 ms into Done.",
  },
  {
    name: "note-keys-service-nos-c-500",
    dir: "note-keys/service-nos-c-500",
    note: "P6: Service Nos. Select, C 500 ms into the note.",
  },
  {
    name: "progress-7-6-quit",
    dir: "progress/7-6-quit",
    note: "P7: Cancel all diverts: Requesting for 10 s, then Quit.",
  },
  {
    name: "progress-6-2-4-2-c",
    dir: "progress/6-2-4-2-c",
    note: "P7: Network selection › Manual: Searching for 10 s, then C.",
  },
  {
    name: "confirm-5-2-5-c",
    dir: "confirm/5-2-5-c/rec",
    note: "P8: Ringing volume › Level 5 OK, then C on the query.",
  },
  {
    name: "confirm-5-2-5-ok",
    dir: "confirm/5-2-5-ok/rec",
    note: "P8: Ringing volume › Level 5 OK, then OK on the query.",
  },
  {
    name: "confirm-8-6-4-c",
    dir: "confirm/8-6-4-c",
    note: "P8: Club Nokia ID Select, then C on the query.",
  },
  {
    name: "confirm-8-6-4-ok",
    dir: "confirm/8-6-4-ok",
    note: "P8: Club Nokia ID Select, then OK on the query.",
  },
  {
    name: "confirm-10-3-2-yes",
    dir: "confirm/10-3-2-yes",
    note: "P8: Reminders › Erase › All OK, then Yes.",
    status: "pending:21",
  },
  ...(["1-1", "1-9", "6-4", "11-5"] as const).map((number) => ({
    name: `prompts-${number}`,
    dir: `prompts/${number}`,
    note: `P9: ${number} Select, 5 s, then C.`,
  })),
  { name: "unset-quit", dir: "unset/quit", note: "P10: Quit while Ringing volume is unset." },
  ...(["8-1", "8-2", "8-3", "8-4"] as const).map((number) => ({
    name: `games-splash-${number}`,
    dir: `games/splash-${number}`,
    note: `P12: Select on ${number}: the splash, then the game menu.`,
  })),
  ...(["down", "c", "menu"] as const).map((key) => ({
    name: `games-splash-skip-${key}`,
    dir: `games/splash-skip-${key}`,
    note: `P12: Select on Snake II, ${key === "down" ? "▼" : key === "c" ? "C" : "Navi"} 300 ms into the splash.`,
  })),
  { name: "games-level-keys", dir: "games/level-keys", note: "P12: Level Select, ▲, ▼, OK." },
  { name: "games-level-c", dir: "games/level-c", note: "P12: Level Select, C." },
  {
    name: "games-top-score-wait",
    dir: "games/top-score-wait",
    note: "P12: Top score Select, no key for 9 s.",
  },
  {
    name: "games-top-score-c-2s",
    dir: "games/top-score-c-2s",
    note: "P12: Top score Select, C at 2 s.",
  },
  {
    name: "games-top-score-down-2s",
    dir: "games/top-score-down-2s",
    note: "P12: Top score Select, ▼ at 2 s.",
  },
  {
    name: "games-instructions-c",
    dir: "games/instructions-c",
    note: "P12: Instructions Select, More, C.",
  },
  {
    name: "set-delay.rec",
    dir: "set-delay/rec",
    note: "P13: OK on 5 seconds: straight back to the Call divert page.",
  },
  {
    name: "multiselect.rec",
    dir: "multiselect/rec",
    note: "P14: Language: Unmark on All, ▼, Mark on Suomi, C.",
  },
];

/** S7: every probe golden (hand-written scenarios, plan 14 Task 13), asserted unless pending. */
export function probeCaptureSet(io: TreeCaptureIo): CaptureSetEntry[] {
  const entries: CaptureSetEntry[] = [];
  for (const probe of PROBE_STILLS) {
    const dir = `${PROBE_DIR}/${probe.dir}`;
    const names = probe.shots ?? io.scrollImages(dir);
    if (names === undefined || names.length === 0)
      throw new Error(`probe/${probe.name}: missing capture ${dir}`);
    entries.push({
      id: `probe/${probe.name}`,
      kind: "still",
      status: probe.status ?? "asserted",
      prefer: {
        source: probe.shots
          ? { kind: "shots", files: probe.shots.map((shot) => `${dir}/${shot}.png`) }
          : { kind: "scroll", dir },
        note: probe.note,
        ...(probe.omitted ? { omitted: probe.omitted } : {}),
      },
    });
  }
  for (const probe of PROBE_TIMELINES) {
    const dir = `${PROBE_DIR}/${probe.dir}`;
    const frames = io.recording(dir);
    if (frames === undefined || frames.length === 0)
      throw new Error(`probe/${probe.name}: missing capture ${dir}`);
    entries.push({
      id: `probe/${probe.name}`,
      kind: "timeline",
      status: probe.status ?? "asserted",
      prefer: {
        source: { kind: "recording", dir },
        triggerFrame: firstChangedFrame(frames),
        note: probe.note,
      },
    });
  }
  return entries;
}
