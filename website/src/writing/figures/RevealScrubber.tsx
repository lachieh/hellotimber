import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { REVEAL_MS, revealAt } from "../../phone/reveal";
import { DESK_FIT } from "../../phone/stage-frame";
import { Figure } from "./parts";

const RevealStage = lazy(() => import("./RevealStage"));

/** The drawing's LCD where the 3D phone can't load, as on the homepage. */
const CANT_SWITCH_ON = ["Can't switch", "on here"] as const;

type Stage = "waiting" | "loading" | "ready" | "drawing-only";

/** The stage failing to load its model or render leaves the drawing, as on the homepage. */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The homepage's reveal, scrubbable: the drawing over the real 3D phone, and a slider through the
 * same `revealAt(ms)` the homepage plays. The 3D phone loads when the figure nears the screen; with
 * no WebGL the drawing and its numbers stay.
 */
export function RevealScrubber({ caption }: { caption: ReactNode }) {
  const [ms, setMs] = useState(0);
  const msRef = useRef(0);
  msRef.current = ms;
  const [stage, setStage] = useState<Stage>("waiting");
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    if (!hasWebGL()) {
      setStage("drawing-only");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStage((now) => (now === "waiting" ? "loading" : now));
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Play: the reveal on the wall clock, from wherever the slider is (the start, from the end).
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMs(REVEAL_MS);
      setPlaying(false);
      return;
    }
    const from = msRef.current >= REVEAL_MS ? 0 : msRef.current;
    const start = performance.now() - from;
    let raf = requestAnimationFrame(function tick(now) {
      const next = Math.min(REVEAL_MS, now - start);
      setMs(next);
      if (next >= REVEAL_MS) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const frame = revealAt(ms);
  const ready = stage === "ready";
  const status =
    stage === "drawing-only"
      ? "This browser can't draw the 3D phone; the drawing and the numbers still follow the slider."
      : ready
        ? undefined
        : "Loading the 3D phone…";
  return (
    <Figure kind="reveal" caption={caption}>
      <div className="fig-reveal" ref={frameRef}>
        <div className="fig-reveal__stage">
          <div className="phone-fill">
            {(stage === "loading" || ready) && (
              <StageBoundary onError={() => setStage("drawing-only")}>
                <Suspense fallback={null}>
                  <RevealStage
                    fit={DESK_FIT}
                    pose={() => revealAt(msRef.current).pose}
                    onFormStart={() => setStage("ready")}
                  />
                </Suspense>
              </StageBoundary>
            )}
            <Nokia3310Sketch
              className="phone-sketch"
              fit={DESK_FIT}
              progress={1}
              lcdText={stage === "drawing-only" ? CANT_SWITCH_ON : undefined}
              wipe={ready ? frame.wipe : 0}
            />
          </div>
        </div>
        <div className="fig-reveal__side">
          <div className="fig-reveal__controls">
            <button type="button" className="fig-button" onClick={() => setPlaying((now) => !now)}>
              {playing ? "Pause" : ms >= REVEAL_MS ? "Play again" : "Play"}
            </button>
            <label className="fig-slider">
              <span className="sr-only">Time into the reveal</span>
              <input
                type="range"
                min={0}
                max={REVEAL_MS}
                step={10}
                value={Math.round(ms)}
                aria-valuetext={`${Math.round(ms)} milliseconds`}
                onChange={(event) => {
                  setPlaying(false);
                  setMs(Number(event.target.value));
                }}
              />
            </label>
          </div>
          <dl className="cat-specs fig-readout" aria-label="The reveal at this instant">
            <div>
              <dt>Time</dt>
              <dd>
                {Math.round(ms)} of {REVEAL_MS} ms
              </dd>
            </div>
            <div>
              <dt>Wipe</dt>
              <dd>{percent(frame.wipe)}</dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd>{percent(frame.pose.depth)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{(1 / (1 - frame.pose.lift)).toFixed(2)}×</dd>
            </div>
          </dl>
          {status !== undefined && <p className="fig-note">{status}</p>}
        </div>
      </div>
    </Figure>
  );
}
