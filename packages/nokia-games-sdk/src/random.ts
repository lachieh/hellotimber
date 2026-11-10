// The session generator (plan 28 D4): a game's only randomness, so a replay reproduces it.

/** mulberry32 over `seed` (read as a uint32): a uint32 per call. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** MurmurHash3's 32-bit finaliser: every input bit reaches every output bit. */
function scramble(value: number): number {
  let h = value;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A uint32 hash of two uint32s, for deriving one seed from another (a phone seed and a counter). */
export function mixSeed(a: number, b: number): number {
  return scramble((scramble(a >>> 0) + 0x9e3779b9) ^ (b >>> 0));
}
