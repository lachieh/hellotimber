import type { PhoneKey } from "@hellotimber/phone-core";
import type { ReactNode } from "react";
import { site } from "../../content/site";
import { tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "../live";
import "./surround.css";

export default function Surround({ phone }: { phone: ReactNode }) {
  return (
    <div className="sr-back-pages">
      <header className="bp-masthead">
        <h1 className="bp-masthead__title">{site.name}&rsquo;s 3310</h1>
        <p className="bp-masthead__strap">Tones · Logos · Picture messages · One working phone</p>
        <OperatorLogo className="bp-masthead__logo" />
      </header>

      <section className="bp-well" aria-label="The phone">
        {phone}
      </section>

      <div className="bp-col bp-col--left">
        <ControlsAd />
        <LogoAd />
        <TuneAd />
      </div>

      <div className="bp-col bp-col--right">
        <NowPlayingAd />
        <SoundLightsAd />
        <WhoseAd />
        <SnakeAd />
      </div>

      <TonesStrip />
    </div>
  );
}

/* ── Get the controls ─────────────────────────────────────────────────────── */

const DIGITS: readonly PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function KeyButton({
  phoneKey,
  label,
  className = "",
  children,
}: {
  phoneKey: PhoneKey;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`bp-key ${className}`}
      aria-label={`Press ${label}`}
      onClick={() => {
        tapPhoneKey(phoneKey);
      }}
    >
      {children}
    </button>
  );
}

function ControlsAd() {
  return (
    <article className="bp-ad bp-ad--magenta bp-controls" aria-labelledby="bp-controls-h">
      <h2 id="bp-controls-h" className="bp-ad__head">
        Get the controls
      </h2>
      <Starburst />
      <ul className="bp-legend">
        <li>
          <KeyButton phoneKey="navi" label="Menu (NaviKey)" className="bp-key--navi">
            Menu
          </KeyButton>
          <span className="bp-legend__keys">
            <kbd>Enter</kbd>
          </span>
          <span className="bp-legend__what">Menu, select</span>
        </li>
        <li>
          <KeyButton phoneKey="c" label="C (back)" className="bp-key--c">
            C
          </KeyButton>
          <span className="bp-legend__keys">
            <kbd>Esc</kbd> <kbd>Bksp</kbd>
          </span>
          <span className="bp-legend__what">Back, clear</span>
        </li>
        <li>
          <span className="bp-legend__pair">
            <KeyButton phoneKey="up" label="scroll up">
              <Chevron dir="up" />
            </KeyButton>
            <KeyButton phoneKey="down" label="scroll down">
              <Chevron dir="down" />
            </KeyButton>
          </span>
          <span className="bp-legend__keys">
            <kbd>Up</kbd> <kbd>Down</kbd>
          </span>
          <span className="bp-legend__what">Scroll</span>
        </li>
        <li>
          <KeyButton phoneKey="power" label="power">
            <PowerGlyph />
          </KeyButton>
          <span className="bp-legend__keys">
            <kbd>P</kbd>
          </span>
          <span className="bp-legend__what">Switch on, off</span>
        </li>
      </ul>
      <div className="bp-pad">
        <div className="bp-pad__grid" role="group" aria-label="Number keys">
          {DIGITS.map((d) => (
            <KeyButton key={d} phoneKey={d} label={d === "*" ? "star" : d === "#" ? "hash" : d}>
              {d}
            </KeyButton>
          ))}
        </div>
        <p className="bp-pad__note">
          Number keys, <kbd>*</kbd> and <kbd>#</kbd> on your keyboard type straight into the phone.
          Steer Snake with 2, 4, 6, 8. On a touch screen, tap the keys on the phone itself.
        </p>
      </div>
    </article>
  );
}

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="bp-glyph">
      <path
        d={dir === "up" ? "M3 10.5 8 5.5l5 5" : "M3 5.5 8 10.5l5-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
    </svg>
  );
}

function PowerGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="bp-glyph">
      <path
        d="M5 4.3A5 5 0 1 0 11 4.3M8 2v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Starburst() {
  const points: string[] = [];
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 38;
    const a = (Math.PI * i) / spikes;
    points.push(`${(50 + r * Math.sin(a)).toFixed(1)},${(50 - r * Math.cos(a)).toFixed(1)}`);
  }
  return (
    <div className="bp-burst" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <polygon points={points.join(" ")} />
      </svg>
      <span>
        Tap
        <br />a key!
      </span>
    </div>
  );
}

/* ── Now playing ──────────────────────────────────────────────────────────── */

function hintFor(path: string, screenText: string): string {
  if (screenText.startsWith("Phone off")) return "Press P to switch the phone on.";
  if (screenText.startsWith("Starting up")) return "Starting up. Give it a few seconds.";
  if (path === "standby") return "Press Menu: hit Enter.";
  if (path.includes("snake")) return "Steer with 2, 4, 6, 8. C to quit.";
  if (path === "menu") return "Scroll with the arrows, Enter to open, Esc to leave.";
  return "Arrows scroll, Enter selects, Esc goes back.";
}

function NowPlayingAd() {
  const { path, screenText } = usePhoneLive();
  return (
    <article className="bp-ad bp-ad--cyan bp-now" aria-labelledby="bp-now-h">
      <h2 id="bp-now-h" className="bp-ad__head">
        Now playing
      </h2>
      <p key={path} className="bp-now__path">
        <span className="bp-visually-hidden">Current screen: </span>
        {path}
      </p>
      <p className="bp-now__lcd" aria-hidden="true">
        {screenText}
      </p>
      <p className="bp-now__hint">{hintFor(path, screenText)}</p>
    </article>
  );
}

/* ── Sound / Lights ───────────────────────────────────────────────────────── */

function SoundLightsAd() {
  const settings = useSettings();
  const soundOn = !settings.muted;
  return (
    <article className="bp-ad bp-ad--yellow bp-toggles" aria-labelledby="bp-toggles-h">
      <h2 id="bp-toggles-h" className="bp-ad__head">
        Sound <span aria-hidden="true">/</span> Lights
      </h2>
      <div className="bp-toggles__row">
        <button
          type="button"
          className="bp-switch"
          aria-pressed={soundOn}
          onClick={() => updateSettings({ muted: soundOn })}
        >
          <span className="bp-switch__name">Sound</span>
          <span className="bp-switch__state">{soundOn ? "On" : "Off"}</span>
        </button>
        <button
          type="button"
          className="bp-switch"
          aria-pressed={settings.backlight}
          onClick={() => updateSettings({ backlight: !settings.backlight })}
        >
          <span className="bp-switch__name">Lights</span>
          <span className="bp-switch__state">{settings.backlight ? "On" : "Off"}</span>
        </button>
      </div>
    </article>
  );
}

/* ── Whose phone is this? ─────────────────────────────────────────────────── */

function linkLabel(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "github.com") return "GitHub";
  if (host === "linkedin.com") return "LinkedIn";
  return host;
}

function WhoseAd() {
  return (
    <article className="bp-ad bp-ad--black bp-whose" aria-labelledby="bp-whose-h">
      <h2 id="bp-whose-h" className="bp-ad__head">
        Whose phone is this?
      </h2>
      <p className="bp-whose__name">{site.name}</p>
      <p className="bp-whose__role">{site.jobTitle}</p>
      <p className="bp-whose__tag">{site.tagline}</p>
      <ul className="bp-whose__links">
        {site.sameAs.map((url) => (
          <li key={url}>
            <a href={url} rel="me noopener" target="_blank">
              {linkLabel(url)}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ── Operator logo (decoration) ───────────────────────────────────────────── */

// 5×7 caps, one string per row; drawn into a 72×14 operator-logo bitmap.
const GLYPHS: Record<string, readonly string[]> = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
};

function logoPixels(): string {
  const word = "HELLOTIMBER";
  const left = Math.floor((72 - (word.length * 6 - 1)) / 2);
  const rects: string[] = [];
  word.split("").forEach((ch, i) => {
    GLYPHS[ch]?.forEach((row, y) => {
      row.split("").forEach((bit, x) => {
        if (bit === "1") rects.push(`M${left + i * 6 + x} ${y + 2}h1v1h-1z`);
      });
    });
  });
  // a dotted rule under the word, like a stock operator logo's flourish
  for (let x = 2; x < 70; x += 2) rects.push(`M${x} 11h1v1h-1z`);
  return rects.join("");
}

const LOGO_PATH = logoPixels();

function OperatorLogo({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 14"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={LOGO_PATH} fill="currentColor" />
    </svg>
  );
}

function LogoAd() {
  return (
    <article className="bp-ad bp-ad--paper bp-logo" aria-labelledby="bp-logo-h">
      <h2 id="bp-logo-h" className="bp-ad__head">
        Operator logo
      </h2>
      <div className="bp-logo__lcd">
        <OperatorLogo className="bp-logo__art" />
      </div>
      <p className="bp-logo__note">72 × 14 pixels, one bit each: the most a 3310 logo ever got.</p>
    </article>
  );
}

/* ── Picture message: Snake II ────────────────────────────────────────────── */

// Snake body cells on an 18×7 grid of 4-pixel cells (a 72×28 picture message).
const SNAKE: readonly (readonly [number, number])[] = [
  [2, 5],
  [3, 5],
  [4, 5],
  [5, 5],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [7, 2],
  [8, 2],
  [9, 2],
  [10, 2],
  [10, 3],
  [10, 4],
  [11, 4],
  [12, 4],
  [13, 4],
];

const SNAKE_PATH = SNAKE.map(([x, y]) => `M${x * 4} ${y * 4}h3v3h-3z`).join("");

function SnakeAd() {
  return (
    <article className="bp-ad bp-ad--paper bp-snake" aria-labelledby="bp-snake-h">
      <h2 id="bp-snake-h" className="bp-ad__head">
        Snake II inside
      </h2>
      <div className="bp-snake__body">
        <div className="bp-logo__lcd">
          <svg
            className="bp-logo__art"
            viewBox="0 0 72 28"
            shapeRendering="crispEdges"
            aria-hidden="true"
            focusable="false"
          >
            <path d={SNAKE_PATH} fill="currentColor" />
            <path
              d="M53 17h1v1h-1zM52 18h1v1h-1zM54 18h1v1h-1zM53 19h1v1h-1z"
              fill="currentColor"
            />
            <path d="M0 0h72v1H0zM0 27h72v1H0zM0 0h1v28H0zM71 0h1v28h-1z" fill="currentColor" />
          </svg>
        </div>
        <p>
          Menu <kbd>8</kbd> is Games; Snake II is the first one in it. Steer with <kbd>2</kbd>{" "}
          <kbd>4</kbd> <kbd>6</kbd> <kbd>8</kbd>.
        </p>
      </div>
    </article>
  );
}

/* ── Ringtone piano roll (decoration) ─────────────────────────────────────── */

// The Nokia tune: [semitones above C5, length in eighth notes].
const TUNE: readonly (readonly [number, number])[] = [
  [16, 1],
  [14, 1],
  [6, 2],
  [8, 2],
  [13, 1],
  [11, 1],
  [2, 2],
  [4, 2],
  [11, 1],
  [9, 1],
  [1, 2],
  [4, 2],
  [9, 4],
];

function TuneAd() {
  let at = 0;
  const bars = TUNE.map(([pitch, length]) => {
    const bar = { x: at, y: 17 - pitch, w: length };
    at += length;
    return bar;
  });
  return (
    <article className="bp-ad bp-ad--cyan bp-tune" aria-labelledby="bp-tune-h">
      <h2 id="bp-tune-h" className="bp-ad__head">
        The tune
      </h2>
      <svg
        className="bp-tune__roll"
        viewBox={`0 0 ${at} 18`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        {bars.map((b) => (
          <rect key={b.x} x={b.x + 0.08} y={b.y} width={b.w - 0.16} height={1.4} />
        ))}
      </svg>
      <p className="bp-tune__note">
        Thirteen notes of Tárrega&rsquo;s <cite>Gran Vals</cite>, the ringtone every 3310 shipped
        with.
      </p>
    </article>
  );
}

/* ── Ringtone notation strip (decoration) ─────────────────────────────────── */

// The Nokia tune is Tárrega's Gran Vals (public domain), written in RTTTL and in the 3310's own Composer notation.
const TONES: readonly string[] = [
  "NokiaTun:d=4,o=5,b=225:8e6,8d6,f#,g#,8c#6,8b,d,e,8b,8a,c#,e,2a",
  "8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1",
];

function TonesStrip() {
  return (
    <footer className="bp-tones" aria-label="Ringtone notation, decoration">
      {TONES.map((t) => (
        <code key={t} className="bp-tones__item">
          {t}
        </code>
      ))}
    </footer>
  );
}
