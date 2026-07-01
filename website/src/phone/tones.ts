/** A ringtone: composer notation + tempo. Ids are kebab-case of the
 *  label ("Nokia tune" → "nokia-tune", …); the Ringing tone picker app
 *  presents these labels on the handset. */
export interface ToneDef {
  id: string;
  label: string;
  notation: string;
  bpm: number;
}

export const TONES: readonly ToneDef[] = [
  {
    id: "nokia-tune",
    label: "Nokia tune",
    // Gran Vals (Tárrega), bars 13–16 — THE tune, 13 notes.
    notation: "8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1",
    bpm: 180,
  },
  {
    id: "ring-ring",
    label: "Ring ring",
    // Classic bell trill: two fast alternating high notes, pause, repeat.
    notation:
      "16c3 16d3 16c3 16d3 16c3 16d3 16c3 16d3 8- 16c3 16d3 16c3 16d3 16c3 16d3 16c3 16d3 2-",
    bpm: 200,
  },
  {
    id: "grande-valse",
    label: "Grande valse",
    // The same Gran Vals phrase at a statelier waltz tempo.
    notation: "8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1",
    bpm: 140,
  },
];
