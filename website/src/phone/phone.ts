import { createPhone, editorApp } from "@hellotimber/phone-core";
import type { AppFactory, Phone, PhoneKey } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import type { ScreenRenderer } from "@hellotimber/phone-screen";
import { chatMessages } from "../content/chat";
import { contactById, contacts } from "../content/contacts";
import { siteMenu } from "../content/menu";
import { cannedReply, MAX_HISTORY, MAX_SMS_CHARS } from "../messages/generate-reply";
import { ensureThread, receiveRecorded, sendRecorded, threadOf } from "../messages/store";
import { getSettings, updateSettings } from "../settings";
import { chatApps } from "./apps/chat";
import { pickerApp } from "./apps/picker-app";
import { smsApps } from "./apps/sms";
import { snakeApp } from "./apps/snake-app";
import { handleSound, playMessageAlert } from "./audio";
import { artToBitmap, SCREENSAVER_ART } from "./pixel-art";
import { toMenuNodes } from "./site-tree";
import { TONES } from "./tones";

export interface PhoneRuntime {
  phone: Phone;
  renderer: ScreenRenderer;
  /** Funnel for ALL key input (deviation 10): detects *#06# + tracks idle. */
  input(key: PhoneKey, action: "down" | "up"): void;
  /** True while the idle screensaver is showing. */
  isScreensaver(): boolean;
  /** True once *#06# has been entered — the SIM panel reveals the IMEI. */
  isImeiRevealed(): boolean;
}

let runtime: PhoneRuntime | null = null;

/** The phone instance smsApps' notice callback targets (set at runtime init). */
let phoneForNotice: Phone | null = null;

/**
 * Client side of POST /api/sms (plan 08): resolves to the contact's reply.
 * Never rejects — network/dev failures fall back to the canned replies, so
 * the handset always hears back. History is snapshotted synchronously here,
 * BEFORE the outbox record lands (see smsApps' send-then-record ordering).
 */
async function sendSms(contactId: string, text: string): Promise<string> {
  const contact = contactById(contactId);
  const history = threadOf(contactId)
    .slice(-MAX_HISTORY)
    .map((e) => ({ who: e.who, text: e.text }));
  try {
    const res = await fetch("/api/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, text, history }),
    });
    if (!res.ok) throw new Error(`sms ${res.status}`);
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || data.reply === "") throw new Error("empty reply");
    return data.reply.slice(0, MAX_SMS_CHARS);
  } catch {
    return contact !== undefined ? cannedReply(contact, history) : "OK.";
  }
}

function buildApps(): Record<string, AppFactory> {
  return {
    // Plan 08: the Write messages → To: → Sending chain (replaces the plan 01
    // bare editor registration).
    ...smsApps({
      contacts: contacts.map((c) => ({ id: c.id, name: c.name })),
      send: sendSms,
      recordSend: sendRecorded,
      recordReceive: receiveRecorded,
      notify: (n) => phoneForNotice?.setNotice(n),
      playAlert: playMessageAlert,
    }),
    // Plan 08: Chat (Menu 3) — the lachlan thread as a live session. Seeds
    // once from the testimonial content; chat traffic stays out of the
    // Inbox/Outbox lists ({ chat: true }).
    ...chatApps({
      nickname: "Lachlan",
      thread: () => threadOf("lachlan"),
      seed: () =>
        ensureThread(
          "lachlan",
          chatMessages.map((m) => ({ who: m.who, text: `${m.nickname}: ${m.text}` })),
        ),
      send: (text) => sendSms("lachlan", text),
      recordSend: (text) => sendRecorded("lachlan", text, { chat: true }),
      recordReceive: (text) => receiveRecorded("lachlan", text, { chat: true }),
      playAlert: playMessageAlert,
    }),
    snake: snakeApp(),
    // Tones / Settings option pickers (deviation 2 — patched in by id below).
    "keypad-tones": pickerApp({
      title: "Keypad tones",
      options: ["On", "Off"],
      selected: () => (getSettings().keypadTones ? 0 : 1),
      onPick: (i) => updateSettings({ keypadTones: i === 0 }),
    }),
    "ringing-tone": pickerApp({
      title: "Ringing tone",
      options: TONES.map((t) => t.label),
      selected: () =>
        Math.max(
          0,
          TONES.findIndex((t) => t.id === getSettings().ringtone),
        ),
      onPick: (i) => {
        const tone = TONES[i]!;
        updateSettings({ ringtone: tone.id });
        handleSound({ kind: "tone", id: tone.id }); // preview on pick
      },
    }),
    "screen-saver": pickerApp({
      title: "Screen saver",
      options: ["On", "Off"],
      selected: () => (getSettings().screenSaver ? 0 : 1),
      onPick: (i) => updateSettings({ screenSaver: i === 0 }),
    }),
    lights: pickerApp({
      title: "Lights",
      options: ["On", "Off"],
      selected: () => (getSettings().backlight ? 0 : 1),
      onPick: (i) => updateSettings({ backlight: i === 0 }),
    }),
    // editorApp has `initial` (plan 01 EditorOptions), so seed it with the
    // saved note rather than starting blank (improves on plan deviation 4).
    "welcome-note": editorApp({
      title: "Welcome note",
      initial: getSettings().welcomeNote,
      onAccept: (text) => updateSettings({ welcomeNote: text.trim() }),
    }),
  };
}

/** Registered app ids — every `app` node in the menu tree must use one of these. */
export const APP_IDS: string[] = Object.keys(buildApps());

/**
 * The one phone instance for the whole browser session. Client-only:
 * SSR must never construct it (guard every call site with typeof window).
 */
export function getPhoneRuntime(): PhoneRuntime {
  if (typeof window === "undefined") {
    throw new Error("getPhoneRuntime() is client-only; guard the call site with a browser check");
  }
  if (runtime !== null) return runtime;

  // Reduced motion → skip the boot animation entirely (a11y, deviation/Task 8).
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The one tree (plan 07): the data tree drives the handset directly —
  // working app nodes are declared in data, so no post-hoc patching.
  const phone = createPhone({
    menu: toMenuNodes(siteMenu),
    apps: buildApps(),
    carrier: "LACHLAN",
    clock: () => new Date().toTimeString().slice(0, 5), // 24h HH:MM
    ...(reduceMotion ? { bootMs: 0 } : {}),
  });
  phoneForNotice = phone; // sms reply notices target the live instance

  // 84×48 native canvas; NearestFilter upscaling happens on the 3D mesh.
  // The saved Welcome note shows during boot (deviation 5: renderer-lifetime).
  const renderer = createScreenRenderer({ welcomeText: getSettings().welcomeNote || "Welcome!" });
  renderer.render(phone.screen);
  phone.subscribe((snap) => renderer.render(snap.screen));

  // Call divert action nodes are literal redirects (VISION Menu 7).
  phone.on("action", (action) => {
    window.open(action.value, "_blank", "noopener,noreferrer");
  });

  // Key beeps (and future phone-core tones) — settings/mute applied inside.
  phone.on("sound", handleSound);

  // ── Easter eggs: *#06# IMEI + idle screensaver (deviations 9/10) ─────────
  const SCREENSAVER_IDLE_MS = 30_000;
  const screensaverFrame = artToBitmap(SCREENSAVER_ART);
  let lastTickMs = 0;
  let idleSinceMs = 0;
  let screensaverOn = false;
  let showImei = false;
  let recent = ""; // last few single-char keys, for *#06# detection

  /** The input funnel every key passes through (keyboard + 3D taps). */
  function input(key: PhoneKey, action: "down" | "up"): void {
    idleSinceMs = lastTickMs;
    if (screensaverOn) {
      // Any key dismisses the screensaver and is otherwise swallowed.
      if (action === "down") {
        screensaverOn = false;
        renderer.render(phone.screen);
      }
      return;
    }
    if (action === "down" && key.length === 1) {
      recent = (recent + key).slice(-5);
      if (recent === "*#06#") {
        showImei = true;
        phone.navigate("menu/sim-services");
      }
    }
    phone.send({ type: action, key });
  }

  // The machine's only clock: rAF-driven tick (boot animation, long presses,
  // multi-tap timeouts, app ticks all derive from this). Idle screensaver is
  // tracked here too.
  const loop = (now: number) => {
    lastTickMs = now;
    phone.tick(now);
    if (
      !screensaverOn &&
      getSettings().screenSaver &&
      phone.screen.kind === "standby" &&
      now - idleSinceMs > SCREENSAVER_IDLE_MS
    ) {
      screensaverOn = true;
      renderer.render({ kind: "custom", appId: "screensaver", frame: screensaverFrame });
    }
    requestAnimationFrame(loop);
  };

  // Power on at first visit. navigate("standby") while off leaves the phone
  // off (plan 01), so standby landings need an explicit power-on; deep links
  // retarget the boot (navigate-while-booting). pressKey advances the machine
  // clock ~1s past performance.now(), so boot holds frame 0 for ~1s — accepted.
  phone.tick(performance.now());
  idleSinceMs = performance.now();
  phone.pressKey("power", 1000);
  requestAnimationFrame(loop);

  runtime = {
    phone,
    renderer,
    input,
    isScreensaver: () => screensaverOn,
    isImeiRevealed: () => showImei,
  };
  return runtime;
}
