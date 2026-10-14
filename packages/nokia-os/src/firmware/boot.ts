// The stock phone's boot gates (plan 15 D9, Task 0 A1/A6): the power-on security code when
// Phone security asks for it, and the welcome note, which the firmware shows instead of the
// hands. Both hold phone-core's boot at the end of the self-test.
import type { BootGate } from "@hellotimber/phone-core";
import type { WidgetModel } from "../display/widgets";
import {
  BOOT_TIMELINE,
  GATE_HANDS_TIMELINE,
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINES,
  type StockWidgetTimeline,
} from "../resources";
import { codeEntry } from "../widgets/code-entry";
import { StockFlowApplication, type Flow, type Widget } from "../widgets/flow";
import type { NoteSound } from "../widgets/note";
import { WELCOME_NOTE_KEY } from "./features/settings";
import type { StockSecurity } from "./security";
import type { StockSettings } from "./settings";

/** The boot timeline's self-test steps (images, blank, black, images); the gates follow them. */
const SELF_TEST_STEPS = 4;

/**
 * Where the self-test ends and the gates hold the boot: the end of `BOOT_TIMELINE` step 3
 * (`boot/power-on` frame 4 starts 4094 ms after the power key).
 */
export const SELF_TEST_MS = BOOT_TIMELINE.steps
  .slice(0, SELF_TEST_STEPS)
  .reduce((sum, step) => sum + step.durationMs, 0);

/** The blank LCD between the self-test and the code prompt (`boot/security-gate` frame 4). */
export const GATE_BLANK_MS = 42;
/** The blank partial draw before a gate-free welcome note (`boot/welcome-note-ungated` frame 4). */
export const WELCOME_BLANK_MS = 7;
/** How long a gate-free welcome note stays (`boot/welcome-note-ungated` frame 5: 5079.5 ms). */
export const WELCOME_NOTE_MS = 5080;
/**
 * After the gate, the welcome note ends this long after `Code accepted` appears
 * (`boot/welcome-note` and `-long`: 6357.9 ms whatever the note).
 */
export const GATED_WELCOME_END_MS = 6358;

/** The power-on prompt's label and soft key (`boot/security-gate` image d). */
const PROMPT = { lines: ["Security", "code:"], softkey: "OK" } as const;
/** The note after an accepted power-on code (`Code\naccepted`, string 0x1c3). */
const CODE_ACCEPTED = ["Code", "accepted"] as const;

function named(name: string): StockWidgetTimeline {
  const found = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NAME[name] ?? ""];
  if (found === undefined) throw new Error(`No named widget timeline "${name}".`);
  return found;
}

/** One screen of a boot sequence, `elapsedMs` after the phase started. */
interface Phase {
  readonly durationMs: number;
  readonly model: (elapsedMs: number) => WidgetModel;
}

/**
 * Boot screens on one clock, then `end`: a sequence keeps every phase's timing exact at any
 * tick rate. Keys do nothing (UNVERIFIED: no capture presses a key during these screens).
 */
class Sequence implements Widget {
  readonly #phases: readonly Phase[];
  readonly #end: (flow: Flow) => void;
  #elapsed = 0;
  #ended = false;

  constructor(phases: readonly Phase[], end: (flow: Flow) => void) {
    this.#phases = phases;
    this.#end = end;
  }

  render(): WidgetModel {
    let start = 0;
    for (const phase of this.#phases) {
      if (this.#elapsed < start + phase.durationMs) return phase.model(this.#elapsed - start);
      start += phase.durationMs;
    }
    const last = this.#phases[this.#phases.length - 1]!;
    return last.model(last.durationMs);
  }

  tick(dtMs: number, flow: Flow): void {
    this.#elapsed += dtMs;
    const total = this.#phases.reduce((sum, phase) => sum + phase.durationMs, 0);
    if (this.#ended || this.#elapsed < total) return;
    this.#ended = true;
    this.#end(flow);
  }
}

const blank = (durationMs: number): Phase => ({
  durationMs,
  model: () => ({ kind: "boot-frame", frame: 0 }),
});

/** A note on its widget timeline, held for the timeline's duration. */
function notePhase(lines: readonly string[], timeline: StockWidgetTimeline): Phase {
  return {
    durationMs: timeline.timeline.durationMs,
    model: (elapsed) => ({
      kind: "note",
      lines,
      frame: timeline.frames[timeline.timeline.frameAt(elapsed)]!,
    }),
  };
}

const welcomePhase = (text: string, durationMs: number): Phase => ({
  durationMs,
  model: () => ({ kind: "welcome-note", text }),
});

/** The hands after the gate, at `boot/security-gate`'s regular steps (not `BOOT_TIMELINE`'s). */
const handsPhase: Phase = {
  durationMs: GATE_HANDS_TIMELINE.durationMs,
  model: (elapsed) => ({ kind: "boot-frame", frame: GATE_HANDS_TIMELINE.frameAt(elapsed) }),
};

export interface StockBootGateOptions {
  readonly security: StockSecurity;
  readonly settings: StockSettings;
  /** Plan 16: the gate's `Code error` sounds its warning tone (default: silent). */
  readonly sound?: NoteSound;
  /** `boot: "skip"`: the security gate runs at power-on with no animation, and no note. */
  readonly skip: boolean;
}

/** The stored welcome note, if any (plan 18's editor writes it). */
function welcomeNote(settings: StockSettings): string | undefined {
  const text = settings.text(WELCOME_NOTE_KEY);
  return text === undefined || text.trim() === "" ? undefined : text;
}

/**
 * The security gate (D9, D10; B3): when Phone security is On and the inserted SIM is not among
 * the last five, the 42 ms blank, the prompt (C on the empty entry is inert, A2; a wrong code
 * plays the boot's own `Code error`, 2889 ms), then `Code accepted` and the hands, or the
 * welcome note in their place, and standby. Every power-on that passes records the SIM.
 */
function securityGate(options: StockBootGateOptions): BootGate {
  const { security, settings, skip, sound } = options;
  const accepted = (flow: Flow): void => {
    security.insertSim(security.sim);
    const note = skip ? undefined : welcomeNote(settings);
    const phases: Phase[] =
      note === undefined
        ? [notePhase(CODE_ACCEPTED, named("code-accepted")), ...(skip ? [] : [handsPhase])]
        : [notePhase(CODE_ACCEPTED, named("code-accepted-welcome"))];
    if (note !== undefined) {
      const shown = phases[0]!.durationMs;
      phases.push(welcomePhase(note, GATED_WELCOME_END_MS - shown));
    }
    flow.replace(new Sequence(phases, (f) => f.standby()));
  };
  const prompt = (): Widget =>
    codeEntry({
      ...PROMPT,
      security,
      accepted,
      onEmptyC: "inert",
      error: named("boot-code-error"),
      ...(sound === undefined ? {} : { sound }),
    });
  return {
    atMs: skip ? 0 : SELF_TEST_MS,
    open() {
      if (!security.asksAtPowerOn(security.sim)) {
        security.insertSim(security.sim);
        return undefined;
      }
      return new StockFlowApplication(
        "stock:boot/security-code",
        () => new Sequence([blank(GATE_BLANK_MS)], (flow) => flow.replace(prompt())),
      );
    },
  };
}

/**
 * The welcome note without the security gate (`boot/welcome-note-ungated`): a 7 ms blank, the
 * note for 5079.5 ms, then standby. The hands never play.
 */
function welcomeGate(settings: StockSettings): BootGate {
  return {
    atMs: SELF_TEST_MS,
    open() {
      const note = welcomeNote(settings);
      if (note === undefined) return undefined;
      return new StockFlowApplication(
        "stock:boot/welcome-note",
        () =>
          new Sequence([blank(WELCOME_BLANK_MS), welcomePhase(note, WELCOME_NOTE_MS)], (flow) =>
            flow.standby(),
          ),
      );
    },
  };
}

/**
 * The stock phone's boot gates, in order: the security code, then the welcome note (which runs
 * only when the security gate did not, since that gate ends the boot itself). `boot: "skip"`
 * keeps the security gate only: skipping an animation must not skip a lock.
 */
export function stockBootGates(options: StockBootGateOptions): readonly BootGate[] {
  const gates = [securityGate(options)];
  return options.skip ? gates : [...gates, welcomeGate(options.settings)];
}
