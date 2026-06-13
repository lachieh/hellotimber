import { createPhone, editorApp, nokia3310Menu } from "@hellotimber/phone-core";
import type { AppFactory, MenuNode, Phone } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import type { ScreenRenderer } from "@hellotimber/phone-screen";
import { content } from "../content";
import { getSettings, updateSettings } from "../settings";
import { pickerApp } from "./apps/picker-app";
import { snakeApp } from "./apps/snake-app";
import { handleSound } from "./audio";
import { TONES } from "./tones";

export interface PhoneRuntime {
  phone: Phone;
  renderer: ScreenRenderer;
}

let runtime: PhoneRuntime | null = null;

function buildApps(): Record<string, AppFactory> {
  return {
    // Plan 01 deviation note 2: the multi-tap editor is hosted as an app.
    "write-message": editorApp({ title: "Message:" }),
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

/**
 * Replace specific stub menu nodes with same-id `app`/`submenu` nodes so the
 * Tones / Settings picker apps are reachable on the handset (deviation 2 —
 * every path stays stable; phone-core is untouched).
 *
 * Reality note: `nokia3310Menu` ships `settings/phone-settings` as a stub
 * READER leaf, not a submenu, so patchNode can't descend into it. We replace
 * the whole `phone-settings` node with a submenu carrying Welcome note + Lights.
 */
function withWorkingSettings(tree: MenuNode[]): MenuNode[] {
  return patchNode(tree, {
    "tones/keypad-tones": {
      type: "app",
      id: "keypad-tones",
      label: "Keypad tones",
      appId: "keypad-tones",
    },
    "tones/ringing-tone": {
      type: "app",
      id: "ringing-tone",
      label: "Ringing tone",
      appId: "ringing-tone",
    },
    "tones/screen-saver": {
      type: "app",
      id: "screen-saver",
      label: "Screen saver",
      appId: "screen-saver",
    },
    "settings/phone-settings": {
      type: "submenu",
      id: "phone-settings",
      label: "Phone settings",
      children: [
        { type: "app", id: "welcome-note", label: "Welcome note", appId: "welcome-note" },
        { type: "app", id: "lights", label: "Lights", appId: "lights" },
      ],
    },
  });
}

/** Depth-first replace of menu nodes by full path (prefix defaults to "menu"). */
function patchNode(
  nodes: MenuNode[],
  swaps: Record<string, MenuNode>,
  prefix = "menu",
): MenuNode[] {
  return nodes.map((n) => {
    const path = `${prefix}/${n.id}`;
    if (swaps[path]) return swaps[path];
    if (n.type === "submenu") return { ...n, children: patchNode(n.children, swaps, path) };
    return n;
  });
}

/**
 * The one phone instance for the whole browser session. Client-only:
 * SSR must never construct it (guard every call site with typeof window).
 */
export function getPhoneRuntime(): PhoneRuntime {
  if (typeof window === "undefined") {
    throw new Error("getPhoneRuntime() is client-only; guard the call site with typeof window");
  }
  if (runtime !== null) return runtime;

  const phone = createPhone({
    menu: withWorkingSettings(nokia3310Menu(content)),
    apps: buildApps(),
    carrier: "LACHLAN",
    clock: () => new Date().toTimeString().slice(0, 5), // 24h HH:MM
  });

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

  // The machine's only clock: rAF-driven tick (boot animation, long presses,
  // multi-tap timeouts, app ticks all derive from this).
  const loop = (now: number) => {
    phone.tick(now);
    requestAnimationFrame(loop);
  };

  // Power on at first visit. navigate("standby") while off leaves the phone
  // off (plan 01), so standby landings need an explicit power-on; deep links
  // retarget the boot (navigate-while-booting). pressKey advances the machine
  // clock ~1s past performance.now(), so boot holds frame 0 for ~1s — accepted.
  phone.tick(performance.now());
  phone.pressKey("power", 1000);
  requestAnimationFrame(loop);

  runtime = { phone, renderer };
  return runtime;
}
