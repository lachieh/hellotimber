// The capture-set vocabulary: which REF captures become which golden fixtures. Each plan lists
// its own in `scripts/capture-sets/<NN>-<slug>.ts` (a `PlanCaptureSet`), registered in
// `scripts/capture-sets/index.ts`; the importer executes them and nothing else decides what is
// imported. Paths are relative to `$REF/captures/6.39`.
// See docs/plans/13-nokia-os-foundation.md "Capture set" and "Ground truth and artefacts".
import type { GameCaptureIo, TickFixtureSpec } from "./game-capture-set.ts";
import type {
  GoldenKeyPress,
  GoldenScenario,
  GoldenStatus,
  TriggerFrame,
} from "./golden-format.ts";
import type { SoundCaptureIo } from "./sound-capture-set.ts";
import type { SoundGolden } from "./sound-format.ts";
import type { TreeCaptureIo, TreeJson } from "./tree-capture-set.ts";

/** Frames `from`..`to` (inclusive, 0-based) of one `record` directory. */
export interface FrameRange {
  readonly dir: string;
  readonly from: number;
  readonly to: number;
}

export type CaptureSource =
  /** One `shot` PNG. */
  | { readonly kind: "shot"; readonly file: string }
  /** A whole `record` directory (NNN.png + timings.csv). */
  | { readonly kind: "recording"; readonly dir: string }
  /** Frame ranges of several recordings, concatenated into one timeline. */
  | { readonly kind: "composite"; readonly parts: readonly FrameRange[] }
  /** A `scroll` directory (01.png, 02.png, …), one still per screen. */
  | { readonly kind: "scroll"; readonly dir: string }
  /** Named `shot` PNGs, one still each, named after the file stem. */
  | { readonly kind: "shots"; readonly files: readonly string[] }
  /** Single frames of `record` directories as named stills (plan 23 tick stills). */
  | {
      readonly kind: "frames";
      readonly frames: readonly {
        readonly name: string;
        readonly dir: string;
        readonly frame: number;
      }[];
    };

export interface SourceChoice {
  readonly source: CaptureSource;
  readonly triggerFrame?: TriggerFrame;
  readonly note?: string;
  /** Source frames left out on purpose, by name, with the reason. */
  readonly omitted?: Readonly<Record<string, string>>;
}

export interface CaptureSetEntry {
  readonly id: string;
  readonly kind: "still" | "timeline";
  readonly status: GoldenStatus;
  readonly prefer: SourceChoice;
  /** Used, and reported, when `prefer`'s files are absent. */
  readonly fallback?: SourceChoice;
  /** Optional rows are skipped silently when no source exists (Task 0 probes). */
  readonly optional?: boolean;
  /** Generated tree goldens (plan 14 D7): the generic scenario and the tree nodes covered. */
  readonly scenario?: GoldenScenario;
  readonly covers?: readonly string[];
  /** Game goldens (plan 23): the keys pressed, by engine tick. */
  readonly input?: readonly GoldenKeyPress[];
}

export const MENU_SLUGS = [
  "01-phone-book",
  "02-messages",
  "03-chat",
  "04-call-register",
  "05-tones",
  "06-settings",
  "07-call-divert",
  "08-games",
  "09-calculator",
  "10-reminders",
  "11-clock",
  "12-profiles",
] as const;

/** What a capture set reads: the crawled tree and the captures, through the importer. */
export interface CaptureIo {
  /** `tree.json`, the plan 14 menu-tree crawl. */
  readonly tree: TreeJson;
  /** Recordings by pixel content and scroll names (tree selection, probes). */
  readonly frames: TreeCaptureIo;
  /** Recordings with pixels and keys (game goldens). */
  readonly game: GameCaptureIo;
  /** Sound events and keys (sound goldens). */
  readonly sound: SoundCaptureIo;
}

/**
 * One plan's goldens (`scripts/capture-sets/<NN>-<slug>.ts`). The importer writes what it lists
 * and indexes it in `goldens/index/<plan>.json`, so imports in parallel worktrees touch disjoint
 * index files.
 */
export interface PlanCaptureSet {
  /** The plan number, as the file name starts (`13`, `18b`). */
  readonly plan: string;
  /** LCD goldens: stills and timelines. */
  readonly lcd?: (io: CaptureIo) => readonly CaptureSetEntry[];
  /** Tick fixtures (`<id>.ticks.txt`). */
  readonly ticks?: (io: CaptureIo) => readonly TickFixtureSpec[];
  /** Sound goldens (`<id>.sound.txt`). */
  readonly sounds?: (io: CaptureIo) => readonly SoundGolden[];
  /** Captures and artefacts deliberately not imported, with the reason (printed by the importer). */
  readonly notImported?: Readonly<Record<string, string>>;
}
