import { Nokia3310Burst, Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
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
import type { ComponentType } from "react";
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
 * three.js, the model and the firmware are in, the drawing comes to life (reveal.ts) and the 3D
 * phone leaps out of it. Mounted once per session, like the stage inside it.
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

  // Dev only: DialKit's timeline dock drives the reveal (RevealTuner).
  const [Tuner, setTuner] = useState<ComponentType>();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import("./RevealTuner").then((module) => setTuner(() => module.default));
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

  const squash =
    frame.squashX === 1 && frame.squashY === 1
      ? undefined
      : `scale(${frame.squashX}, ${frame.squashY})`;

  return (
    <div ref={fill} className="phone-fill" data-phone={formed ? "3d" : "sketch"}>
      <Nokia3310Burst
        className="phone-burst phone-burst--wide"
        spread={frame.burstSpread}
        opacity={frame.burstOpacity}
      />
      <Nokia3310Burst
        className="phone-burst phone-burst--narrow"
        fit={MOBILE_FIT}
        spread={frame.burstSpread}
        opacity={frame.burstOpacity}
      />
      <div className="phone-body" style={{ transform: squash }}>
        <ClientOnly>
          <Suspense fallback={null}>
            <PhoneStageHost onFormStart={startReveal} pose={getPose} />
          </Suspense>
          {Tuner && <Tuner />}
        </ClientOnly>
        {/* One sketch per breakpoint, each framed like the stage there (PhoneStageHost's fit). */}
        <div className="phone-ink" style={{ opacity: frame.ink }}>
          <Nokia3310Sketch
            className="phone-sketch phone-sketch--wide"
            progress={progress}
            boil={frame.boil}
            halftone={frame.halftone}
          />
          <Nokia3310Sketch
            className="phone-sketch phone-sketch--narrow"
            fit={MOBILE_FIT}
            progress={progress}
            boil={frame.boil}
            halftone={frame.halftone}
          />
        </div>
      </div>
    </div>
  );
}

const getPose = () => getRevealFrame().pose;
