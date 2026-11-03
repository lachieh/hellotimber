// The keypad's auto-repeat: a held ▲/▼ steps on the press, again after `firstMs`, then every
// `everyMs` (plan 23 Task 0 C1, `game/snake/level-keys-hold-up`: ≈778 ms, then 482-496 ms). Level
// pages, number entry and the key beeps repeat on it.
export const LEVEL_REPEAT = { firstMs: 778, everyMs: 489 } as const;
