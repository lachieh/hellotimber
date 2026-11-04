import { useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { FigureFirmware } from "./figure-phone";
import { keyName, parseKeys, replay, REPLAY_START, type ReplayAction } from "./machine";
import { Figure, LcdScreen } from "./parts";
import { useFigurePhone } from "./use-figure-phone";

/** The pause between one press's release and the next press, while playing. */
const GAP_MS = 650;

/**
 * Plays a recorded key sequence (`keys="navi down down navi"`, `c:long` for a held key) on a live
 * LCD, a press at a time: Play, Pause, Step and Reset.
 */
export function KeyReplay({
  firmware = "home",
  start,
  keys,
  t9 = false,
  caption,
}: {
  firmware?: FigureFirmware;
  start?: string;
  keys: string;
  t9?: boolean;
  caption: ReactNode;
}) {
  const presses = useMemo(() => parseKeys(keys), [keys]);
  const phone = useFigurePhone({ firmware, start, t9 });
  const [state, dispatch] = useReducer(
    (current: typeof REPLAY_START, action: ReplayAction) => replay(current, action, presses.length),
    REPLAY_START,
  );
  const ready = phone.status === "ready";

  // A step presses the next key and holds it for its time.
  const press = (i: number) => {
    const { key, holdMs } = presses[i]!;
    phone.input(key, "down");
    window.setTimeout(() => phone.input(key, "up"), holdMs);
  };
  const step = () => {
    if (state.next >= presses.length) return;
    press(state.next);
    dispatch("step");
  };

  useEffect(() => {
    if (!state.playing || !ready) return;
    const hold = state.next === 0 ? 0 : presses[state.next - 1]!.holdMs;
    const timer = window.setTimeout(() => {
      press(state.next);
      dispatch("step");
    }, hold + GAP_MS);
    return () => window.clearTimeout(timer);
    // `press` reads this render's phone; the timer restarts when the place, play or phone changes.
  }, [state.playing, state.next, ready]);

  const reset = () => {
    dispatch("reset");
    phone.reset();
  };
  const atEnd = state.next >= presses.length;
  return (
    <Figure kind="replay" caption={caption}>
      <div className="fig-replay" ref={phone.frameRef}>
        <div className="fig-phone">
          <LcdScreen
            phone={phone}
            label="A Nokia 3310 screen replaying key presses"
            interactive={false}
          />
        </div>
        <div className="fig-replay__side">
          <ol className="fig-replay__keys" aria-label="The key presses">
            {presses.map((p, i) => (
              <li
                key={i}
                data-done={i < state.next ? "" : undefined}
                aria-current={i === state.next - 1 ? "step" : undefined}
              >
                <kbd>{keyName(p.key)}</kbd>
                {p.holdMs > 500 && <span className="fig-replay__hold">held</span>}
              </li>
            ))}
          </ol>
          <p className="fig-replay__count" aria-live="polite">
            {state.next} of {presses.length} presses
          </p>
          <div className="fig-replay__controls">
            <button
              type="button"
              className="fig-button"
              disabled={!ready}
              onClick={() => {
                if (atEnd) reset();
                dispatch(state.playing ? "pause" : "play");
              }}
            >
              {state.playing ? "Pause" : atEnd ? "Play again" : "Play"}
            </button>
            <button
              type="button"
              className="fig-button"
              disabled={!ready || state.playing || atEnd}
              onClick={step}
            >
              Step
            </button>
            <button
              type="button"
              className="fig-button"
              disabled={!ready || state.next === 0}
              onClick={reset}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </Figure>
  );
}
