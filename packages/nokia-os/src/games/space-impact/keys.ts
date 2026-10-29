import type { PhoneKey } from "@hellotimber/phone-core";
import type { SpaceImpactControl, SpaceImpactPoint } from "./model";

export function isSpaceImpactControl(key: PhoneKey): key is SpaceImpactControl {
  return key === "8" || key === "0" || key === "*" || key === "#" || key === "1" || key === "3";
}

export function spaceImpactMove(
  key: SpaceImpactControl,
  distance: number,
): SpaceImpactPoint | null {
  switch (key) {
    case "8":
      return { x: 0, y: -distance };
    case "0":
      return { x: 0, y: distance };
    case "*":
      return { x: -distance, y: 0 };
    case "#":
      return { x: distance, y: 0 };
    case "1":
    case "3":
      return null;
  }
}
