import { useSyncExternalStore } from "react";
import { KEY_HOTSPOTS } from "./hotspots";
import type { Nokia3310Key } from "./types";

/**
 * Live per-key hotspot calibration. Dev-only: when enabled (URL `?calibrate=1`
 * or `window.__HOTSPOT_CALIBRATE__ = true`), a control panel lets you adjust
 * x / y / z / w / h for each of the 17 keys and see the change live, then
 * "Copy values" emits the final hotspots.ts to paste back in.
 *
 * Per-key values:
 *   x (cx), y (cy), w, h  — fractions of the model face (matches KeyHotspot).
 *   z                     — fraction of model depth out from center (0.5 = rim);
 *                           shared default unless a key overrides it.
 *   rot                   — in-plane rotation in degrees (for skewed keys).
 */
export interface KeyCal {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rot: number;
}

export type CalMap = Record<Nokia3310Key, KeyCal>;

/** Shared default Z fraction for keys that don't pin their own. */
export const DEFAULT_Z = 0.5;

function initialCal(): CalMap {
  const map = {} as CalMap;
  for (const h of KEY_HOTSPOTS) {
    map[h.key] = { x: h.cx, y: h.cy, z: h.z ?? DEFAULT_Z, w: h.w, h: h.h, rot: h.rot ?? 0 };
  }
  return map;
}

let current: CalMap = initialCal();
let selected: Nokia3310Key = KEY_HOTSPOTS[0].key;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCal(): CalMap {
  return current;
}

export function setKeyCal(key: Nokia3310Key, patch: Partial<KeyCal>): void {
  current = { ...current, [key]: { ...current[key], ...patch } };
  emit();
}

export function resetCal(): void {
  current = initialCal();
  emit();
}

export function getSelectedKey(): Nokia3310Key {
  return selected;
}

export function setSelectedKey(key: Nokia3310Key): void {
  selected = key;
  emit();
}

export function useCal(): CalMap {
  return useSyncExternalStore(subscribe, getCal, getCal);
}

export function useSelectedKey(): Nokia3310Key {
  return useSyncExternalStore(subscribe, getSelectedKey, getSelectedKey);
}

/** True when calibration mode should be active (dev-only opt-in). */
export function isCalibrating(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as unknown as { __HOTSPOT_CALIBRATE__?: boolean }).__HOTSPOT_CALIBRATE__) return true;
  try {
    return new URLSearchParams(window.location.search).has("calibrate");
  } catch {
    return false;
  }
}

/** Emit the calibrated values as ready-to-paste source: the per-key
 *  KEY_HOTSPOTS array (cx/cy/w/h) plus the shared HOTSPOT_Z_FRAC depth. */
export function calToSource(cal: CalMap): string {
  const order = KEY_HOTSPOTS.map((h) => h.key);
  const f = (n: number) => n.toFixed(3).replace(/\.?0+$/, "");
  const rows = order
    .map((k) => {
      const c = cal[k];
      const rot = Math.abs(c.rot) > 0.001 ? `, rot: ${f(c.rot)}` : "";
      return `  { key: ${JSON.stringify(k)}, cx: ${f(c.x)}, cy: ${f(c.y)}, w: ${f(c.w)}, h: ${f(c.h)}${rot} },`;
    })
    .join("\n");
  // Z is a single shared depth (HOTSPOT_Z_FRAC in Nokia3310.tsx). Report the
  // most common z; flag if keys diverge so you know to reconcile.
  const zs = order.map((k) => cal[k].z);
  const z = mode(zs);
  const diverges = zs.some((v) => Math.abs(v - z) > 0.001);
  const zLine = `// In Nokia3310.tsx set: const HOTSPOT_Z_FRAC = ${f(z)};${
    diverges ? " // NOTE: per-key z varied during calibration; picked the most common" : ""
  }`;
  return `${zLine}\nexport const KEY_HOTSPOTS: readonly KeyHotspot[] = [\n${rows}\n];`;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0];
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}
