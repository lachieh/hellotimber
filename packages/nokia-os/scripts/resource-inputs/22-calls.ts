// Plan 22's resource evidence (plan 29 registration): the call screens' sprites (the handset, the
// call icon solid and checkered, the in-call Volume's bars) and the new notes' timelines.
import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";

const crop = (
  id: string,
  group: string,
  golden: string,
  image: string,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): SpriteCrop => ({ id, group, golden, image, x0, x1, y0, y1 });

/** The Volume bars' area (`in-call/down-steps`): ten stepped bars, `level` of them filled. */
const VOLUME = [3, 80, 11, 36] as const;

export const resources: ResourceDeclarations = {
  spriteBatches: [
    {
      order: 220,
      entries: [
        // The handset drawn at the top while a call is up (`dial/call` g, from Calling's dots on).
        crop("call/handset", "call", "calls/dial-call", "g", 7, 22, 1, 5),
        // The 7×7 call icon left of `Call 1` (`dial/call` h), and the checkered one the network's
        // end shows (`dial/net-end-connected` i).
        crop("call/icon", "call", "calls/dial-call", "h", 6, 12, 8, 14),
        crop("call/icon-ended", "call", "calls/dial-net-end-connected", "i", 6, 12, 8, 14),
        // Volume's bars at each level: 10 (`in-call/up` c), 9…1 (`in-call/down-steps` c…k).
        crop("volume/10", "volume", "calls/in-call-up", "c", ...VOLUME),
        ...["c", "d", "e", "f", "g", "h", "i", "j", "k"].map((image, i) =>
          crop(`volume/${9 - i}`, "volume", "calls/in-call-down-steps", image, ...VOLUME),
        ),
      ],
    },
  ],
  timelineBatches: [
    {
      order: 220,
      entries: [
        { golden: "calls/recall-0-hash", kind: "note", name: "invalid-location", fromFrame: 2 },
        {
          golden: "calls/recall-1-hash",
          kind: "note",
          name: "recall-no-phone-numbers",
          fromFrame: 2,
        },
        {
          golden: "calls/dial-number-one-digit",
          kind: "note",
          name: "speed-dial-not-saved",
          fromFrame: 2,
        },
        {
          golden: "calls/dial-number-thirty-three",
          kind: "note",
          name: "invalid-phone-number",
          fromFrame: 2,
        },
        {
          golden: "calls/register-standby-up-none",
          kind: "note",
          name: "no-last-dialled-numbers",
          fromFrame: 2,
        },
        { golden: "calls/register-missed-open", kind: "note", name: "new-numbers" },
        { golden: "calls/register-missed-open-read", kind: "note", name: "no-new-numbers" },
        { golden: "calls/register-erase-ok", kind: "erased", name: "call-erased" },
        { golden: "calls/in-call-options-select-5", kind: "note", name: "muted" },
        { golden: "calls/register-erase-lists-all", kind: "note", name: "all-call-lists-erased" },
      ],
    },
  ],
};
