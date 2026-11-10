import { describe, expect, it } from "vite-plus/test";
import {
  MAX_EFFECTS_PER_REPLY,
  MAX_NOTES_PER_REPLY,
  MAX_SESSION_MS,
  createRandom,
  localGame,
  unpackFrame,
  type GameContext,
  type GameKey,
  type GameSession,
  type GameWake,
} from "../src/index";
import {
  COUNTER_MANIFEST,
  FONTS,
  probeGame,
  startOf,
  type ProbeScript,
} from "./support/counter-game";

function play(script: ProbeScript = {}, start = startOf()) {
  const probe = probeGame(script);
  const session = localGame(probe.definition).start(start, FONTS);
  return { session, calls: probe.calls };
}

/** Only the `update@…` entries of a call log, as times. */
function updates(calls: readonly string[]): number[] {
  return calls.filter((call) => call.startsWith("update@")).map((call) => Number(call.slice(7)));
}

describe("localGame", () => {
  it("validates the definition's manifest and exposes the checked copy", () => {
    const module = localGame(probeGame().definition);
    expect(module.manifest).toEqual(COUNTER_MANIFEST);
    expect(Object.isFrozen(module.manifest)).toBe(true);
    expect(() => localGame(probeGame({ manifest: { id: "Not Kebab" } }).definition)).toThrow(
      "Invalid game manifest: id",
    );
  });

  it("creates the instance and calls update(0), then draw", () => {
    const { session, calls } = play({ update: () => 250 });
    expect(calls).toEqual(["update@0", "draw"]);
    expect(session.wake()).toBe(250);
    expect(session.failure).toBeUndefined();
  });

  it("runs separate sessions from one module", () => {
    const probe = probeGame({ update: () => 100 });
    const module = localGame(probe.definition);
    const first = module.start(startOf(), FONTS);
    const second = module.start(startOf(), FONTS);
    first.advance(100);
    expect(first.wake()).toBe(200);
    expect(second.wake()).toBe(100);
  });
});

describe("wakes", () => {
  // A schedule off any grid: 100, 33, 250, 12.5 (rounds up to 13) and 5 (raised to 10) ms.
  const DELAYS = [100, 33, 250, 12.5, 5];
  const scripted = (): ProbeScript => {
    let call = 0;
    return { update: () => DELAYS[call++ % DELAYS.length]! };
  };
  const EXPECTED = [0, 100, 133, 383, 396, 406, 506, 539, 789, 802, 812, 912, 945];

  it("runs update at exactly the times asked for", () => {
    const { session, calls } = play(scripted());
    session.advance(945);
    expect(updates(calls)).toEqual(EXPECTED);
    expect(session.wake()).toBe(1195);
  });

  it.each([1, 17, 1000])("gives the same calls when the host advances every %i ms", (stepMs) => {
    const reference = play(scripted());
    reference.session.advance(3000);

    const { session, calls } = play(scripted());
    for (let now = stepMs; now <= 3000; now += stepMs) session.advance(now);
    session.advance(3000);
    expect(calls).toEqual(reference.calls);
    expect(updates(calls).slice(0, EXPECTED.length)).toEqual(EXPECTED);
    expect(session.wake()).toBe(reference.session.wake());
    expect(session.frame()).toEqual(reference.session.frame());
  });

  it("does not run a wake before its time", () => {
    const { session, calls } = play({ update: () => 100 });
    session.advance(99);
    expect(updates(calls)).toEqual([0]);
    session.advance(100);
    expect(updates(calls)).toEqual([0, 100]);
    session.advance(100);
    expect(updates(calls)).toEqual([0, 100]);
  });

  it("never calls a sleeping game from advance", () => {
    const { session, calls } = play();
    expect(session.wake()).toBeNull();
    calls.length = 0;
    for (let now = 1; now <= 5000; now += 7) session.advance(now);
    expect(calls).toEqual([]);
    expect(session.wake()).toBeNull();
  });

  it.each([
    [0, 10],
    [3, 10],
    [9.99, 10],
    [10, 10],
    [10.2, 11],
    [99.5, 100],
    [2500, 2500],
  ])("turns a delay of %f ms into a wake %i ms on", (delay, expected) => {
    const { session, calls } = play({ update: () => delay });
    expect(session.wake()).toBe(expected);
    session.advance(expected);
    expect(updates(calls)).toEqual([0, expected]);
    expect(session.wake()).toBe(expected * 2);
  });

  it.each([
    ["negative", -1],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
    ["missing", undefined],
    ["text", "100"],
  ])("fails the session on a %s delay from update", (_name, delay) => {
    const { session, calls } = play({ update: () => delay as GameWake });
    expect(session.failure).toMatch(/^wake: /);
    expect(session.wake()).toBeNull();
    expect(calls).toEqual(["update@0"]);
  });

  it("fails the session on a malformed delay from a key", () => {
    const { session } = play({ update: () => 100, keyDown: () => -5 });
    session.keyDown("5", 20);
    expect(session.failure).toMatch(/^wake: /);
    expect(session.wake()).toBeNull();
  });
});

describe("keys", () => {
  it("replaces the pending wake with a key's delay, measured from the key", () => {
    const { session, calls } = play({ update: () => 1000, keyDown: () => 50 });
    session.keyDown("5", 200);
    expect(session.wake()).toBe(250);
    session.advance(1000);
    expect(updates(calls)).toEqual([0, 250]);
  });

  it("sleeps on null from a key", () => {
    const { session, calls } = play({ update: () => 1000, keyDown: () => null });
    session.keyDown("5", 200);
    expect(session.wake()).toBeNull();
    session.advance(5000);
    expect(updates(calls)).toEqual([0]);
  });

  it("keeps the pending wake when a key returns nothing", () => {
    const { session, calls } = play({
      update: () => 1000,
      keyDown: () => undefined,
      keyUp: () => undefined,
    });
    session.keyDown("5", 200);
    session.keyUp("5", 300);
    expect(session.wake()).toBe(1000);
    session.advance(1000);
    expect(updates(calls)).toEqual([0, 1000]);
  });

  it("lets a key wake a sleeping game, and a release reschedule", () => {
    const { session } = play({ keyDown: () => 30, keyUp: () => 75.5 });
    session.keyDown("2", 400);
    expect(session.wake()).toBe(430);
    session.keyUp("2", 410);
    expect(session.wake()).toBe(486);
  });

  it("raises a key's delay to the minimum too", () => {
    const { session } = play({ keyDown: () => 0 });
    session.keyDown("2", 400);
    expect(session.wake()).toBe(410);
  });

  it("runs a wake due at the key's ms before the key", () => {
    const { session, calls } = play({ update: () => 100, keyDown: () => undefined });
    session.keyDown("5", 100);
    expect(calls).toEqual(["update@0", "draw", "update@100", "draw", "down 5@100", "draw"]);
  });

  it("runs every wake due before a key, each at its own time", () => {
    const { session, calls } = play({
      update: () => 100,
      keyDown: () => undefined,
      keyUp: () => undefined,
    });
    session.keyDown("up", 250);
    session.keyUp("up", 420);
    expect(calls.filter((call) => call !== "draw")).toEqual([
      "update@0",
      "update@100",
      "update@200",
      "down up@250",
      "update@300",
      "update@400",
      "up up@420",
    ]);
  });

  it("delivers every game key", () => {
    const keys: GameKey[] = [
      "up",
      "down",
      "*",
      "#",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ];
    const { session, calls } = play({ keyDown: () => undefined, keyUp: () => undefined });
    calls.length = 0;
    keys.forEach((key, i) => session.keyDown(key, i));
    keys.forEach((key, i) => session.keyUp(key, 100 + i));
    expect(calls.filter((call) => call !== "draw")).toEqual([
      ...keys.map((key, i) => `down ${key}@${i}`),
      ...keys.map((key, i) => `up ${key}@${100 + i}`),
    ]);
  });

  it("delivers a release only of a key that is down, and a key-down once", () => {
    const { session, calls } = play({ keyDown: () => undefined, keyUp: () => undefined });
    calls.length = 0;
    session.keyUp("5", 10);
    session.keyDown("5", 20);
    session.keyDown("5", 30);
    session.keyUp("5", 40);
    session.keyUp("5", 50);
    expect(calls).toEqual(["down 5@20", "draw", "up 5@40", "draw"]);
  });

  it("still runs the due wakes for a key it does not deliver", () => {
    const { session, calls } = play({ update: () => 100, keyUp: () => undefined });
    session.keyUp("5", 250);
    expect(updates(calls)).toEqual([0, 100, 200]);
  });

  it("makes no call for a key the game has no handler for", () => {
    const { session, calls } = play({ update: () => 100 });
    session.keyDown("5", 20);
    session.keyUp("5", 30);
    expect(calls).toEqual(["update@0", "draw"]);
    expect(session.wake()).toBe(100);
  });

  it("refuses a key that is not a game key (a host bug)", () => {
    const { session } = play({ keyDown: () => undefined });
    expect(() => session.keyDown("select" as GameKey, 10)).toThrow("select");
    expect(() => session.keyUp("c" as GameKey, 10)).toThrow('"c"');
  });
});

describe("session time", () => {
  it("requires non-decreasing whole milliseconds of the host", () => {
    const { session, calls } = play({ update: () => 100, keyDown: () => undefined });
    session.advance(50);
    expect(() => session.advance(49)).toThrow("49");
    expect(() => session.keyDown("5", 10)).toThrow("10");
    expect(() => session.keyUp("5", 0)).toThrow("0");
    expect(() => session.advance(60.5)).toThrow("60.5");
    expect(() => session.advance(Number.NaN)).toThrow("NaN");
    expect(session.failure).toBeUndefined();
    session.advance(50);
    session.keyDown("5", 50);
    expect(calls).toEqual(["update@0", "draw", "down 5@50", "draw"]);
  });

  it("fails `clock` when the session reaches MAX_SESSION_MS", () => {
    const { session, calls } = play({ keyDown: () => undefined });
    session.advance(MAX_SESSION_MS - 1);
    expect(session.failure).toBeUndefined();
    session.keyDown("5", MAX_SESSION_MS);
    expect(session.failure).toBe("clock");
    expect(calls).toEqual(["update@0", "draw"]);
  });

  it("runs the wakes before the limit, then fails `clock`", () => {
    const { session, calls } = play({ update: (now) => (now === 0 ? MAX_SESSION_MS - 5 : 1000) });
    session.advance(MAX_SESSION_MS + 10);
    expect(updates(calls)).toEqual([0, MAX_SESSION_MS - 5]);
    expect(session.failure).toBe("clock");
    expect(session.wake()).toBeNull();
  });
});

describe("drawing", () => {
  it("draws after every update, key-down and key-up", () => {
    const { session, calls } = play({
      update: () => 100,
      keyDown: () => undefined,
      keyUp: () => undefined,
    });
    session.keyDown("5", 40);
    session.keyUp("5", 60);
    session.advance(100);
    expect(calls).toEqual([
      "update@0",
      "draw",
      "down 5@40",
      "draw",
      "up 5@60",
      "draw",
      "update@100",
      "draw",
    ]);
  });

  it("gives the packed frame, kept between draws", () => {
    let x = 0;
    const { session } = play({
      update: () => 100,
      draw: (screen) => screen.set(x++, 0),
    });
    session.advance(200);
    const pixels = unpackFrame(session.frame()!);
    expect([...pixels.subarray(0, 4)]).toEqual([1, 1, 1, 0]);
    expect(session.frame()!.length).toBe(504);
  });

  it("changes frame() only when the pixels change", () => {
    let lit = false;
    const { session } = play({
      update: () => 100,
      keyDown: () => {
        lit = !lit;
        return undefined;
      },
      draw: (screen) => {
        screen.clear();
        if (lit) screen.fill(10, 10, 4, 4);
      },
    });
    const blank = session.frame();
    expect(blank).toBeDefined();
    session.advance(300);
    expect(session.frame()).toBe(blank);
    session.keyDown("5", 310);
    const lighted = session.frame();
    expect(lighted).not.toBe(blank);
    expect(blank![0]).toBe(0);
    session.advance(500);
    expect(session.frame()).toBe(lighted);
  });
});

describe("the context", () => {
  it("gives the game its start, its fonts and a copy of the saved bytes", () => {
    let seen: GameContext | undefined;
    const storage = Uint8Array.of(1, 2, 3);
    const start = startOf({ mode: "quick", level: 4, choices: { step: 1 }, topScore: 77, storage });
    play(
      {
        create: (ctx) => {
          seen = ctx;
          ctx.start.storage[0] = 99;
        },
      },
      start,
    );
    expect(seen!.start).toEqual({ ...start, storage: Uint8Array.of(99, 2, 3) });
    expect(seen!.fonts).toBe(FONTS);
    expect(storage[0]).toBe(1);
  });

  it("refuses a start whose saved bytes are over the manifest's quota (a host bug)", () => {
    const probe = probeGame();
    expect(() =>
      localGame(probe.definition).start(startOf({ storage: new Uint8Array(5) }), FONTS),
    ).toThrow("storage");
  });

  it("seeds random with mulberry32 over start.seed", () => {
    const drawn: number[] = [];
    const { session } = play(
      { update: (_now, ctx) => (drawn.push(ctx.random(), ctx.random()), 100) },
      startOf({ seed: 44530 }),
    );
    session.advance(100);
    const reference = createRandom(44530);
    expect(drawn).toEqual([reference(), reference(), reference(), reference()]);
  });

  it("stamps each effect with the ms of the call that made it, in order", () => {
    const tune = { notes: [{ hz: 440, ms: 100 }] };
    const { session } = play({
      create: (ctx) => ctx.vibrate(5),
      update: (now, ctx) => {
        if (now === 150) ctx.sound("crash");
        return 150;
      },
      keyDown: (_key, _now, ctx) => {
        ctx.sound("eat");
        ctx.sound(tune);
        ctx.vibrate(40);
        return undefined;
      },
      keyUp: (_key, _now, ctx) => void ctx.save(Uint8Array.of(7)),
    });
    session.keyDown("5", 150);
    session.keyUp("5", 163);
    expect(session.drain()).toEqual([
      { kind: "vibrate", at: 0, ms: 5 },
      { kind: "sound", at: 150, sound: "crash" },
      { kind: "sound", at: 150, sound: "eat" },
      { kind: "sound", at: 150, sound: tune },
      { kind: "vibrate", at: 150, ms: 40 },
      { kind: "save", at: 163, bytes: Uint8Array.of(7) },
    ]);
    expect(session.drain()).toEqual([]);
  });

  it("copies what an effect carries, so the game cannot change it afterwards", () => {
    const bytes = Uint8Array.of(1, 2);
    const notes = [{ hz: 440, ms: 100 }];
    const { session } = play({
      create: (ctx) => {
        ctx.save(bytes);
        ctx.sound({ notes });
        bytes[0] = 9;
        notes[0] = { hz: 1, ms: 1 };
      },
    });
    expect(session.drain()).toEqual([
      { kind: "save", at: 0, bytes: Uint8Array.of(1, 2) },
      { kind: "sound", at: 0, sound: { notes: [{ hz: 440, ms: 100 }] } },
    ]);
  });

  it("saves up to storageBytes and refuses more without failing", () => {
    const saved: boolean[] = [];
    const { session } = play({
      create: (ctx) => {
        saved.push(
          ctx.save(new Uint8Array(4)),
          ctx.save(new Uint8Array(5)),
          ctx.save(new Uint8Array(0)),
        );
      },
    });
    expect(saved).toEqual([true, false, true]);
    expect(session.failure).toBeUndefined();
    expect(session.drain().map((effect) => effect.kind === "save" && effect.bytes.length)).toEqual([
      4, 0,
    ]);
  });

  it("saves nothing for a game without storage", () => {
    const saved: boolean[] = [];
    const { session } = play({
      manifest: { storageBytes: undefined },
      create: (ctx) => void saved.push(ctx.save(Uint8Array.of(1)), ctx.save(new Uint8Array(0))),
    });
    expect(saved).toEqual([false, true]);
    expect(session.drain().length).toBe(1);
  });

  it("ignores a context used outside a call", () => {
    let kept: GameContext | undefined;
    const { session } = play({ create: (ctx) => void (kept = ctx) });
    kept!.sound("eat");
    kept!.vibrate(10);
    expect(kept!.save(Uint8Array.of(1))).toBe(false);
    kept!.over(3);
    expect(session.drain()).toEqual([]);
    expect(session.failure).toBeUndefined();
  });
});

describe("over", () => {
  const ending = (): ProbeScript => ({
    update: (now, ctx) => {
      if (now === 200) ctx.over(1234);
      return 100;
    },
    keyDown: () => 10,
    keyUp: () => 10,
    draw: (screen) => screen.invert(0, 0, 84, 48),
  });

  it("ends the session after the call, which still draws", () => {
    const { session, calls } = play(ending());
    session.advance(200);
    expect(calls.slice(-2)).toEqual(["update@200", "draw"]);
    expect(session.drain()).toEqual([{ kind: "over", at: 200, score: 1234 }]);
    expect(session.wake()).toBeNull();
    expect(session.failure).toBeUndefined();
  });

  it("ignores every call after over", () => {
    const { session, calls } = play(ending());
    session.advance(200);
    const frame = session.frame();
    const count = calls.length;
    session.advance(5000);
    session.keyDown("5", 5001);
    session.keyUp("5", 5002);
    // Not even the host's clock is checked any more.
    session.advance(10);
    expect(calls.length).toBe(count);
    expect(session.frame()).toBe(frame);
    expect(session.wake()).toBeNull();
    expect(session.drain().length).toBe(1);
  });

  it("does not run the wakes after the one that ended the game", () => {
    const { session, calls } = play(ending());
    session.advance(1000);
    expect(updates(calls)).toEqual([0, 100, 200]);
  });

  it("carries no score when the game gives none", () => {
    const { session } = play({
      manifest: { scores: false, menu: [COUNTER_MANIFEST.menu[0]!] },
      keyDown: (_key, _now, ctx) => {
        ctx.over();
        return undefined;
      },
    });
    session.keyDown("#", 90);
    expect(session.drain()).toEqual([{ kind: "over", at: 90, score: undefined }]);
  });

  it("keeps the effects made after over in the same call", () => {
    const { session } = play({
      create: (ctx) => {
        ctx.over(0);
        ctx.sound("crash");
      },
    });
    expect(session.drain().map((effect) => effect.kind)).toEqual(["over", "sound"]);
    expect(session.failure).toBeUndefined();
    expect(session.wake()).toBeNull();
  });

  it.each([
    ["a second over", (ctx: GameContext) => (ctx.over(1), ctx.over(2))],
    ["a fractional score", (ctx: GameContext) => ctx.over(1.5)],
    ["a negative score", (ctx: GameContext) => ctx.over(-1)],
    ["a score past the limit", (ctx: GameContext) => ctx.over(MAX_SESSION_MS + 1)],
    ["a score that is not a number", (ctx: GameContext) => ctx.over("9" as unknown as number)],
  ])("fails on %s", (_name, misuse) => {
    const { session } = play({
      keyDown: (_key, _now, ctx) => {
        misuse(ctx);
        return undefined;
      },
    });
    session.keyDown("5", 10);
    expect(session.failure).toMatch(/^effect: /);
    expect(session.drain()).toEqual([]);
  });

  it("accepts the largest score", () => {
    const { session } = play({ create: (ctx) => ctx.over(MAX_SESSION_MS) });
    expect(session.drain()).toEqual([{ kind: "over", at: 0, score: MAX_SESSION_MS }]);
  });
});

describe("failures", () => {
  const misuses: readonly (readonly [string, (ctx: GameContext) => void])[] = [
    ["an unknown sound", (ctx) => ctx.sound("beep" as "eat")],
    ["notes that are not a list", (ctx) => ctx.sound({ notes: 440 as unknown as [] })],
    ["a fractional pitch", (ctx) => ctx.sound({ notes: [{ hz: 440.5, ms: 100 }] })],
    ["a zero pitch", (ctx) => ctx.sound({ notes: [{ hz: 0, ms: 100 }] })],
    ["a fractional note length", (ctx) => ctx.sound({ notes: [{ hz: 440, ms: 0.5 }] })],
    ["a negative note length", (ctx) => ctx.sound({ notes: [{ hz: 440, ms: -100 }] })],
    ["a note that is not an object", (ctx) => ctx.sound({ notes: [null as never] })],
    ["a fractional vibration", (ctx) => ctx.vibrate(12.5)],
    ["a zero vibration", (ctx) => ctx.vibrate(0)],
    ["an infinite vibration", (ctx) => ctx.vibrate(Number.POSITIVE_INFINITY)],
    ["saved bytes that are not a Uint8Array", (ctx) => void ctx.save([1, 2] as never)],
  ];

  it.each(misuses)("throws inside the game on %s, and fails the session", (_name, misuse) => {
    let thrown: unknown;
    const { session, calls } = play({
      update: () => 100,
      keyDown: (_key, _now, ctx) => {
        ctx.sound("eat");
        try {
          misuse(ctx);
        } catch (error) {
          thrown = error;
          throw error;
        }
        return undefined;
      },
    });
    session.keyDown("5", 30);
    expect(thrown).toBeInstanceOf(Error);
    expect(session.failure).toMatch(/^effect: /);
    // The failed call's effects are dropped, it is not drawn, and the game is not called again.
    expect(session.drain()).toEqual([]);
    expect(session.wake()).toBeNull();
    session.advance(1000);
    expect(calls).toEqual(["update@0", "draw", "down 5@30"]);
  });

  it("fails even when the game swallows the error", () => {
    const { session } = play({
      keyDown: (_key, _now, ctx) => {
        try {
          ctx.vibrate(-1);
        } catch {
          // A game cannot hide a broken effect.
        }
        return undefined;
      },
    });
    session.keyDown("5", 30);
    expect(session.failure).toMatch(/^effect: /);
  });

  it("accepts any number, pitch and length of notes below the per-call bound", () => {
    const notes = Array.from({ length: 500 }, (_, i) => ({ hz: 20 + i * 40, ms: 60_000 }));
    const { session } = play({
      create: (ctx) => {
        ctx.sound({ notes });
        ctx.sound({ notes: [] });
        ctx.vibrate(3_600_000);
      },
    });
    expect(session.failure).toBeUndefined();
    expect(session.drain().length).toBe(3);
  });

  it("bounds the effects of one call, not of the session (D19)", () => {
    const burst = (count: number): ProbeScript => ({
      update: (_now, ctx) => {
        for (let i = 0; i < count; i++) ctx.vibrate(1);
        return 100;
      },
    });
    const within = play(burst(MAX_EFFECTS_PER_REPLY));
    within.session.advance(100);
    expect(within.session.failure).toBeUndefined();
    expect(within.session.drain().length).toBe(2 * MAX_EFFECTS_PER_REPLY);

    const over = play(burst(MAX_EFFECTS_PER_REPLY + 1));
    expect(over.session.failure).toMatch(/^limit: /);
    expect(over.session.drain()).toEqual([]);
  });

  it("bounds the notes of one call (D19)", () => {
    const half = Array.from({ length: MAX_NOTES_PER_REPLY / 2 }, () => ({ hz: 440, ms: 10 }));
    const tunes = (extra: number): ProbeScript => ({
      create: (ctx) => {
        ctx.sound({ notes: half });
        ctx.sound({ notes: half });
        if (extra > 0) ctx.sound({ notes: half.slice(0, extra) });
      },
    });
    expect(play(tunes(0)).session.failure).toBeUndefined();
    expect(play(tunes(1)).session.failure).toMatch(/^limit: /);
  });

  it.each([
    [
      "create",
      {
        create: () => {
          throw new Error("boom");
        },
      },
    ],
    [
      "update",
      {
        update: () => {
          throw new Error("boom");
        },
      },
    ],
    [
      "draw",
      {
        draw: () => {
          throw new Error("boom");
        },
      },
    ],
  ] as const)("fails when %s throws", (_name, script) => {
    const { session } = play(script);
    expect(session.failure).toBe("game: boom");
    expect(session.wake()).toBeNull();
    session.advance(100);
    session.keyDown("5", 200);
    expect(session.failure).toBe("game: boom");
  });

  it("fails when a key handler throws something that is not an Error, and stops", () => {
    const { session, calls } = play({
      update: () => 100,
      keyDown: () => {
        // eslint-disable-next-line no-throw-literal
        throw "oops";
      },
    });
    session.keyDown("5", 50);
    expect(session.failure).toBe("game: oops");
    const count = calls.length;
    session.advance(1000);
    session.keyUp("5", 1100);
    expect(calls.length).toBe(count);
  });

  it("fails when create returns no instance", () => {
    const probe = probeGame();
    const session = localGame({
      manifest: probe.definition.manifest,
      create: () => ({ update: () => null }) as never,
    }).start(startOf(), FONTS);
    expect(session.failure).toMatch(/^game: /);
  });

  it("keeps the effects of the calls before the one that failed", () => {
    const { session } = play({
      update: (now, ctx) => {
        ctx.vibrate(20);
        if (now === 100) throw new Error("late");
        return 100;
      },
    });
    session.advance(100);
    expect(session.failure).toBe("game: late");
    expect(session.drain()).toEqual([{ kind: "vibrate", at: 0, ms: 20 }]);
  });
});

describe("dispose", () => {
  it("stops the session, and can be called again", () => {
    const { session, calls } = play({ update: () => 100, keyDown: () => undefined });
    const dispose = (target: GameSession) => target.dispose();
    dispose(session);
    dispose(session);
    expect(session.wake()).toBeNull();
    session.advance(1000);
    session.keyDown("5", 1001);
    expect(calls).toEqual(["update@0", "draw"]);
    expect(session.failure).toBeUndefined();
  });
});
