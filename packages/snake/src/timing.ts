/** Clamp a speed/level option into the Snake II range 1-9. */
export function clampLevel(speed: number): number {
  return Math.min(9, Math.max(1, Math.floor(speed)));
}

/**
 * Host tick cadence for a given level (1-9). The engine never reads time;
 * hosts call game.tick() every tickIntervalMs(speed) milliseconds.
 * 600 - level*55: level 1 = 545 ms ... level 9 = 105 ms (higher = faster).
 */
export function tickIntervalMs(speed: number): number {
  return 600 - clampLevel(speed) * 55;
}
