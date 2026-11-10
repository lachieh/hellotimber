// The host limits of plan 28 D19: the only caps on a game. Each exists because a hostile or broken
// game could otherwise hurt the phone; nothing else in the SDK declares a bound.

export const SCREEN_WIDTH = 84;
export const SCREEN_HEIGHT = 48;
/** Packed frame: 84×48 bits, row-major, MSB first, 1 = ink (504 bytes). It is the LCD. */
export const PACKED_FRAME_BYTES = 504;

/** Shorter delays are raised to it, so a game returning 0 cannot busy-loop the host. */
export const MIN_WAKE_MS = 10;
/** Saved bytes per game: the record lives in the phone's EEPROM store and is rewritten whole. */
export const MAX_STORAGE_BYTES = 1024;
/** Packages persist in the host's storage and are compiled inside the load watchdog. */
export const MAX_PACKAGE_BYTES = 512 * 1024;
/** Bounds the host's validation work and memory per reply. */
export const MAX_EFFECTS_PER_REPLY = 64;
export const MAX_NOTES_PER_REPLY = 8192;
/** The Wasm ABI's i32: session time and scores stay below 2^31. */
export const MAX_SESSION_MS = 2 ** 31 - 1;
/** A stuck game cannot hold the phone: ms per reply while playing, and for a load. */
export const WATCHDOG_MS = { play: 1000, load: 5000 } as const;
