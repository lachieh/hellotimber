import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { REVEAL_MS } from "../../phone/reveal";
import type { PhoneRuntime } from "../../phone/stock-phone";
import { Emulator } from "./emulator";
import { DEFAULT_STAGE, fitForScale, type StageSettings } from "./stage-settings";
import "./emulator.css";

const Studio = lazy(() => import("./Studio"));

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Catches the 3D stage failing (no WebGL, the model failing to load): the panel still works. */
class StageBoundary extends Component<{ children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="emu-stage-error">The 3D phone can't run in this browser (it needs WebGL).</p>
    ) : (
      this.props.children
    );
  }
}

/**
 * `/exp/nokia-emulator`: the stock v6.39 firmware on the 3D phone in a dark studio.
 */
export default function NokiaEmulator() {
  const [emulator] = useState(() => new Emulator());
  useEffect(() => {
    void emulator.start();
    return () => emulator.stop();
  }, [emulator]);
  const state = useSyncExternalStore(emulator.subscribe, emulator.getState, emulator.getState);

  // A reset replaces the runtime: the stage keeps the last one's LCD until the new one is up.
  const shown = useRef<PhoneRuntime | undefined>(undefined);
  if (state.runtime !== undefined) shown.current = state.runtime;
  const runtime = shown.current;

  const [motion] = useState(() => !prefersReducedMotion());
  const [stage, setStage] = useState<StageSettings>(() => ({
    ...DEFAULT_STAGE,
    reveal: motion ? 0 : REVEAL_MS,
    float: motion,
  }));

  // The reveal plays once as the model appears, and again from the Stage tab.
  const stopReveal = useRef<() => void>(() => {});
  const playReveal = useCallback(() => {
    stopReveal.current();
    if (!motion) {
      setStage((prev) => ({ ...prev, reveal: REVEAL_MS }));
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const reveal = Math.min(REVEAL_MS, now - start);
      setStage((prev) => ({ ...prev, reveal }));
      if (reveal < REVEAL_MS) frame = requestAnimationFrame(tick);
    });
    stopReveal.current = () => cancelAnimationFrame(frame);
  }, [motion]);
  useEffect(() => () => stopReveal.current(), []);

  return (
    <div className="emu">
      <section className="emu-stage" aria-label="The phone" aria-describedby="emu-keys">
        {runtime === undefined ? (
          <Nokia3310Sketch className="emu-sketch" fit={fitForScale(stage.scale)} progress={0.6} />
        ) : (
          <StageBoundary>
            <Suspense
              fallback={
                <Nokia3310Sketch
                  className="emu-sketch"
                  fit={fitForScale(stage.scale)}
                  progress={0.8}
                />
              }
            >
              <Studio
                emulator={emulator}
                runtime={runtime}
                stage={stage}
                backlight={state.world.backlight}
                onFormStart={playReveal}
              />
            </Suspense>
          </StageBoundary>
        )}
        <p id="emu-keys" className="emu-keys">
          <span>
            <kbd>Up</kbd> <kbd>Down</kbd> scroll
          </span>
          <span>
            <kbd>Enter</kbd> select
          </span>
          <span>
            <kbd>Esc</kbd> C
          </span>
          <span>
            <kbd>0–9</kbd> <kbd>*</kbd> <kbd>#</kbd> keypad
          </span>
          <span>
            <kbd>P</kbd> power
          </span>
        </p>
      </section>
    </div>
  );
}
