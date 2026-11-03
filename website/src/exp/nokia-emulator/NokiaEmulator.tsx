import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { Globe, PanelRightClose, PanelRightOpen, ScanSearch, SunMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { REVEAL_MS } from "../../phone/reveal";
import type { PhoneRuntime } from "../../phone/stock-phone";
import { Icon } from "./controls";
import { Emulator } from "./emulator";
import {
  INITIAL_PANEL,
  PANEL_TABS,
  panelReducer,
  SHEET_QUERY,
  TAB_LABELS,
  type PanelTab,
} from "./panel-state";
import { DEFAULT_STAGE, fitForScale, type StageSettings } from "./stage-settings";
import "./emulator.css";

const Studio = lazy(() => import("./Studio"));

const TAB_ICONS: Record<PanelTab, LucideIcon> = {
  inspector: ScanSearch,
  world: Globe,
  stage: SunMedium,
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Catches the 3D stage failing (no WebGL, the model failing to load): the panel still works. */
class StageBoundary extends Component<{ children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="emu-stage-error">
        The 3D phone can't run in this browser (it needs WebGL). The panel still drives the
        firmware: its LCD text shows in the Inspector.
      </p>
    ) : (
      this.props.children
    );
  }
}

/**
 * `/exp/nokia-emulator`: the stock v6.39 firmware on the 3D phone in a dark studio, with the
 * Inspector, World and Stage controls in a dock on the right (a bottom sheet below 760px). All of
 * it lives in this page: nothing reaches the URL (plan 32 D6).
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

  const [panel, dispatch] = useReducer(panelReducer, INITIAL_PANEL, (initial) =>
    window.matchMedia(SHEET_QUERY).matches ? { ...initial, open: false } : initial,
  );

  return (
    <div className="emu" data-panel={panel.open ? "open" : "closed"}>
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
      <Panel
        tab={panel.tab}
        open={panel.open}
        onToggle={() => dispatch({ type: "toggle" })}
        onTab={(tab) => dispatch({ type: "tab", tab })}
        onStep={(by) => dispatch({ type: "step", by })}
      >
        {null}
      </Panel>
    </div>
  );
}

function Panel({
  tab,
  open,
  onToggle,
  onTab,
  onStep,
  children,
}: {
  tab: PanelTab;
  open: boolean;
  onToggle: () => void;
  onTab: (tab: PanelTab) => void;
  onStep: (by: 1 | -1) => void;
  children: ReactNode;
}) {
  const tabs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});
  const focusAfterStep = useRef(false);
  useEffect(() => {
    if (!focusAfterStep.current) return;
    focusAfterStep.current = false;
    tabs.current[tab]?.focus();
  }, [tab]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key] as
      | 1
      | -1
      | undefined;
    if (by === undefined) return;
    // The phone listens for the arrows too: the tab list keeps them while it has focus.
    event.preventDefault();
    event.stopPropagation();
    focusAfterStep.current = true;
    onStep(by);
  };
  return (
    <aside className="emu-panel" aria-label="Emulator controls">
      <div className="emu-panel__bar">
        <div
          role="tablist"
          aria-label="Control panel"
          aria-orientation="horizontal"
          className="emu-tabs"
          onKeyDown={onKeyDown}
        >
          {PANEL_TABS.map((id) => (
            <button
              key={id}
              ref={(node) => {
                tabs.current[id] = node;
              }}
              type="button"
              role="tab"
              id={`emu-tab-${id}`}
              aria-selected={open && id === tab}
              aria-controls="emu-tabpanel"
              tabIndex={id === tab ? 0 : -1}
              title={TAB_LABELS[id]}
              onClick={() => onTab(id)}
            >
              <Icon icon={TAB_ICONS[id]} />
              <span>{TAB_LABELS[id]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="emu-icon-button emu-panel__toggle"
          aria-expanded={open}
          aria-controls="emu-tabpanel"
          aria-label={open ? "Collapse the panel" : "Expand the panel"}
          title={open ? "Collapse" : "Expand"}
          onClick={onToggle}
        >
          <Icon icon={open ? PanelRightClose : PanelRightOpen} />
        </button>
      </div>
      <div
        id="emu-tabpanel"
        role="tabpanel"
        aria-labelledby={`emu-tab-${tab}`}
        className="emu-panel__body"
        hidden={!open}
      >
        {children}
      </div>
    </aside>
  );
}
