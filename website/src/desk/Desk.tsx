import { LONG_PRESS_MS } from "@hellotimber/phone-core";
import type { PhoneKey } from "@hellotimber/phone-core";
import type { ReactNode } from "react";
import { site } from "../content/site";
import { holdPhoneKey, tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "./live";
import "./desk.css";

/** "Left on the desk, 2001": the phone put down among a teenager's things, which carry the info. */
export default function Desk({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  return (
    <div className="desk">
      <div className="d01-desk">
        <DeskGrain />
        <div className="d01-window-light" aria-hidden="true" />

        <section className="d01-phone" aria-label="The phone">
          <div className="d01-phone__shadow" aria-hidden="true" />
          <div className="d01-phone__stage">{phone}</div>
        </section>

        <p className="d01-more" aria-hidden="true">
          more on the desk
          <ScribbleArrow />
        </p>

        <StickyNote path={live.path} screenText={live.screenText} />
        <NotebookStrip path={live.path} screenText={live.screenText} />
        <Walkman />
        <PencilCase />
        <TextSpeakCard />
        <TopUpCard />
        <Biro />
      </div>
    </div>
  );
}

/* ── contextual hint ─────────────────────────────────────────────────────── */

function hintFor(path: string, screenText: string): string {
  if (screenText.startsWith("Phone off")) return "it's off. Hold P to switch it on";
  if (screenText.startsWith("Starting up")) return "it's starting up, give it a sec";
  if (path === "standby") return "press Menu (Enter)";
  if (path === "menu") return "up/down to flick through, Enter to open one";
  if (path.startsWith("menu/games/snake")) return "Enter to play, steer with 2 4 6 8";
  return "Enter to pick, Esc to go back";
}

/* ── sticky note: the key legend ─────────────────────────────────────────── */

function StickyNote({ path, screenText }: { path: string; screenText: string }) {
  return (
    <section className="d01-obj d01-sticky" aria-labelledby="d01-sticky-title">
      <h2 id="d01-sticky-title" className="d01-sticky__title">
        how to work it
        <Squiggle />
      </h2>
      <ul className="d01-legend">
        <li>
          <span className="d01-legend__keys">
            <Key k="up" label="Press scroll up">
              <ChevronIcon dir="up" />
            </Key>
            <Key k="down" label="Press scroll down">
              <ChevronIcon dir="down" />
            </Key>
          </span>
          <span>arrow keys scroll</span>
        </li>
        <li>
          <span className="d01-legend__keys">
            <Key k="navi" label="Press Menu, the NaviKey" className="d01-key--navi">
              Menu
            </Key>
          </span>
          <span>Enter = select</span>
        </li>
        <li>
          <span className="d01-legend__keys">
            <Key k="c" label="Press C, back">
              C
            </Key>
          </span>
          <span>Esc or Backspace = back</span>
        </li>
        <li className="d01-legend__pad-row">
          <span className="d01-legend__pad" role="group" aria-label="Keypad">
            {PAD.map((k) => (
              <Key key={k} k={k} label={`Press ${k}`} className="d01-key--pad">
                {k}
              </Key>
            ))}
          </span>
          <span>0–9, * and # type like the real thing</span>
        </li>
        <li>
          <span className="d01-legend__keys">
            <PowerKey />
          </span>
          <span>hold P = power</span>
        </li>
      </ul>
      <p className="d01-sticky__tap">or just tap the phone&rsquo;s own keys</p>
      <p className="d01-sticky__hint" aria-live="polite">
        <ScribbleArrow className="d01-sticky__hint-arrow" />
        <span>now: {hintFor(path, screenText)}</span>
      </p>
    </section>
  );
}

const PAD: PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function Key({
  k,
  label,
  className = "",
  children,
}: {
  k: PhoneKey;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`d01-key ${className}`}
      aria-label={label}
      onClick={() => {
        tapPhoneKey(k);
      }}
    >
      {children}
    </button>
  );
}

/** Power only acts on a long press, so this key holds it down past LONG_PRESS_MS. */
function PowerKey() {
  return (
    <button
      type="button"
      className="d01-key d01-key--power"
      aria-label="Hold power"
      onClick={() => {
        holdPhoneKey("power", "down");
        window.setTimeout(() => {
          holdPhoneKey("power", "up");
        }, LONG_PRESS_MS + 150);
      }}
    >
      <PowerIcon />
    </button>
  );
}

/* ── torn notebook strip: the live screen, copied out by hand ────────────── */

function NotebookStrip({ path, screenText }: { path: string; screenText: string }) {
  return (
    <section className="d01-obj d01-strip" aria-labelledby="d01-strip-title">
      <div className="d01-strip__paper" style={{ clipPath: TORN_EDGE }}>
        <h2 id="d01-strip-title" className="d01-strip__title">
          on the screen
        </h2>
        <p className="d01-strip__lcd" key={screenText}>
          &ldquo;{screenText}&rdquo;
        </p>
        <p className="d01-strip__path">
          at <code key={path}>{path}</code>
        </p>
        <p className="d01-strip__score" aria-hidden="true">
          snake hi 1452!!
        </p>
      </div>
    </section>
  );
}

/** A ragged bottom edge, fixed so it never jitters between renders. */
const TORN_EDGE = (() => {
  const points = ["0% 0%", "100% 0%"];
  let seed = 11;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let x = 100; x >= 0; x -= 2.5) {
    points.push(`${x}% calc(100% - ${(rand() * 9).toFixed(1)}px)`);
  }
  return `polygon(${points.join(", ")})`;
})();

/* ── Walkman: Sound and Lights slide switches ────────────────────────────── */

function Walkman() {
  const settings = useSettings();
  return (
    <section className="d01-obj d01-walkman" aria-labelledby="d01-walkman-title">
      <h2 id="d01-walkman-title" className="d01-sr">
        Phone sound and lights
      </h2>
      <WalkmanCord />
      <div className="d01-walkman__body">
        <div className="d01-walkman__window" aria-hidden="true">
          <Reel />
          <span className="d01-walkman__tape" />
          <Reel />
        </div>
        <p className="d01-walkman__brand" aria-hidden="true">
          stereo cassette player
        </p>
        <div className="d01-walkman__switches">
          <Slide
            label="Sound"
            on={!settings.muted}
            onToggle={() => {
              updateSettings({ muted: !settings.muted });
            }}
          />
          <Slide
            label="Lights"
            on={settings.backlight}
            onToggle={() => {
              updateSettings({ backlight: !settings.backlight });
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Slide({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="d01-slide"
      data-on={on}
      onClick={onToggle}
    >
      <span className="d01-slide__label">{label}</span>
      <span className="d01-slide__track" aria-hidden="true">
        <span className="d01-slide__knob" />
      </span>
      <span className="d01-slide__state" aria-hidden="true">
        <span>off</span>
        <span>on</span>
      </span>
    </button>
  );
}

/* ── pencil case: whose phone it is ──────────────────────────────────────── */

function PencilCase() {
  return (
    <section className="d01-obj d01-case" aria-labelledby="d01-case-name">
      <div className="d01-case__zip" aria-hidden="true">
        <span className="d01-case__pull" />
      </div>
      <h2 id="d01-case-name" className="d01-case__tape">
        {site.name}
      </h2>
      <p className="d01-case__job">{site.jobTitle}</p>
      <p className="d01-case__tagline">{site.tagline}</p>
      <ul className="d01-case__links">
        {site.sameAs.map((href) => (
          <li key={href}>
            <a href={href} rel="me noreferrer" target="_blank">
              {href.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── decorative period objects ───────────────────────────────────────────── */

function TextSpeakCard() {
  return (
    <section className="d01-obj d01-txt" aria-labelledby="d01-txt-title">
      <h2 id="d01-txt-title" className="d01-txt__title">
        txt spk
      </h2>
      <dl className="d01-txt__list">
        {TXT_SPEAK.map(([short, long]) => (
          <div key={short}>
            <dt>{short}</dt>
            <dd>{long}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const TXT_SPEAK: [string, string][] = [
  ["gr8", "great"],
  ["l8r", "later"],
  ["cu", "see you"],
  ["2nite", "tonight"],
  ["b4", "before"],
  ["wan2", "want to"],
  ["thx", "thanks"],
];

function TopUpCard() {
  return (
    <div className="d01-obj d01-topup" aria-hidden="true">
      <p className="d01-topup__word">top-up</p>
      <p className="d01-topup__sub">prepaid airtime voucher</p>
      <p className="d01-topup__scratch">
        <span>4821 0937 5560</span>
      </p>
      <p className="d01-topup__fine">scratch gently. dial the number on the back.</p>
    </div>
  );
}

function Biro() {
  return (
    <svg className="d01-biro" viewBox="0 0 400 28" aria-hidden="true">
      <rect x="40" y="6" width="300" height="16" rx="3" fill="#e9eef2" fillOpacity="0.72" />
      <rect x="40" y="12" width="300" height="4" fill="#ffffff" fillOpacity="0.8" />
      <rect x="40" y="18" width="300" height="3" fill="#8a9aa6" fillOpacity="0.35" />
      <rect x="44" y="12.5" width="292" height="3" fill="#2a3a9c" fillOpacity="0.55" />
      <path d="M340 8 L372 12 L392 14 L372 16 L340 20 Z" fill="#f2f2ee" />
      <path d="M372 12 L392 14 L372 16 Z" fill="#c8c1a8" />
      <circle cx="393" cy="14" r="1.6" fill="#1d2f8f" />
      <rect x="4" y="5" width="44" height="18" rx="4" fill="#2338a8" />
      <rect x="22" y="1" width="40" height="5" rx="2" fill="#2338a8" />
      <rect x="4" y="11" width="44" height="3" fill="#ffffff" fillOpacity="0.25" />
    </svg>
  );
}

/* ── drawn bits ──────────────────────────────────────────────────────────── */

function DeskGrain() {
  return (
    <svg className="d01-grain" aria-hidden="true" preserveAspectRatio="none">
      <filter id="d01-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0028 0.11" numOctaves="4" seed="7" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.34  0 0 0 0 0.18  0 0 0 0 0.06  1.9 0 0 0 -0.78"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#d01-grain)" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true">
      <path
        d={dir === "up" ? "M4 13.5 L10 6.5 L16 13.2" : "M4 6.8 L10 13.5 L16 6.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true">
      <path
        d="M6.4 5.6 A6.2 6.2 0 1 0 13.7 5.7 M10.1 2.6 L10 9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Squiggle() {
  return (
    <svg
      className="d01-squiggle"
      viewBox="0 0 160 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M2 6 C 20 2, 30 9, 50 5 S 85 2, 105 6 S 140 8, 158 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScribbleArrow({ className = "d01-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M8 6 C 10 16, 14 24, 28 30 M20 32 L29 30.5 L26 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Reel() {
  return (
    <svg className="d01-reel" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#3a2a22" />
      <circle cx="20" cy="20" r="9" fill="#efe9dc" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect
          key={deg}
          x="18.6"
          y="11"
          width="2.8"
          height="4.5"
          fill="#3a2a22"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
    </svg>
  );
}

function WalkmanCord() {
  return (
    <svg className="d01-walkman__cord" viewBox="0 0 160 260" aria-hidden="true">
      <rect x="113" y="236" width="14" height="24" rx="3" fill="#2a2725" />
      <rect x="117" y="228" width="6" height="10" fill="#b9b4a8" />
      <path
        d="M120 228 C 120 170, 30 180, 50 110 S 150 40, 96 -20"
        fill="none"
        stroke="#1d1b1a"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
