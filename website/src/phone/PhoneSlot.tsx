import { Nokia3310Sketch } from "@hellotimber/phone-3d/sketch";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { MOBILE_FIT } from "./stage-frame";

const PhoneStageHost = lazy(() => import("./PhoneStageHost"));

/**
 * The phone on the desk. The server sends it drawn flat in comic ink; once three.js, the model
 * and the firmware are in, the 3D phone forms out of that drawing (PhoneStage `form`) and the
 * ink fades off it. Mounted once per session, like the stage inside it.
 */
export default function PhoneSlot() {
  const [formed, setFormed] = useState(false);
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
      <Nokia3310Sketch className="phone-sketch phone-sketch--wide" />
      <Nokia3310Sketch className="phone-sketch phone-sketch--narrow" fit={MOBILE_FIT} />
    </div>
  );
}
