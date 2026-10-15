// The stock Composer (plan 27 D1, D5, D6, Task 0): a slot's editor over the pure engine, its
// Options (Play, Save, Tempo, Send, Clear screen, Exit), the Tempo list and its notes. Every key
// acts as it goes down; the editor's own keys beep nothing (they silence their beep through the
// sounder's `silent-key` cue), the lists' keys beep as other lists do.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { ComposerModel, PromptModel } from "../display/widgets";
import {
  composerHeld,
  composerKeyDown,
  EMPTY_COMPOSER,
  isNoteKey,
  type ComposerState,
} from "../composer/editor";
import { composerLines } from "../composer/layout";
import { COMPOSER_LIMIT, type ComposerToken } from "../composer/notation";
import { notePreview, toneMs, toneProgram } from "../composer/program";
import { COMPOSER_NAME_LIMIT, type StockComposer } from "../composer/store";
import type { StockSettings } from "../firmware/settings";
import {
  COMPOSER_TEMPI,
  COMPOSER_TIMINGS,
  TEXT_TIMINGS,
  type StockWidgetTimeline,
} from "../resources";
import type { SoundPlay } from "../sound/sequencer";
import type { StockSounder } from "../sound/sounder";
import type { Flow, Widget } from "./flow";
import { note } from "./note";
import { numberEntry } from "./number-entry";
import { textInput } from "./text-input";
import { OptionListWidget } from "./option-list";

/** Options (Task 0 O), in list order. */
export const COMPOSER_OPTIONS = ["Play", "Save", "Tempo", "Send", "Clear screen", "Exit"] as const;
const PLAY = 0;
const SAVE = 1;
const TEMPO = 2;
const SEND = 3;
const CLEAR = 4;
const EXIT = 5;

/**
 * C held during Play: Play stops at its down; still down this long after, the phone goes to
 * standby (`play/c-held`: 533 ms after the key-down).
 */
export const PLAY_C_HELD_STANDBY_MS = 533;

/**
 * C held on an empty `Tone name:`: Options show at its down; still down this long after, the
 * phone goes to standby (`save/c-held-empty`: Options 66 ms, standby 548 ms into the recording).
 */
export const NAME_C_HELD_STANDBY_MS = 482;

/** The editor leaves two levels up, to the Tones page (K2, K7: as plan 14's `EXIT_LEVELS`). */
const EDITOR_LEVELS = 2;

/** Tones › Ringing volume and Incoming call alert (the active profile's, through the alias). */
const RINGING_VOLUME_KEY = "tones/ringing-volume";
const ALERT_KEY = "tones/incoming-call-alert";
const ASCENDING = 1;

/**
 * The cursor's blink (Task 0): it runs free while an editor shows, starting shown the first time
 * an editor shows after power-on and hidden every later time (a reopened slot, the return from
 * Options), its first step shorter.
 */
export interface ComposerBlink {
  shown: boolean;
  /** An editor has shown since power-on. */
  used: boolean;
}

export interface ComposerServices {
  readonly composer: StockComposer;
  /** The kernel's time (a silenced key is silenced at its down). */
  readonly now: () => number;
  readonly sounder: StockSounder;
  readonly settings: StockSettings;
  readonly blink: ComposerBlink;
  readonly timelines: { readonly saved: StockWidgetTimeline; readonly done: StockWidgetTimeline };
  /** What Options › Save and Send open (plan 27 Task 9); absent: the editor's placeholders. */
  readonly save?: (editor: ComposerEditor, flow: Flow) => void;
  readonly send?: (editor: ComposerEditor, flow: Flow) => void;
}

/** A widget acting as each key goes down (its release-time action runs then) and never again. */
export function onKeyDown(widget: Widget): Widget {
  return {
    render: (flow) => widget.render(flow),
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
    onKeyDown(key, flow) {
      widget.onKeyDown?.(key, flow);
      widget.onKey?.(key, flow);
    },
  };
}

/**
 * A widget pushed by a key-down (Options act as their key goes down): the key's release, and any
 * other key's that went down before it showed, are not its own.
 */
export function ownKeys(widget: Widget): Widget {
  const down = new Set<PhoneKey>();
  return {
    render: (flow) => widget.render(flow),
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
    onKeyDown(key, flow) {
      down.add(key);
      widget.onKeyDown?.(key, flow);
    },
    onKey(key, flow) {
      if (!down.delete(key)) return;
      widget.onKey?.(key, flow);
    },
  };
}

/** `flow`'s methods, bound (to override one). */
function flowMethods(flow: Flow): Flow {
  return {
    push: (widget) => flow.push(widget),
    replace: (widget) => flow.replace(widget),
    back: (levels, options) => flow.back(levels, options),
    standby: () => flow.standby(),
    indicator: () => flow.indicator(),
  };
}

/** A placeholder inside the Composer's flow: C goes back. */
function placeholder(label: string): Widget {
  return onKeyDown({
    render: () => ({ kind: "placeholder", label }),
    onKey(key, flow) {
      if (key === "c") flow.back();
    },
  });
}

/** A held key: when it went down (the editor's clock), and what its hold does. */
interface Held {
  /** `key`: the editor's own hold; `rollover`: C over a held note key; `play-c`: C that stopped Play. */
  readonly kind: "key" | "rollover" | "play-c";
  readonly downAt: number;
  /** A note key that inserted its note (only those dot). */
  readonly inserted: boolean;
  done: boolean;
  /** ▲/▼'s next repeat. */
  nextRepeat?: number;
}

/** One slot's editor (5-4-k): the tone, its cursor and view, Play, and the keys' holds. */
export class ComposerEditor implements Widget {
  readonly #services: ComposerServices;
  readonly slot: number;
  #state: ComposerState;
  tempo: number;
  #top = 0;
  /** The editor's clock (ms of its ticks). */
  #now = 0;
  /** Since the blink last toggled; a restart starts it into its first, shorter step (Task 0). */
  #blinkMs = COMPOSER_TIMINGS.blinkStepMs - COMPOSER_TIMINGS.blinkFirstMs;
  /** Covered by Options or a list: the next tick restarts the blink and puts the cursor at the end. */
  #covered = false;
  #showsSaved = false;
  #penLeft = false;
  /** When C on an empty `Tone name:` went back to Options (its hold goes to standby). */
  #backOnC: number | undefined;
  readonly #held = new Map<PhoneKey, Held>();
  #play: { readonly sound: SoundPlay; readonly endsAt: number } | undefined;

  constructor(services: ComposerServices, slot: number) {
    this.#services = services;
    this.slot = slot;
    const saved = services.composer.slot(slot);
    this.#state =
      saved === null ? EMPTY_COMPOSER : { tokens: saved.tokens, cursor: saved.tokens.length };
    this.tempo = saved?.tempo ?? services.composer.newTempo();
    this.#top = composerLines(this.#state.tokens, this.#state.cursor).top;
    if (services.blink.used) services.blink.shown = false;
    services.blink.used = true;
  }

  /** The tokens being edited. */
  get tokens(): readonly ComposerToken[] {
    return this.#state.tokens;
  }

  render(): ComposerModel {
    const layout = composerLines(this.#state.tokens, this.#state.cursor, this.#top);
    const playing = this.#play !== undefined;
    return {
      kind: "composer",
      lines: layout.lines.slice(layout.top, layout.top + 3),
      cursor: this.#services.blink.shown
        ? { line: layout.cursorAt.line - layout.top, x: layout.cursorAt.x }
        : null,
      counter: String(COMPOSER_LIMIT - this.#state.tokens.length),
      softkey: playing ? "Stop" : this.#state.tokens.length === 0 ? "Back" : "Options",
      ...(this.#penLeft ? { icon: "prompt/pen" } : {}),
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    // D5: no key on the editor beeps (during Play too).
    this.#services.sounder.cue({ kind: "silent-key" }, this.#services.now());
    if (this.#play !== undefined) {
      this.#keyDuringPlay(key);
      return;
    }
    const heldNote = [...this.#held.entries()].find(([k, h]) => isNoteKey(k) && h.inserted);
    if (key === "c" && heldNote !== undefined) {
      // Key rollover (Task 0 H): C while a note key is held enters the held note again.
      this.#held.set("c", { kind: "rollover", downAt: this.#now, inserted: false, done: true });
      this.#noteAgain(heldNote[0]);
      return;
    }
    if (key === "navi") {
      if (this.#state.tokens.length === 0) flow.back(EDITOR_LEVELS);
      else this.#options(flow);
      return;
    }
    if (key === "c" && this.#state.tokens.length === 0) {
      flow.back(EDITOR_LEVELS);
      return;
    }
    const before = this.#state.tokens.length;
    this.#edit(key);
    const inserted = this.#state.tokens.length > before;
    this.#held.set(key, this.#newHold(key, inserted));
  }

  #newHold(key: PhoneKey, inserted: boolean): Held {
    return {
      kind: "key",
      downAt: this.#now,
      inserted,
      done: false,
      ...(key === "up" || key === "down" ? { nextRepeat: COMPOSER_TIMINGS.repeatFirstMs } : {}),
    };
  }

  onKey(key: PhoneKey): void {
    const held = this.#held.get(key);
    this.#held.delete(key);
    if (held?.kind === "rollover") {
      // the rollover C's release enters the held note once more
      const heldNote = [...this.#held.entries()].find(([k, h]) => isNoteKey(k) && h.inserted);
      if (heldNote !== undefined) this.#noteAgain(heldNote[0]);
    }
  }

  tick(dtMs: number, flow: Flow): void {
    this.#now += dtMs;
    if (this.#covered) {
      this.#covered = false;
      this.#services.blink.shown = this.#showsSaved;
      this.#showsSaved = false;
      this.#blinkMs = COMPOSER_TIMINGS.blinkStepMs - COMPOSER_TIMINGS.blinkFirstMs;
      this.#toEnd();
    } else {
      this.#blinkMs += dtMs;
      while (this.#blinkMs >= COMPOSER_TIMINGS.blinkStepMs) {
        this.#blinkMs -= COMPOSER_TIMINGS.blinkStepMs;
        this.#services.blink.shown = !this.#services.blink.shown;
      }
    }
    if (this.#play !== undefined && this.#services.now() >= this.#play.endsAt) {
      this.#play = undefined;
    }
    for (const [key, held] of this.#held) this.#hold(key, held, flow);
  }

  close(): void {
    this.#stopPlay();
  }

  /** Clear screen (Options): every token goes at once. */
  clear(): void {
    this.#state = EMPTY_COMPOSER;
    this.#top = 0;
  }

  /** Options › Tempo: the tone's tempo, and every new tone's (Task 0 `newtempo`). */
  setTempo(tempo: number): void {
    this.tempo = tempo;
    this.#services.composer.setNewTempo(tempo);
  }

  /** Options › Play: the tone once at the Ringing volume (D4, D6), soft key `Stop`. */
  play(): void {
    const level = this.#level();
    const ascending = this.#services.settings.choice(ALERT_KEY) === ASCENDING;
    const tone = { tempo: this.tempo, tokens: this.#state.tokens };
    const sound = this.#services.sounder.play(toneProgram(tone, level, { ascending }));
    this.#play = { sound, endsAt: this.#services.now() + toneMs(tone) };
  }

  /** A widget pushed over the editor (Options): the blink restarts, hidden, when it shows again. */
  /**
   * Save wrote the tone: the editor shows again with its cursor shown first (Task 0
   * `save/after-c`, `returns/save`), where every other return starts it hidden.
   */
  savedTone(): void {
    this.#showsSaved = true;
  }

  /**
   * C on Send's empty `Phone number:`: the editor shows again with the prompt's pen left in its
   * header (Task 0 `send/keys/number-c`), until a widget covers it again (not captured further).
   */
  backOnC(): void {
    this.#backOnC = this.#services.now();
  }

  penLeft(): void {
    this.#penLeft = true;
  }

  cover(widget: Widget, flow: Flow): void {
    this.#covered = true;
    this.#penLeft = false;
    flow.push(widget);
  }

  #level(): number | null {
    const index = this.#services.settings.choice(RINGING_VOLUME_KEY);
    return index === null ? null : index + 1;
  }

  #toEnd(): void {
    this.#state = { tokens: this.#state.tokens, cursor: this.#state.tokens.length };
    this.#top = composerLines(this.#state.tokens, this.#state.cursor, this.#top).top;
  }

  /** A key through the engine; a changed or added note sounds (K8), replacing the one before. */
  #edit(key: PhoneKey, stopPlay = true): void {
    this.#apply(composerKeyDown(this.#state, key), stopPlay);
  }

  #apply(edit: { state: ComposerState; sound?: ComposerToken }, stopPlay = true): void {
    this.#state = edit.state;
    this.#top = composerLines(this.#state.tokens, this.#state.cursor, this.#top).top;
    if (edit.sound === undefined) return;
    const program = notePreview(edit.sound, this.tempo, this.#level());
    if (program === undefined) return;
    if (stopPlay) this.#stopPlay();
    this.#services.sounder.play(program);
  }

  #noteAgain(key: PhoneKey): void {
    const before = this.#state.tokens.length;
    this.#edit(key);
    this.#held.set(key, this.#newHold(key, this.#state.tokens.length > before));
  }

  #hold(key: PhoneKey, held: Held, flow: Flow): void {
    const heldMs = this.#now - held.downAt;
    if (held.kind === "play-c") {
      if (!held.done && heldMs >= PLAY_C_HELD_STANDBY_MS) {
        held.done = true;
        flow.standby();
      }
      return;
    }
    if (held.kind === "rollover") return;
    if (key === "up" || key === "down") {
      while (held.nextRepeat !== undefined && heldMs >= held.nextRepeat) {
        this.#edit(key);
        held.nextRepeat += COMPOSER_TIMINGS.repeatEveryMs;
      }
      return;
    }
    if (held.done) return;
    if (key === "c" && heldMs >= COMPOSER_TIMINGS.clearMs) {
      held.done = true;
      this.#apply(composerHeld(this.#state, "c"));
    } else if (isNoteKey(key) && held.inserted && heldMs >= COMPOSER_TIMINGS.dotMs) {
      held.done = true;
      this.#apply(composerHeld(this.#state, key));
    }
  }

  /**
   * Keys during Play (Task 0 P): C and Stop end it at once (C deletes nothing; held, it then goes
   * to standby); ▲/▼ and 0 act and leave it playing; note keys, 8, 9, `*` and `#` act and their
   * note replaces it. Any key turns the soft key back to `Options`.
   */
  #keyDuringPlay(key: PhoneKey): void {
    const play = this.#play!;
    this.#play = undefined;
    if (key === "c" || key === "navi") {
      this.#services.sounder.cancel(play.sound);
      if (key === "c") {
        this.#held.set("c", { kind: "play-c", downAt: this.#now, inserted: false, done: false });
      }
      return;
    }
    // ▲/▼ and a rest leave the tone playing on in the sequencer (the soft key is Options
    // again); a note key's sound replaces it there.
    const before = this.#state.tokens.length;
    this.#edit(key, false);
    this.#held.set(key, this.#newHold(key, this.#state.tokens.length > before));
  }

  #stopPlay(): void {
    if (this.#play !== undefined) this.#services.sounder.cancel(this.#play.sound);
    this.#play = undefined;
  }

  #options(flow: Flow): void {
    const services = this.#services;
    const list = new OptionListWidget({
      labels: COMPOSER_OPTIONS,
      opening: PLAY,
      softkey: "OK",
      numbering: "option",
      choose: (index, inner) => {
        switch (index) {
          case PLAY:
            // Task 0 (`play/*`): the OK that starts Play beeps nothing; the tone is its sound.
            services.sounder.cue({ kind: "silent-key" }, services.now());
            inner.back();
            this.play();
            return;
          case SAVE:
            if (services.save) services.save(this, inner);
            else inner.push(placeholder("Save"));
            return;
          case TEMPO:
            inner.push(onKeyDown(this.#tempoList()));
            return;
          case SEND:
            if (services.send) services.send(this, inner);
            else inner.push(placeholder("Send"));
            return;
          case CLEAR:
            this.clear();
            inner.back();
            return;
          case EXIT:
            inner.back(EDITOR_LEVELS + 1);
            return;
        }
      },
    });
    // C held on an empty `Tone name:` goes to standby from Options (Task 0 `save/c-held-empty`).
    const options: Widget = {
      render: (f) => list.render(f),
      close: () => list.close?.(),
      tick: (_dtMs, f) => {
        const at = this.#backOnC;
        if (at !== undefined && this.#services.now() - at >= NAME_C_HELD_STANDBY_MS) {
          this.#backOnC = undefined;
          f.standby();
        }
      },
      onKeyDown: (key, f) => {
        this.#backOnC = undefined;
        list.onKeyDown(key);
        list.onKey(key, f);
      },
      onKey: (key) => {
        if (key === "c") this.#backOnC = undefined;
      },
    };
    this.cover(options, flow);
  }

  /** Options › Tempo: 16 tempi, opening on the tone's, no indicator, `Select` (Task 0 O). */
  #tempoList(): Widget {
    const done = this.#services.timelines.done;
    return new OptionListWidget({
      labels: COMPOSER_TEMPI.map((bpm) => `${bpm} BPM`),
      opening: COMPOSER_TEMPI.indexOf(this.tempo),
      softkey: "Select",
      numbering: "none",
      choose: (index, flow) => {
        this.setTempo(COMPOSER_TEMPI[index]!);
        flow.replace(note({ lines: ["Done"], timeline: done }));
      },
    });
  }
}

/** Slot `slot`'s editor, the first widget of node 5-4-k's flow. */
export function composerEditor(services: ComposerServices, slot: number): ComposerEditor {
  return new ComposerEditor(services, slot);
}

/**
 * `Tone name:` (plan 18's text input, K11): Abc, the counter, prefilled with a saved tone's name,
 * soft key `Back` while empty; OK or Back on the empty prompt, and C on it, go back to Options.
 * Its cursor blinks on its own timer (Task 0): hidden first, restarted shown by each character key.
 */
function toneName(
  editor: ComposerEditor,
  name: string,
  done: (name: string, flow: Flow) => void,
): Widget {
  const input = textInput({
    label: ["Tone name:"],
    limit: COMPOSER_NAME_LIMIT,
    counter: true,
    text: name,
    done: (text, flow) => (text === "" ? flow.back() : done(text, flow)),
  });
  // Task 0 (`save/open`, `save/c-typed`): the cursor starts hidden for a blink step, and each
  // character key restarts the blink shown (C, # and * do not).
  let blinkMs = TEXT_TIMINGS.blinkMs;
  return ownKeys({
    render: (flow) => {
      const model = input.render(flow) as PromptModel;
      const empty = model.entry?.kind === "text" && model.entry.text === "";
      const cursor = Math.floor(blinkMs / TEXT_TIMINGS.blinkMs) % 2 === 0;
      return { ...model, cursor, ...(empty ? { softkey: "Back" } : {}) };
    },
    onKeyDown: (key, flow) => {
      if (/^[0-9]$/.test(key)) blinkMs = 0;
      const back: Flow["back"] = (levels, options) => {
        if (key === "c") editor.backOnC();
        flow.back(levels, options);
      };
      input.onKeyDown?.(key, { ...flowMethods(flow), back });
    },
    onKey: (key, flow) => input.onKey?.(key, flow),
    tick: (dtMs, flow) => {
      blinkMs += dtMs;
      input.tick?.(dtMs, flow);
    },
    close: () => input.close?.(),
  });
}

/** Options › Save (K11): the name, then `Tone saved` and Options on Save; the slot is written. */
export function composerSave(
  services: Pick<ComposerServices, "composer" | "timelines">,
): (editor: ComposerEditor, flow: Flow) => void {
  return (editor, flow) => {
    const saved = services.composer.slot(editor.slot)?.name ?? "";
    flow.push(
      toneName(editor, saved, (name, inner) => {
        services.composer.save(editor.slot, { name, tempo: editor.tempo, tokens: editor.tokens });
        editor.savedTone();
        inner.replace(note({ lines: ["Tone", "saved"], timeline: services.timelines.saved }));
      }),
    );
  };
}

/**
 * Options › Send (K11, D11): the name, then `Phone number:` (C on the empty number back to the
 * editor); OK on a number opens plan 18c's placeholder (a binary Smart Messaging SMS).
 */
export function composerSend(): (editor: ComposerEditor, flow: Flow) => void {
  return (editor, flow) => {
    flow.push(
      toneName(editor, "", (_name, inner) => {
        const entry = numberEntry({
          label: ["Phone number:"],
          done: (_number, last) => last.push(placeholder("Send")),
        });
        inner.replace(
          ownKeys({
            ...entry,
            render: (f) => entry.render(f),
            // C on the empty number goes back past Options to the editor (Task 0 `send/number-c`)
            onKeyDown: (key, f) =>
              entry.onKeyDown?.(key, {
                ...flowMethods(f),
                back: (levels = 1, o) => {
                  editor.penLeft();
                  f.back(levels + 1, o);
                },
              }),
            onKey: (key, f) => entry.onKey?.(key, f),
            tick: (dtMs, f) => entry.tick?.(dtMs, f),
          }),
        );
      }),
    );
  };
}
