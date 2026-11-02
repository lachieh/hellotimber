import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { MOBILE_FIT } from "./stage-frame";
import { loadPhoneRuntime } from "./stock-phone";

let stageModule: Promise<typeof import("./PhoneStageHost")> | undefined;
const loadStage = () => (stageModule ??= import("./PhoneStageHost"));
const PhoneStageHost = lazy(loadStage);

/** What the phone waits on, and each one's share of the loading bar (the model is the rest). */
const LOADING_SHARE = { page: 0.1, stage: 0.5, firmware: 0.2 } as const;
type Loaded = Record<keyof typeof LOADING_SHARE, boolean>;

/**
 * The phone on the desk. The server sends it drawn flat in comic ink, its LCD loading; once
 * three.js, the model and the firmware are in, the 3D phone forms out of that drawing
 * (PhoneStage `form`) and the ink fades off it. Mounted once per session, like the stage inside it.
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

  return (
    <div className="phone-fill" data-phone={formed ? "3d" : "sketch"}>
      <ClientOnly>
        <Suspense fallback={null}>
          <PhoneStageHost
            onFormStart={() => {
              setFormed(true);
            }}
          />
        </Suspense>
      </ClientOnly>
      {/* One sketch per breakpoint, each framed like the stage there (PhoneStageHost's fit). */}
      <Nokia3310Sketch className="phone-sketch phone-sketch--wide" progress={progress} />
      <Nokia3310Sketch
        className="phone-sketch phone-sketch--narrow"
        fit={MOBILE_FIT}
        progress={progress}
      />
    </div>
  );
}
