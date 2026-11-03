import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { ClientOnly } from "@tanstack/react-router";
import {
  Component,
  lazy,
  memo,
  useCallback,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { DRAWN } from "./reveal";
import { getRevealFrame, playReveal, subscribeReveal } from "./reveal-player";
import { DESK_FIT, MOBILE_FIT } from "./stage-frame";
import { loadPhoneRuntime } from "./stock-phone";

let stageModule: Promise<typeof import("./PhoneStageHost")> | undefined;
const loadStage = () => (stageModule ??= import("./PhoneStageHost"));
// Memoised: the reveal re-renders the slot every frame, the stage never needs it.
const PhoneStageHost = memo(lazy(loadStage));

/** What the phone waits on, and each one's share of the loading bar (the model is the rest). */
const LOADING_SHARE = { page: 0.1, stage: 0.5, firmware: 0.2 } as const;
type Loaded = Record<keyof typeof LOADING_SHARE, boolean>;

/** What the drawing's LCD says when the 3D phone can't load (no WebGL, or its code or model
 *  failed): the desk and its links still work around it. */
const CANT_SWITCH_ON = ["Can't switch", "on. Reload", "to try again"] as const;

function hasWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
}

/** Catches the stage failing as it loads its model or renders: the drawing stays instead. */
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

/** How far the phone's lift (a share of the camera distance) is from the desk at its highest. */
const LIFT_FOR_FULL_SHADOW = 0.16;

/**
 * The phone on the desk. The server sends it drawn flat in comic ink, its LCD loading; once
 * three.js, the model and the firmware are in, the drawing turns into the 3D phone top to
 * bottom and the phone leaps out of the desk (reveal.ts). Mounted once per session, like the stage inside it.
 */
export default function PhoneSlot() {
  const [formed, setFormed] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({ page: false, stage: false, firmware: false });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    const fail = () => {
      if (mounted) setFailed(true);
    };
    if (!hasWebGL()) fail();
    const mark = (part: keyof Loaded) => () => {
      if (mounted) setLoaded((prev) => ({ ...prev, [part]: true }));
    };
    mark("page")();
    void loadStage().then(mark("stage"), fail);
    void loadPhoneRuntime().then(mark("firmware"));
    return () => {
      mounted = false;
    };
  }, []);
  const progress = formed
    ? 1
    : (Object.keys(LOADING_SHARE) as (keyof Loaded)[]).reduce(
        (sum, part) => sum + (loaded[part] ? LOADING_SHARE[part] : 0),
        0,
      );

  const startReveal = useCallback(() => {
    setFormed(true);
    playReveal();
  }, []);

  const onStageError = useCallback(() => {
    setFailed(true);
  }, []);

  const frame = useSyncExternalStore(subscribeReveal, getRevealFrame, () => DRAWN);

  // The desk's shadow (desk.css) follows the phone off the desk and back.
  const fill = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const phone = fill.current?.closest<HTMLElement>(".d01-phone");
    if (!phone) return;
    phone.style.setProperty("--phone-rest", String(Math.min(1, Math.max(0, frame.pose.depth))));
    phone.style.setProperty(
      "--phone-leap",
      String(Math.max(0, frame.pose.lift / LIFT_FOR_FULL_SHADOW)),
    );
  }, [frame]);

  return (
    <div ref={fill} className="phone-fill" data-phone={formed ? "3d" : "sketch"}>
      <ClientOnly>
        {!failed && (
          <StageBoundary onError={onStageError}>
            <Suspense fallback={null}>
              <PhoneStageHost onFormStart={startReveal} pose={getPose} />
            </Suspense>
          </StageBoundary>
        )}
      </ClientOnly>
      {/* One sketch per breakpoint, each framed like the stage there (PhoneStageHost's fit). If
          the 3D phone can't load, the drawing stays whole and says so on its LCD. */}
      <Nokia3310Sketch
        className="phone-sketch phone-sketch--wide"
        fit={DESK_FIT}
        progress={progress}
        lcdText={failed ? CANT_SWITCH_ON : undefined}
        wipe={failed ? 0 : frame.wipe}
      />
      <Nokia3310Sketch
        className="phone-sketch phone-sketch--narrow"
        fit={MOBILE_FIT}
        progress={progress}
        lcdText={failed ? CANT_SWITCH_ON : undefined}
        wipe={failed ? 0 : frame.wipe}
      />
    </div>
  );
}

const getPose = () => getRevealFrame().pose;
