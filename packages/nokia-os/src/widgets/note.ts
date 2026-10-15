import type { PhoneKey } from "@hellotimber/phone-core";
import type { NoteModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

/** Where a note goes when it ends or is dismissed. */
export type NoteEnd =
  /** Back to the screen below (default). */
  | "back"
  /** Straight to standby (Restore… `Done`, Request not confirmed). */
  | "standby"
  /**
   * Back past `levels` levels (default 1: Info service's notes return to the Messages page, 2),
   * selecting the child `select` in the level returned to, on the window's bottom row or, with
   * `row: "top"`, on its top row (Top score: `new-game`, on the bottom row in Snake II).
   */
  | { readonly levels?: number; readonly select?: string; readonly row?: "top" | "bottom" };

export interface NoteOptions {
  /** Firmware lines, drawn in the large face. */
  readonly lines: readonly string[];
  /** The note's generated timeline; absent = a static note that stays until a key. */
  readonly timeline?: StockWidgetTimeline;
  readonly end?: NoteEnd;
  /**
   * The siblings ▲/▼ select after dismissing the note, by slug, in the level the flow returns
   * to (P6: ▼ during `Done` dismisses it and moves). Without them ▲/▼ only dismiss.
   */
  readonly moves?: { readonly up?: string; readonly down?: string };
  /**
   * Plan 16 (D12): the note's warning tone, by its lines, played when the note opens and again
   * when a key goes down on it (in place of the key's beep).
   */
  readonly sound?: NoteSound;
  /**
   * Plan 17 (B6): a note shown at standby (Activate's): the power key's down leaves for standby,
   * where the kernel opens the power key's list.
   */
  readonly powerLeaves?: boolean;
}

/** Plays a note's warning tone by its lines (the phone's sounder decides whether it has one). */
export type NoteSound = (lines: readonly string[]) => void;

/**
 * A timed note (`Done`, `No phone numbers`, `Not allowed`, Top score) or, without a timeline, a
 * static note. It plays its timeline and then ends; a key ends it at once (P6: C stays on the
 * list, ▼ also moves; P12: Top score returns on a key).
 */
class NoteWidget implements Widget {
  readonly #options: NoteOptions;
  readonly #playback: Playback | undefined;

  constructor(options: NoteOptions) {
    this.#options = options;
    this.#playback = options.timeline === undefined ? undefined : new Playback(options.timeline);
    options.sound?.(options.lines);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    this.#options.sound?.(this.#options.lines);
    if (key === "power" && this.#options.powerLeaves) flow.standby();
  }

  render(): NoteModel {
    const { lines } = this.#options;
    const playback = this.#playback;
    if (playback === undefined) return { kind: "note", lines };
    const { frame, nextFrame } = playback;
    return {
      kind: "note",
      lines,
      frame,
      ...(frame.kind === "cut" && nextFrame !== undefined ? { next: nextFrame } : {}),
    };
  }

  tick(dtMs: number, flow: Flow): void {
    const playback = this.#playback;
    if (playback === undefined) return;
    playback.advance(dtMs);
    if (playback.ended) this.#end(flow);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const move = key === "up" || key === "down" ? this.#options.moves?.[key] : undefined;
    if (move !== undefined) flow.back(1, { select: move });
    else this.#end(flow);
  }

  #end(flow: Flow): void {
    const end = this.#options.end ?? "back";
    if (end === "back") flow.back();
    else if (end === "standby") flow.standby();
    else {
      const { select, row } = end;
      flow.back(end.levels ?? 1, select === undefined ? {} : { select, ...(row ? { row } : {}) });
    }
  }
}

export function note(options: NoteOptions): Widget {
  return new NoteWidget(options);
}
