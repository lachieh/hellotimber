import type { PhoneKey } from "@hellotimber/phone-core";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { site } from "../../content/site";
import { holdPhoneKey, tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "../live";
import "./surround.css";

/**
 * Where each callout's leader line meets the phone. Units are the phone stage's height:
 * x from the stage centre, y from its vertical centre (the camera scales the phone by height).
 */
interface Part {
  n: number;
  name: string;
  side: "left" | "right";
  /** The callout's heading line, in stage-height units from the centre. */
  y: number;
  anchor: readonly [number, number];
}

const PARTS = {
  power: { n: 1, name: "Power key", side: "right", y: -0.36, anchor: [0.0, -0.428] },
  display: { n: 2, name: "Display", side: "left", y: -0.22, anchor: [-0.118, -0.13] },
  navi: { n: 3, name: "Navi key", side: "right", y: -0.06, anchor: [0.02, 0.058] },
  c: { n: 4, name: "C key", side: "left", y: 0.03, anchor: [-0.097, 0.094] },
  scroll: { n: 5, name: "Scroll keys", side: "right", y: 0.2, anchor: [0.086, 0.104] },
  keypad: { n: 6, name: "Keypad", side: "left", y: 0.245, anchor: [-0.112, 0.245] },
} satisfies Record<string, Part>;

type PartId = keyof typeof PARTS;
const PART_IDS = Object.keys(PARTS) as PartId[];

/** Half-width of the stage in height units (the stage is 1.3 times as wide as it is tall). */
const HALF_W = 0.65;
/** Where the leader lines end and the callout text begins. */
const LEADER_X = 0.29;

const KEYPAD_KEYS: PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const PART_OF_KEY: Partial<Record<PhoneKey, PartId>> = {
  power: "power",
  navi: "navi",
  c: "c",
  up: "scroll",
  down: "scroll",
};

export default function Surround({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  const settings = useSettings();
  const [pressed, setPressed] = useState<PartId | null>(null);
  const clear = useRef<number | undefined>(undefined);

  const flash = (part: PartId) => {
    window.clearTimeout(clear.current);
    setPressed(part);
    clear.current = window.setTimeout(() => {
      setPressed(null);
    }, 420);
  };
  useEffect(() => () => window.clearTimeout(clear.current), []);

  const press = (key: PhoneKey) => {
    flash(PART_OF_KEY[key] ?? "keypad");
  };

  const step = currentStep(live.path, live.screenText);

  return (
    <div className="sr-user-guide">
      <div className="ug-page">
        <section className="ug-spread" aria-labelledby="ug-title">
          <header className="ug-head">
            <h1 id="ug-title">Your phone</h1>
            <p>
              Keys and parts. Press a key on the phone, a key named in this guide or a key on your
              keyboard.
            </p>
          </header>

          <div className="ug-stage">
            <div className="ug-phone">{phone}</div>
            <Leaders pressed={pressed} />
            <div className="ug-callouts">
              {PART_IDS.map((id) => (
                <Callout key={id} id={id} onPress={press} />
              ))}
            </div>
          </div>

          <ol className="ug-legend" aria-label="Keys and parts">
            {PART_IDS.map((id) => (
              <li key={id} value={PARTS[id].n}>
                <CalloutBody id={id} onPress={press} />
              </li>
            ))}
          </ol>

          <footer className="ug-folio" aria-hidden="true">
            <span className="ug-folio-num">3</span>
            <span>Your phone</span>
          </footer>
        </section>

        <aside className="ug-side" aria-label="Using the phone">
          <section aria-labelledby="ug-start">
            <h2 id="ug-start">Getting started</h2>
            <ol className="ug-steps">
              {STEPS.map((s, i) => {
                const state = i < step ? "done" : i === step ? "current" : "todo";
                return (
                  <li
                    key={s.title}
                    className={`ug-step is-${state}`}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span className="ug-step-n" aria-hidden="true">
                      {state === "done" ? <Tick /> : i + 1}
                    </span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section id="ug-display" aria-labelledby="ug-display-h">
            <h2 id="ug-display-h">Display</h2>
            <p className="ug-lcd" aria-live="off">
              {live.screenText}
            </p>
            <dl className="ug-where">
              <dt>You are at</dt>
              <dd>
                <code>{live.path}</code>
              </dd>
            </dl>
          </section>

          <section aria-labelledby="ug-settings">
            <h2 id="ug-settings">Settings</h2>
            <div className="ug-settings">
              <Toggle
                label="Sound"
                on={!settings.muted}
                onChange={(on) => updateSettings({ muted: !on })}
              />
              <Toggle
                label="Lights"
                on={settings.backlight}
                onChange={(on) => updateSettings({ backlight: on })}
              />
            </div>
          </section>

          <section className="ug-colophon" aria-labelledby="ug-owner">
            <p className="ug-owner-lead">This phone belongs to</p>
            <h2 id="ug-owner">{site.name}</h2>
            <p className="ug-role">{site.jobTitle}</p>
            <p className="ug-tagline">{site.tagline}</p>
            <ul className="ug-links">
              {site.sameAs.map((url) => (
                <li key={url}>
                  <a href={url} rel="me noopener" target="_blank">
                    {linkLabel(url)}
                  </a>
                </li>
              ))}
            </ul>
            <p className="ug-imprint">hellotimber</p>
          </section>
        </aside>

        <nav className="ug-tabs" aria-hidden="true">
          {["Safety", "Your phone", "Basic functions", "Menu", "Games"].map((t) => (
            <span key={t} className={t === "Your phone" ? "is-current" : undefined}>
              {t}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ── Callouts ──────────────────────────────────────────────────────────── */

function Callout({ id, onPress }: { id: PartId; onPress: (key: PhoneKey) => void }) {
  const part = PARTS[id];
  const style = {
    top: `${(0.5 + part.y) * 100}%`,
    [part.side]: "0",
    width: `${((HALF_W - LEADER_X - 0.035) / (2 * HALF_W)) * 100}%`,
  };
  return (
    <div className={`ug-callout is-${part.side}`} style={style}>
      <CalloutBody id={id} onPress={onPress} />
    </div>
  );
}

function CalloutBody({ id, onPress }: { id: PartId; onPress: (key: PhoneKey) => void }) {
  const name = PARTS[id].name;
  switch (id) {
    case "power":
      return (
        <>
          <KeyButton phoneKey="power" onPress={onPress} label={name} />
          <p>Press and hold to switch the phone on or off.</p>
          <Keys>
            hold <kbd>P</kbd>
          </Keys>
        </>
      );
    case "display":
      return (
        <>
          <h3>{name}</h3>
          <p>
            The word on the bottom line is what the Navi key does now.{" "}
            <a href="#ug-display">Read the display as text</a>.
          </p>
        </>
      );
    case "navi":
      return (
        <>
          <KeyButton phoneKey="navi" onPress={onPress} label={name} />
          <p>Press to carry out the function shown above it: Menu, Select or OK.</p>
          <Keys>
            <kbd>Enter</kbd>
          </Keys>
        </>
      );
    case "c":
      return (
        <>
          <KeyButton phoneKey="c" onPress={onPress} label={name} />
          <p>
            Press to clear a character or go back one level. Press and hold to return to the start
            screen.
          </p>
          <Keys>
            <kbd>Backspace</kbd> or <kbd>Esc</kbd>
          </Keys>
        </>
      );
    case "scroll":
      return (
        <>
          <h3>{name}</h3>
          <p>Scroll through menus, lists and messages.</p>
          <div className="ug-keyrow">
            <KeyButton phoneKey="up" onPress={onPress} label="Scroll up" compact>
              <Arrow dir="up" />
            </KeyButton>
            <KeyButton phoneKey="down" onPress={onPress} label="Scroll down" compact>
              <Arrow dir="down" />
            </KeyButton>
            <Keys>
              <kbd aria-label="Up arrow">
                <Arrow dir="up" />
              </kbd>{" "}
              <kbd aria-label="Down arrow">
                <Arrow dir="down" />
              </kbd>
            </Keys>
          </div>
        </>
      );
    case "keypad":
      return (
        <>
          <h3>{name}</h3>
          <p>Key in numbers and letters. In a menu, key in its number to go straight to it.</p>
          <div className="ug-keypad">
            {KEYPAD_KEYS.map((k) => (
              <KeyButton key={k} phoneKey={k} onPress={onPress} label={k} compact />
            ))}
          </div>
          <Keys>
            <kbd>0</kbd>–<kbd>9</kbd>, <kbd>*</kbd>, <kbd>#</kbd>
          </Keys>
        </>
      );
  }
}

/**
 * A key on paper that presses the phone's key: held for as long as the pointer is down
 * (so press-and-hold works), tapped when activated from the keyboard.
 */
function KeyButton({
  phoneKey,
  label,
  onPress,
  compact = false,
  children,
}: {
  phoneKey: PhoneKey;
  label: string;
  onPress: (key: PhoneKey) => void;
  compact?: boolean;
  children?: ReactNode;
}) {
  const held = useRef(false);
  const release = () => {
    if (!held.current) return;
    held.current = false;
    holdPhoneKey(phoneKey, "up");
  };
  return (
    <button
      type="button"
      className={compact ? "ug-key is-compact" : "ug-key"}
      aria-label={compact && children !== undefined ? label : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        holdPhoneKey(phoneKey, "down");
        onPress(phoneKey);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onClick={(e) => {
        // Pointer presses were handled on pointerdown; detail 0 is a keyboard activation.
        if (e.detail !== 0) return;
        tapPhoneKey(phoneKey);
        onPress(phoneKey);
      }}
    >
      {children ?? label}
    </button>
  );
}

function Keys({ children }: { children: ReactNode }) {
  return (
    <p className="ug-keys">
      <span className="ug-keys-label">Keyboard</span> {children}
    </p>
  );
}

/* ── Leader lines (drawn in stage-height units) ────────────────────────── */

function Leaders({ pressed }: { pressed: PartId | null }) {
  return (
    <svg
      className="ug-leaders"
      viewBox={`${-HALF_W} -0.5 ${2 * HALF_W} 1`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {PART_IDS.map((id) => {
        const p = PARTS[id];
        const s = p.side === "left" ? -1 : 1;
        const [ax, ay] = p.anchor;
        const end = s * LEADER_X;
        const elbow = s * (LEADER_X - 0.05);
        return (
          <g key={id} className={pressed === id ? "ug-leader is-pressed" : "ug-leader"}>
            <polyline
              points={`${ax},${ay} ${elbow},${p.y} ${end},${p.y}`}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <circle className="ug-anchor" cx={ax} cy={ay} r={0.0055} />
            <circle className="ug-badge" cx={end} cy={p.y} r={0.019} />
            <text x={end} y={p.y} textAnchor="middle" dominantBaseline="middle">
              {p.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Getting started ───────────────────────────────────────────────────── */

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Switch the phone on",
    body: (
      <>
        Press and hold the power key until the display lights up, then wait for the start screen.
        Keyboard: hold <kbd>P</kbd>.
      </>
    ),
  },
  {
    title: "Open the menu",
    body: (
      <>
        At the start screen, press the Navi key under the word Menu. Keyboard: <kbd>Enter</kbd>.
      </>
    ),
  },
  {
    title: "Scroll and select",
    body: (
      <>
        Scroll to a function with the scroll keys and press Select, or key in the function's number.
        Keyboard: arrow keys, then <kbd>Enter</kbd>.
      </>
    ),
  },
  {
    title: "Go further, or back",
    body: (
      <>
        Scroll and select to go further in. Press C to go back one level; press and hold C to return
        to the start screen. Keyboard: <kbd>Backspace</kbd> or <kbd>Esc</kbd>.
      </>
    ),
  },
];

/** The step the visitor is on, from the live path: off/booting, standby, the main menu, deeper. */
function currentStep(path: string, screenText: string): number {
  if (screenText === "Phone off." || screenText === "Starting up.") return 0;
  if (path === "standby") return 1;
  if (path === "menu") return 2;
  return 3;
}

/* ── Settings ──────────────────────────────────────────────────────────── */

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="ug-toggle"
      aria-pressed={on}
      onClick={() => {
        onChange(!on);
      }}
    >
      <span className="ug-toggle-label">{label}</span>
      <span className="ug-switch" aria-hidden="true">
        <span className={on ? "is-active" : undefined}>On</span>
        <span className={on ? undefined : "is-active"}>Off</span>
      </span>
    </button>
  );
}

/* ── Small drawings ────────────────────────────────────────────────────── */

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg className="ug-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path d={dir === "up" ? "M2 8 6 3.5 10 8Z" : "M2 4 6 8.5 10 4Z"} />
    </svg>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.4 5 8.8 9.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}
