import { EditorApplication, PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import type { SnakeGame, SnakeState } from "@hellotimber/snake";
import { describe, expect, it } from "vite-plus/test";
import { ChatApplication } from "../src/phone/applications/chat";
import { ConfiguredEditorApplication } from "../src/phone/applications/editor";
import { PickerApplication } from "../src/phone/applications/picker";
import { SmsApplication } from "../src/phone/applications/sms";
import { SnakeApplication } from "../src/phone/applications/snake";

function press(session: PhoneApplicationSession, key: PhoneKey): void {
  session.onKey({ type: "down", key });
  session.onKey({ type: "up", key });
}

function contextHarness(): {
  context: ApplicationContext;
  opened: PhoneApplication[];
  exits: () => number;
} {
  const opened: PhoneApplication[] = [];
  let exits = 0;
  return {
    context: { open: (application) => opened.push(application), exit: () => (exits += 1) },
    opened,
    exits: () => exits,
  };
}

function fakeSnake(): { game: SnakeGame; state: SnakeState; ticks: () => number } {
  const state: SnakeState = {
    cols: 21,
    rows: 10,
    snake: [
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ],
    dir: "right",
    pendingDir: null,
    food: { x: 10, y: 5 },
    bonus: null,
    foodsEaten: 0,
    score: 0,
    level: 1,
    maze: 0,
    walls: [],
    status: "running",
    flashOn: true,
  };
  let ticks = 0;
  return {
    state,
    ticks: () => ticks,
    game: {
      get state() {
        return state;
      },
      dispatch() {},
      tick() {
        ticks += 1;
        return true;
      },
      pause() {
        state.status = "paused";
      },
      resume() {
        state.status = "running";
      },
      reset() {},
    },
  };
}

describe("website object application definitions", () => {
  it("creates fresh picker sessions and reads the selected value only at launch", () => {
    let selected = 1;
    const picks: number[] = [];
    const application = new PickerApplication("keypad-tones", {
      title: "Keypad tones",
      options: ["On", "Off"],
      selected: () => selected,
      onPick: (index) => picks.push(index),
    });
    const firstContext = contextHarness();
    const first = application.createSession(firstContext.context);
    selected = 0;
    const second = application.createSession(contextHarness().context);

    expect(first.render()).toMatchObject({ kind: "list", selected: 1 });
    expect(second.render()).toMatchObject({ kind: "list", selected: 0 });
    press(first, "navi");
    expect(picks).toEqual([1]);
    expect(firstContext.exits()).toBe(1);
  });

  it("keeps one Snake game at definition scope but tick accumulation per session", () => {
    const snake = fakeSnake();
    let creations = 0;
    const application = new SnakeApplication({
      speed: 1,
      createGame: () => {
        creations += 1;
        return snake.game;
      },
      topScore: { read: () => 0, write() {} },
    });
    const first = application.createSession(contextHarness().context);
    first.tick(300);
    const second = application.createSession(contextHarness().context);
    second.tick(300);

    expect(creations).toBe(1);
    expect(snake.ticks()).toBe(0);
    first.tick(245);
    expect(snake.ticks()).toBe(1);
  });

  it("uses private object definitions for the SMS recipient and sending stages", () => {
    const application = new SmsApplication({
      contacts: [{ id: "ada", name: "Ada" }],
      send: () => Promise.resolve("Reply"),
      recordSend() {},
      recordReceive() {},
      notify() {},
      playAlert() {},
      schedule() {},
    });
    const rootContext = contextHarness();
    const compose = application.createSession(rootContext.context);
    press(compose, "4");
    press(compose, "navi");
    press(compose, "navi");

    expect(rootContext.opened).toHaveLength(1);
    expect(rootContext.opened[0]).toBeInstanceOf(PhoneApplication);
    expect(rootContext.opened[0]).not.toBe(application);
    const recipientContext = contextHarness();
    const recipient = rootContext.opened[0]!.createSession(recipientContext.context);
    expect(recipient.render()).toMatchObject({ kind: "list", title: "To:" });
    press(recipient, "navi");
    expect(recipientContext.opened).toHaveLength(1);
    expect(recipientContext.opened[0]).not.toBe(rootContext.opened[0]);
  });

  it("delivers an SMS reply after UI deactivation without navigating through a stale context", async () => {
    const scheduled: (() => void | Promise<void>)[] = [];
    const received: string[] = [];
    const application = new SmsApplication({
      contacts: [{ id: "ada", name: "Ada" }],
      send: () => Promise.resolve("Still delivered"),
      recordSend() {},
      recordReceive: (_contactId, text) => received.push(text),
      notify() {},
      playAlert() {},
      schedule: (fn) => scheduled.push(fn),
    });
    const composeContext = contextHarness();
    const compose = application.createSession(composeContext.context);
    press(compose, "4");
    press(compose, "navi");
    press(compose, "navi");
    const recipientContext = contextHarness();
    const recipient = composeContext.opened[0]!.createSession(recipientContext.context);
    press(recipient, "navi");
    const sendingContext = contextHarness();
    const sending = recipientContext.opened[0]!.createSession(sendingContext.context);

    sending.onDeactivate?.("navigate");
    await scheduled[0]!();

    expect(received).toEqual(["Still delivered"]);
    expect(sendingContext.opened).toEqual([]);
    expect(sendingContext.exits()).toBe(0);
  });

  it("uses a private Chat compose definition and returns to its private session definition", () => {
    const application = new ChatApplication({
      nickname: "Lachlan",
      thread: () => [],
      seed() {},
      send: () => Promise.resolve("Reply"),
      recordSend() {},
      recordReceive() {},
      playAlert() {},
      schedule() {},
    });
    const sessionContext = contextHarness();
    const session = application.createSession(sessionContext.context);
    press(session, "navi");
    const composeDefinition = sessionContext.opened[0]!;
    expect(composeDefinition).toBeInstanceOf(PhoneApplication);
    expect(composeDefinition).not.toBe(application);

    const composeContext = contextHarness();
    const compose = composeDefinition.createSession(composeContext.context);
    press(compose, "c");
    expect(composeContext.opened).toHaveLength(1);
    expect(composeContext.opened[0]).not.toBe(application);
    expect(composeContext.opened[0]).not.toBe(composeDefinition);
  });

  it("re-reads website editor configuration for each fresh core editor session", () => {
    let initial = "First";
    const application = new ConfiguredEditorApplication("welcome-note", {
      title: "Welcome note",
      initial: () => initial,
      onAccept() {},
    });
    const first = application.createSession(contextHarness().context);
    initial = "Second";
    const second = application.createSession(contextHarness().context);
    expect(first.render()).toMatchObject({ kind: "editor", text: "First" });
    expect(second.render()).toMatchObject({ kind: "editor", text: "Second" });
  });

  it("imports and constructs all definitions in SSR without starting effects", async () => {
    const calls: string[] = [];
    const modules = await Promise.all([
      import("../src/phone/applications/calculator"),
      import("../src/phone/applications/chat"),
      import("../src/phone/applications/editor"),
      import("../src/phone/applications/picker"),
      import("../src/phone/applications/sms"),
      import("../src/phone/applications/snake"),
    ]);
    const [calculator, chat, editor, picker, sms, snake] = modules;
    new calculator.CalculatorApplication();
    new picker.PickerApplication("picker", {
      title: "Picker",
      options: ["One"],
      selected: () => (calls.push("selected"), 0),
      onPick: () => calls.push("pick"),
    });
    new snake.SnakeApplication({
      createGame: () => (calls.push("game"), fakeSnake().game),
      topScore: {
        read: () => (calls.push("read-score"), 0),
        write: () => calls.push("write-score"),
      },
    });
    new sms.SmsApplication({
      contacts: [],
      send: () => (calls.push("sms-send"), Promise.resolve("")),
      recordSend: () => calls.push("sms-record"),
      recordReceive: () => calls.push("sms-receive"),
      notify: () => calls.push("sms-notify"),
      playAlert: () => calls.push("sms-alert"),
      schedule: () => calls.push("sms-schedule"),
    });
    new chat.ChatApplication({
      nickname: "Chat",
      thread: () => (calls.push("thread"), []),
      seed: () => calls.push("seed"),
      send: () => (calls.push("chat-send"), Promise.resolve("")),
      recordSend: () => calls.push("chat-record"),
      recordReceive: () => calls.push("chat-receive"),
      playAlert: () => calls.push("chat-alert"),
      schedule: () => calls.push("chat-schedule"),
    });
    new editor.ConfiguredEditorApplication("editor", {
      title: "Editor",
      initial: () => (calls.push("initial"), ""),
    });

    expect(calls).toEqual([]);
    expect(typeof window).toBe("undefined");
  });

  it("instantiates editor, picker, SMS, and Chat sessions with object application contexts", () => {
    const editor = new EditorApplication("editor", { title: "Editor" }).createSession(
      contextHarness().context,
    );
    expect(editor.render()).toMatchObject({ kind: "editor", title: "Editor" });

    const picker = new PickerApplication("picker", {
      title: "Picker",
      options: ["One"],
      onPick() {},
    }).createSession(contextHarness().context);
    expect(picker.render()).toMatchObject({ kind: "list", title: "Picker" });

    const sms = new SmsApplication({
      contacts: [{ id: "ada", name: "Ada" }],
      send: () => Promise.resolve(""),
      recordSend() {},
      recordReceive() {},
      notify() {},
      playAlert() {},
      schedule() {},
    });
    const smsContext = contextHarness();
    const compose = sms.createSession(smsContext.context);
    press(compose, "4");
    press(compose, "navi");
    press(compose, "navi");
    expect(smsContext.opened).toHaveLength(1);
    expect(smsContext.opened[0]!.createSession(contextHarness().context).render()).toMatchObject({
      kind: "list",
      title: "To:",
    });

    const chat = new ChatApplication({
      nickname: "Chat",
      thread: () => [],
      seed() {},
      send: () => Promise.resolve(""),
      recordSend() {},
      recordReceive() {},
      playAlert() {},
      schedule() {},
    });
    const chatContext = contextHarness();
    const chatSession = chat.createSession(chatContext.context);
    press(chatSession, "navi");
    expect(chatContext.opened).toHaveLength(1);
    expect(chatContext.opened[0]!.createSession(contextHarness().context).render()).toMatchObject({
      kind: "editor",
      title: "Chat:",
    });
  });
});
