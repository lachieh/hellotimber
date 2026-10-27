import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { startPress } from "../src/press";

function record(pointerType: string) {
  const events: string[] = [];
  const press = startPress(pointerType, 100, 200, (action) => events.push(action));
  return { events, press };
}

describe("startPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits down at once for a mouse", () => {
    const { events, press } = record("mouse");
    expect(events).toEqual(["down"]);
    press.up();
    expect(events).toEqual(["down", "up"]);
  });

  it("emits down then up for a quick touch tap", () => {
    const { events, press } = record("touch");
    expect(events).toEqual([]);
    vi.advanceTimersByTime(40);
    press.up();
    expect(events).toEqual(["down", "up"]);
    vi.advanceTimersByTime(1000);
    expect(events).toEqual(["down", "up"]);
  });

  it("emits nothing for a touch swipe", () => {
    const { events, press } = record("touch");
    press.move(101, 205);
    press.move(100, 230);
    vi.advanceTimersByTime(1000);
    press.up();
    expect(events).toEqual([]);
  });

  it("emits nothing when the browser cancels a touch before the press", () => {
    const { events, press } = record("touch");
    vi.advanceTimersByTime(50);
    press.cancel();
    vi.advanceTimersByTime(1000);
    expect(events).toEqual([]);
  });

  it("emits down after a held touch, then up on release", () => {
    const { events, press } = record("touch");
    press.move(103, 204);
    vi.advanceTimersByTime(200);
    expect(events).toEqual(["down"]);
    press.move(100, 260); // moving after the press keeps it held
    vi.advanceTimersByTime(3000);
    expect(events).toEqual(["down"]);
    press.cancel();
    expect(events).toEqual(["down", "up"]);
  });
});
