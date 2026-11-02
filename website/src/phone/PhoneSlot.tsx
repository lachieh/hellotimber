import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { ClientOnly } from "@tanstack/react-router";
import {
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
import { DRAWN } from "./reveal";
import { getRevealFrame, playReveal, subscribeReveal } from "./reveal-player";
import { MOBILE_FIT } from "./stage-frame";
import { loadPhoneRuntime } from "./stock-phone";

let stageModule: Promise<typeof import("./PhoneStageHost")> | undefined;
const loadStage = () => (stageModule ??= import("./PhoneStageHost"));
// Memoised: the reveal re-renders the slot every frame, the stage never needs it.
const PhoneStageHost = memo(lazy(loadStage));

/** What the phone waits on, and each one's share of the loading bar (the model is the rest). */
const LOADING_SHARE = { page: 0.1, stage: 0.5, firmware: 0.2 } as const;
type Loaded = Record<keyof typeof LOADING_SHARE, boolean>;

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
  useEffect(() => {
    let mounted = true;
    const mark = (part: keyof Loaded) => () => {
      if (mounted) setLoaded((prev) => ({ ...prev, [part]: true }));
    };
    mark("page")();
    void loadStage().then(mark("stage"));
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
        <Suspense fallback={null}>
          <PhoneStageHost onFormStart={startReveal} pose={getPose} />
        </Suspense>
      </ClientOnly>
      {/* One sketch per breakpoint, each framed like the stage there (PhoneStageHost's fit). */}
      <Nokia3310Sketch
        className="phone-sketch phone-sketch--wide"
        progress={progress}
        wipe={frame.wipe}
      />
      <Nokia3310Sketch
        className="phone-sketch phone-sketch--narrow"
        fit={MOBILE_FIT}
        progress={progress}
        wipe={frame.wipe}
      />
    </div>
  );
}

const getPose = () => getRevealFrame().pose;
