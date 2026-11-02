import { DialTimeline, useDialTimeline } from "dialkit";
import "dialkit/styles.css";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { REVEAL, revealFrame } from "./reveal";
import type { RevealClip, RevealSample } from "./reveal";
import { attachRevealTuner, setRevealFrame } from "./reveal-player";

const CLIPS = Object.keys(REVEAL) as RevealClip[];

/**
 * Dev only: DialKit's timeline dock over the phone's reveal (reveal.ts REVEAL). Scrub, retime and
 * reshape the clips and the drawing and 3D phone follow; the reveal replays from the dock. Edits
 * persist in localStorage; **Copy** hands the tuned config back for REVEAL.
 */
function RevealTuner() {
  const timeline = useDialTimeline("Phone reveal", REVEAL, {
    id: "phone-reveal",
    persist: true,
    autoplay: false,
  });
  // The latest replay, attached once: attaching replays a reveal that has already started.
  const replay = useRef(timeline.replay);
  useEffect(
    () =>
      attachRevealTuner(() => {
        replay.current();
      }),
    [],
  );
  useLayoutEffect(() => {
    replay.current = timeline.replay;
    const sample = Object.fromEntries(
      CLIPS.map((clip) => [clip, timeline[clip].current as Record<string, unknown>]),
    ) as RevealSample;
    setRevealFrame(revealFrame(sample));
  });
  return <DialTimeline />;
}

// Memoised: the frames it sets re-render its parent, which must not re-render it in turn.
export default memo(RevealTuner);
