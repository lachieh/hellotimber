// The host sound port (plan 16 D4, VISION "Sound (plan 16)"): every change of the phone's three
// outputs, stamped with the kernel time it happens at. nokia-os touches no audio API.

/**
 * Plan 16: one change of the phone's sound outputs at kernel time `atMs`. `volume` is the
 * firmware's level register as captured: buzzer, MAD2 PUP 0x1E (0-194 seen; higher is louder);
 * tone, the DSP tone-level word at 0x100A8 (e.g. 0x9108/0x9104/0x9100 for Keypad tones Level
 * 1/2/3; a lower low nibble is louder). Hosts map it to gain (loudness is not captured).
 */
export type StockSoundEvent =
  | {
      readonly output: "buzzer" | "tone";
      readonly atMs: number;
      /** > 0: sounding at this frequency (buzzer: 13 MHz / divider). */
      readonly hz: number;
      readonly volume: number;
    }
  | { readonly output: "buzzer" | "tone"; readonly atMs: number; readonly hz: null }
  | { readonly output: "vibrator"; readonly atMs: number; readonly on: boolean };

/** Plan 16: where the phone's sound goes. Events arrive in `atMs` order from `tick()`. */
export interface StockSoundPort {
  change(event: StockSoundEvent): void;
}
