import { afterEach, expect, it, vi } from "vite-plus/test";
import { WebAudioSound } from "../src/phone/stock-sound";
function audio() {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const gains: ReturnType<typeof gain>[] = [];
  function gain() {
    const node = { gain: param(), connect: vi.fn() };
    node.connect.mockReturnValue(node);
    return node;
  }
  const oscillators: {
    type: string;
    frequency: ReturnType<typeof param>;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const ctx = {
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: () => {
      const node = gain();
      gains.push(node);
      return node;
    },
    createOscillator: () => {
      const node = { type: "", frequency: param(), connect: vi.fn(), start: vi.fn() };
      node.connect.mockImplementation((n) => n);
      oscillators.push(node);
      return node;
    },
  };
  const constructor = vi.fn(function () {
    return ctx;
  });
  vi.stubGlobal("AudioContext", constructor);
  const vibrate = vi.fn();
  vi.stubGlobal("navigator", { vibrate });
  return { gains, oscillators, ctx, constructor, vibrate };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("starts once on gesture, schedules buzzer and both tone oscillators with register gains", () => {
  const { gains, oscillators, ctx, constructor } = audio();
  const sound = new WebAudioSound();
  expect(constructor).not.toHaveBeenCalled();
  sound.start();
  sound.start();
  expect(constructor).toHaveBeenCalledOnce();
  expect(ctx.resume).toHaveBeenCalledOnce();
  expect(oscillators.map((o) => o.type)).toEqual(["square", "sine", "sine"]);
  sound.phoneNow = 1000;
  sound.change({ output: "buzzer", atMs: 1200, hz: 440, volume: 16 });
  expect(oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10.23);
  expect(gains[1]?.gain.setValueAtTime).toHaveBeenCalledWith(0.1, 10.23);
  sound.change({ output: "tone", atMs: 1200, hz: 697, hz2: 1209, volume: 0x9100 });
  expect(oscillators[2]?.frequency.setValueAtTime).toHaveBeenCalledWith(1209, 10.23);
  expect(gains[2]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.06, 10.23);
  expect(gains[3]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0.06, 10.23);
  sound.change({ output: "tone", atMs: 1200, hz: 440, volume: 0x910f });
  expect(gains[2]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.23);
  expect(gains[3]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.23);
  sound.change({ output: "buzzer", atMs: 1200, hz: null });
  expect(gains[1]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.23);
});
it("mutes master gain and vibrator, including queued pulses", () => {
  vi.useFakeTimers();
  const { gains, vibrate } = audio();
  const sound = new WebAudioSound();
  sound.muted = true;
  sound.start();
  expect(gains[0]?.gain.value).toBe(0);
  sound.change({ output: "vibrator", atMs: 0, on: true });
  vi.advanceTimersByTime(30);
  expect(vibrate).not.toHaveBeenCalledWith(200);
  sound.muted = false;
  expect(gains[0]?.gain.value).toBe(1);
  sound.change({ output: "vibrator", atMs: 0, on: true });
  vi.advanceTimersByTime(30);
  expect(vibrate).toHaveBeenCalledWith(200);
  sound.change({ output: "vibrator", atMs: 1000, on: true });
  sound.muted = true;
  vibrate.mockClear();
  vi.advanceTimersByTime(1030);
  expect(vibrate).not.toHaveBeenCalledWith(200);
});
it("silences the second tone when a single tone or off follows DTMF", () => {
  const { gains } = audio();
  const sound = new WebAudioSound();
  sound.start();
  sound.change({ output: "tone", atMs: 0, hz: 697, hz2: 1209, volume: 0x9100 });
  sound.change({ output: "tone", atMs: 0, hz: 440, volume: 0x9104 });
  expect(gains[3]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.03);
  sound.change({ output: "tone", atMs: 0, hz: null });
  expect(gains[2]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10.03);
});

it("keeps vibration on until an off event", () => {
  vi.useFakeTimers();
  const { vibrate } = audio();
  const sound = new WebAudioSound();
  sound.change({ output: "vibrator", atMs: 0, on: true });
  vi.advanceTimersByTime(630);
  expect(vibrate.mock.calls.filter((call) => call[0] === 200).length).toBeGreaterThan(3);
  sound.change({ output: "vibrator", atMs: 0, on: false });
  vi.advanceTimersByTime(30);
  expect(vibrate).toHaveBeenLastCalledWith(0);
  vibrate.mockClear();
  vi.advanceTimersByTime(1000);
  expect(vibrate).not.toHaveBeenCalled();
});
