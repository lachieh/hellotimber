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
   * selecting the child `select` in the level returned to (Top score: `new-game`).
   */
  | { readonly levels?: number; readonly select?: string };

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
}

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
    else flow.back(end.levels ?? 1, end.select === undefined ? {} : { select: end.select });
  }
}

export function note(options: NoteOptions): Widget {
  return new NoteWidget(options);
}
