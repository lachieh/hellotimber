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
 * also matches everything below. Grouped by owner plan, so the plan that implements its leaves
 * deletes only its own group; equal to the firmware features' placeholders (coverage guard).
 */
export const PLACEHOLDER_OWNERS: Readonly<Record<string, string>> = {
  // Plan 17: Profiles.
  "12-*-1": "17", // Profiles › Activate

  // Plan 18: Messages I (Write messages and Welcome note until plan 18 Tasks 8 and 10 bind them).
  "2-1": "18", // Write messages: text editor
  "6-2-3": "18", // Welcome note: text editor (plan 15 D12; plan 15 owns the stored note)

  // Plan 18c: Chat and content (plan 18 D1).
  "2-4": "18c", // Picture messages: nothing in the virgin EEPROM
  "2-5": "18c", // Templates
  "2-6": "18c", // Smileys
  "2-8-4-1-**": "18c", // Topics: lists of box-glyph names (virgin EEPROM)
  "2-8-4-2-**": "18c",
  "2-8-4-3-**": "18c",
  "2-10": "18c", // Service command editor
  "3": "18c", // Chat
  "5-9-4": "18c", // Screen saver › Screen saver: nothing in the virgin EEPROM
  "12-*-2-9-4": "18c",

  // Plan 21: Clock and Reminders.
  "11-4": "21", // Stopwatch

  // Plan 24: Games II.
  "8-2-1": "24", // Space impact › New game
  "8-3-1": "24", // Bantumi › New game
  "8-4-1-1": "24", // Pairs II › Time trial › New game
  "8-4-2-1": "24", // Pairs II › Puzzle › New game

  // Plan 26: Languages.
  "6-2-1-3": "26", // Русский: native-language note, then that UI (plan 15 D12)
  "6-2-1-4": "26", // Български
  "6-2-1-5": "26", // Українська

  // Plan 27: Composer.
  "5-4-*": "27", // Composer slots (plan 16 D14)
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

/** A Task 0 probe: a still (shots) or a timeline (a `record` directory). */
export interface ProbeSpec {
  readonly name: string;
  /** Relative to the probe set's `base`. */
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

/** One plan's probes: their directory under `$REF/captures/6.39`, stills and timelines. */
export interface ProbeSet {
  readonly base: string;
  readonly stills: readonly ProbeSpec[];
  readonly timelines: readonly ProbeSpec[];
}

/** S7: probe goldens (hand-written scenarios, plan 14 Task 13), asserted unless pending. */
export function probeCaptureSet(io: TreeCaptureIo, probes: ProbeSet): CaptureSetEntry[] {
  const entries: CaptureSetEntry[] = [];
  for (const probe of probes.stills) {
    const dir = `${probes.base}/${probe.dir}`;
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
  for (const probe of probes.timelines) {
    const dir = `${probes.base}/${probe.dir}`;
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
