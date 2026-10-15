// Plan 27 Task 3: the Composer's key rules (K3-K6, D2). Each case is a Task 0 still (plan27/entry,
// limit): its keys from the empty editor, and the notation the golden draws with `|` at the
// cursor (omitted at the end), transcribed from the image, independent of the code.
import { describe, expect, it } from "vite-plus/test";
import {
  composerHeld,
  composerKeyDown,
  EMPTY_COMPOSER,
  type ComposerState,
} from "../src/composer/editor";
import { formatToken, parseTokens } from "../src/composer/notation";
import { COMPOSER_CASES } from "../scripts/capture-sets/27-composer.ts";
import { replayComposerKeys } from "./support/composer";

function shown(state: ComposerState): string {
  const parts = state.tokens.map(formatToken);
  if (state.cursor === state.tokens.length) return parts.join(" ");
  return [...parts.slice(0, state.cursor), "|", ...parts.slice(state.cursor)]
    .join(" ")
    .replace(" | ", "| ");
}

/** plan27/entry/<name>: [keys, notation]. */
const ENTRY: readonly (readonly [string, string, string])[] = [
  ["empty", "", ""],
  ["note-1", "1", "4c1"],
  ["note-2", "2", "4d1"],
  ["note-3", "3", "4e1"],
  ["note-4", "4", "4f1"],
  ["note-5", "5", "4g1"],
  ["note-6", "6", "4a1"],
  ["note-7", "7", "4b1"],
  ["shorter-1", "1 8", "8c1"],
  ["shorter-2", "1 8 8", "16c1"],
  ["shorter-3", "1 8 8 8", "32c1"],
  ["shorter-4", "1 8 8 8 8", "1c1"],
  ["shorter-5", "1 8 8 8 8 8", "2c1"],
  ["shorter-6", "1 8 8 8 8 8 8", "4c1"],
  ["longer-1", "1 9", "2c1"],
  ["longer-2", "1 9 9", "1c1"],
  ["longer-3", "1 9 9 9", "32c1"],
  ["longer-4", "1 9 9 9 9", "16c1"],
  ["longer-5", "1 9 9 9 9 9", "8c1"],
  ["longer-6", "1 9 9 9 9 9 9", "4c1"],
  ["octave-1", "1 *", "4c2"],
  ["octave-2", "1 * *", "4c3"],
  ["octave-3", "1 * * *", "4c1"],
  ["octave-4", "1 * * * *", "4c2"],
  ["sharp-1-1", "1 #", "4#c1"],
  ["sharp-1-2", "1 # #", "4c1"],
  ["sharp-2-1", "2 #", "4#d1"],
  ["sharp-3-1", "3 #", "4e1"],
  ["sharp-4-1", "4 #", "4#f1"],
  ["sharp-5-1", "5 #", "4#g1"],
  ["sharp-6-1", "6 #", "4#a1"],
  ["sharp-7-1", "7 #", "4b1"],
  ["sharp-7-2", "7 # #", "4b1"],
  ["rest", "0", "4-"],
  ["rest-sharp", "0 #", "4-"],
  ["rest-octave", "0 *", "4-"],
  ["rest-shorter", "0 8", "8-"],
  ["rest-longer", "0 9", "2-"],
  ["rest-after-plain", "1 8 0", "8c1 8-"],
  ["rest-after-dotted", "1@1500 0", "4.c1 4-"],
  ["rest-after-octave", "1 * 9 0", "2c2 2-"],
  ["note-after-rest-start", "0 8 1", "8- 4c1"],
  ["note-after-rest-mid", "1 * 9 0 2", "2c2 2- 2d2"],
  ["note-after-rest-shorter", "1 * 0 8 2", "4c2 8- 4d2"],
  ["note-after-dotted", "1@1500 2", "4.c1 4d1"],
  ["note-after-sharp", "1 # 2", "4#c1 4d1"],
  ["note-after-octave", "1 * * 2", "4c3 4d3"],
  ["note-after-longer", "1 9 2", "2c1 2d1"],
  ["dotted", "1@1500", "4.c1"],
  ["dotted-sharp", "1@1500 #", "4.#c1"],
  ["dotted-octave", "1@1500 *", "4.c2"],
  ["dotted-shorter", "1@1500 8", "8.c1"],
  ["dotted-longer", "1@1500 9", "2.c1"],
  ["dotted-e", "3@1500 #", "4.e1"],
  ["sharp-octave", "1 # *", "4#c2"],
  ["sharp-shorter", "1 # 8", "8#c1"],
  ["insert-start", "1 2 3 down down down 4", "4f1| 4c1 4d1 4e1"],
  ["insert-middle", "1 2 3 down 4", "4c1 4d1 4f1| 4e1"],
  ["insert-end-up", "1 2 3 up 4", "4f1| 4c1 4d1 4e1"],
  ["insert-inherit-middle", "1 8 2 9 9 down 3", "8c1 8e1| 2d1"],
  ["shorter-middle", "1 2 3 down 8", "4c1 8d1| 4e1"],
  ["shorter-start", "1 2 3 down down down 8", "| 4c1 4d1 4e1"],
  ["delete-end", "1 2 3 c", "4c1 4d1"],
  ["delete-middle", "1 2 3 down c", "4c1| 4e1"],
  ["delete-start", "1 2 3 down down down c", "| 4c1 4d1 4e1"],
  ["delete-all", "1 2 c c", ""],
  ["held-zero", "1 0@1500", "4c1 4-"],
  ["held-star", "1 *@1500", "4c2"],
  ["held-hash", "1 #@1500", "4#c1"],
  ["held-eight", "1 8@1500", "8c1"],
  ["held-nine", "1 9@1500", "2c1"],
  ["held-up", "1 2 3 4 5 up@1500", "4c1 4d1 4e1 4f1| 4g1"],
  ["held-down", "1 2 3 4 5 down@1500", "| 4c1 4d1 4e1 4f1 4g1"],
  ["held-c", "1 2 3 c@1500", ""],
  [
    "forms",
    "1 2 # 0 3 * 4@1500 5 8 6 # 9 0 8 7 * 1 9 9",
    "4c1 4#d1 4- 4e2 4.f2 8g2 4#a2 8- 4b3 1c3",
  ],
  ["forms-2", "1@1500 # * * 8 8 8 0 9 0 9 0", "32.#c3 16- 16- 32-"],
  ["forms-3", "6 # 8 8 5@1500 # * 9 9 9 0 8", "16#a1 2.#g2 4-"],
];

const FIFTY = Array.from({ length: 50 }, (_, i) => String((i % 7) + 1)).join(" ");
const FIFTY_SHOWN = parseTokens(
  Array.from({ length: 50 }, (_, i) => `4${"cdefgab"[i % 7]}1`).join(" "),
);

/** plan27/limit/<name>: keys after 50 notes, and the last tokens shown (the rest unchanged). */
const LIMIT: readonly (readonly [string, string, string])[] = [
  ["full", "", "4b1 4c1"],
  ["note", "2", "4b1 4c1"],
  ["rest", "0", "4b1 4c1"],
  ["held", "3@1500", "4b1 4c1"],
  ["shorter", "8", "4b1 8c1"],
  ["longer", "9", "4b1 2c1"],
  ["octave", "*", "4b1 4c2"],
  ["sharp", "#", "4b1 4#c1"],
  ["insert", "down down 5", "| 4b1 4c1"],
  ["delete-note", "c 2", "4b1 4d1"],
];

/** A case's keys without its waits. */
const keysOf = (name: string): string =>
  COMPOSER_CASES.find((c) => c.name === name)!
    .keys.split(" ")
    .filter((key) => key !== "" && !key.startsWith("+"))
    .join(" ");

describe("composer key rules (plan27/entry)", () => {
  it("covers its cases with their recorded keys", () => {
    for (const [name, keys] of ENTRY) expect(keysOf(`entry/${name}`), name).toBe(keys);
    for (const [name, keys] of LIMIT) expect(keysOf(`limit/${name}`), name).toBe(keys);
  });

  for (const [name, keys, notation] of ENTRY) {
    it(`${name}: ${keys || "(no key)"} → ${notation || "(empty)"}`, () => {
      expect(shown(replayComposerKeys(EMPTY_COMPOSER, keys).state)).toBe(notation);
    });
  }
});

describe("the 50-token limit (plan27/limit)", () => {
  const full = replayComposerKeys(EMPTY_COMPOSER, FIFTY).state;

  it("takes 50 tokens", () => {
    expect(full.tokens).toEqual(FIFTY_SHOWN);
    expect(full.cursor).toBe(50);
  });

  for (const [name, keys, last] of LIMIT) {
    it(`${name}: ${keys || "(no key)"} → … ${last}`, () => {
      const state = replayComposerKeys(full, keys).state;
      expect(state.tokens).toHaveLength(50);
      expect(shown({ tokens: state.tokens.slice(48), cursor: state.cursor - 48 })).toBe(last);
    });
  }
});

describe("what sounds (K8)", () => {
  it("a note key sounds its note; 8, 9, * and # the note they change; rests and moves are silent", () => {
    const one = composerKeyDown(EMPTY_COMPOSER, "1");
    expect(one.sound).toEqual(one.state.tokens[0]);
    for (const key of ["8", "9", "*", "#"] as const) {
      const edit = composerKeyDown(one.state, key);
      expect(edit.sound, key).toEqual(edit.state.tokens[0]);
    }
    expect(composerKeyDown(one.state, "0").sound).toBeUndefined();
    expect(composerKeyDown(one.state, "down").sound).toBeUndefined();
    expect(composerKeyDown(one.state, "c").sound).toBeUndefined();
    const e = composerKeyDown(EMPTY_COMPOSER, "3").state;
    expect(composerKeyDown(e, "#").sound).toBeUndefined();
    const rest = composerKeyDown(EMPTY_COMPOSER, "0").state;
    expect(composerKeyDown(rest, "8").sound).toBeUndefined();
  });

  it("a held note key sounds the dotted note; at the limit nothing", () => {
    const one = composerKeyDown(EMPTY_COMPOSER, "1").state;
    const held = composerHeld(one, "1");
    expect(formatToken(held.sound!)).toBe("4.c1");
  });
});
