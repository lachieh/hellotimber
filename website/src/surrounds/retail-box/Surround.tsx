import type { PhoneKey } from "@hellotimber/phone-core";
import type { ReactNode } from "react";
import { site } from "../../content/site";
import { tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "../live";
import "./surround.css";

/** "Out of the box": the phone lies in a die-cut tray; the box's printed parts carry the rest. */
export default function Surround({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  return (
    <div className="sr-retail-box">
      <div className="rb-box">
        <div className="rb-tray">
          <div className="rb-cradle">
            <div className="rb-cavity" aria-hidden="true">
              <span className="rb-notch rb-notch--left" />
              <span className="rb-notch rb-notch--right" />
            </div>
            <div className="rb-phone">{phone}</div>
          </div>
          <QuickStart path={live.path} screenText={live.screenText} />
          <div className="rb-panel">
            <StatusLabel path={live.path} screenText={live.screenText} />
            <RegistrationCard />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick start leaflet: the key legend ─────────────────────────────────────

type IconName = "up" | "down" | "power";

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="rb-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {name === "up" && <path d="M8 3.5 13.5 12h-11z" />}
      {name === "down" && <path d="M8 12.5 2.5 4h11z" />}
      {name === "power" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 4.6a5.2 5.2 0 1 0 6 0" />
          <path d="M8 2.2v5.6" />
        </g>
      )}
    </svg>
  );
}

const KEY_FACE: Partial<Record<PhoneKey, ReactNode>> = {
  up: <Icon name="up" />,
  down: <Icon name="down" />,
  power: <Icon name="power" />,
  navi: "Navi",
  c: "C",
};

const KEY_NAME: Partial<Record<PhoneKey, string>> = {
  up: "Scroll up",
  down: "Scroll down",
  power: "Power",
  navi: "Navi key",
  c: "C key",
};

function KeyCap({ k, wide = false }: { k: PhoneKey; wide?: boolean }) {
  return (
    <button
      type="button"
      className={wide ? "rb-key rb-key--wide" : "rb-key"}
      aria-label={`Press ${KEY_NAME[k] ?? k}`}
      onClick={() => {
        tapPhoneKey(k);
      }}
    >
      {KEY_FACE[k] ?? k}
    </button>
  );
}

const LEGEND: { keys: PhoneKey[]; desk: string; does: string }[] = [
  { keys: ["up", "down"], desk: "Arrow keys", does: "Scroll through menus and lists" },
  { keys: ["navi"], desk: "Enter", does: "Navi key: Menu, Select, OK" },
  { keys: ["c"], desk: "Backspace or Esc", does: "Clear, or back one step" },
  { keys: ["power"], desk: "P", does: "Switch the phone on or off" },
];

const PAD: PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

interface Hint {
  text: string;
  keys: PhoneKey[];
}

/** What to try next, read from the live path and LCD text. */
function hintFor(path: string, screenText: string): Hint {
  if (screenText.startsWith("Phone off")) {
    return { text: "The phone is off. Press P to switch it on.", keys: ["power"] };
  }
  if (screenText.startsWith("Starting up")) {
    return { text: "Starting up. It takes a few seconds, like the real one.", keys: [] };
  }
  if (path === "standby") return { text: "Press Enter for Menu.", keys: ["navi"] };
  if (path.includes("snake"))
    return { text: "Steer with 2, 4, 6 and 8.", keys: ["2", "4", "6", "8"] };
  if (path === "menu") {
    return {
      text: "Scroll with the arrows, then press Enter to select.",
      keys: ["up", "down", "navi"],
    };
  }
  return {
    text: "Arrows scroll, Enter selects, Backspace goes back.",
    keys: ["up", "down", "navi", "c"],
  };
}

function QuickStart({ path, screenText }: { path: string; screenText: string }) {
  const hint = hintFor(path, screenText);
  return (
    <section className="rb-leaflet" aria-labelledby="rb-quickstart">
      <div className="rb-leaflet-sheet">
        <h2 id="rb-quickstart" className="rb-leaflet-title">
          Quick start
        </h2>
        <p className="rb-leaflet-lede">
          On a computer, your keyboard drives the phone. On a touch screen, tap the phone&rsquo;s
          own keys. The printed keys below press them too.
        </p>

        <div className="rb-next" aria-live="polite">
          <p>
            <strong>Try now.</strong> {hint.text}
          </p>
          {hint.keys.length > 0 && (
            <div className="rb-next-keys">
              {hint.keys.map((k) => (
                <KeyCap key={k} k={k} wide={k === "navi"} />
              ))}
            </div>
          )}
        </div>

        <ul className="rb-legend">
          {LEGEND.map((row) => (
            <li key={row.desk}>
              <span className="rb-legend-keys">
                {row.keys.map((k) => (
                  <KeyCap key={k} k={k} wide={k === "navi"} />
                ))}
              </span>
              <span className="rb-legend-text">
                <kbd>{row.desk}</kbd>
                <span>{row.does}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="rb-pad-row">
          <div className="rb-pad" role="group" aria-label="Keypad">
            {PAD.map((k) => (
              <KeyCap key={k} k={k} />
            ))}
          </div>
          <p className="rb-pad-text">
            <kbd>0&ndash;9, * and #</kbd>
            <span>Type, dial and play Snake.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Side-panel label: the live status ──────────────────────────────────────

/** A decorative barcode whose bars are read from the current path. */
function Barcode({ value }: { value: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const guard = () => {
    bars.push({ x, w: 1 });
    x += 2;
    bars.push({ x, w: 1 });
    x += 2;
  };
  guard();
  // Long enough to read as a barcode even for `menu`: repeat the path to 24 characters.
  const source = value.repeat(Math.ceil(24 / Math.max(value.length, 1))).slice(0, 24);
  for (let n = 0; n < source.length; n++) {
    const c = source.charCodeAt(n) + n;
    for (let i = 0; i < 2; i++) {
      const w = ((c >> (i * 2)) & 1) + 1;
      bars.push({ x, w });
      x += w + ((c >> (i + 3)) & 1) + 1;
    }
  }
  guard();
  return (
    <svg
      className="rb-barcode"
      viewBox={`0 0 ${x} 30`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y="0" width={b.w} height="30" />
      ))}
    </svg>
  );
}

function TickBox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="rb-tick"
      onClick={onToggle}
    >
      <svg className="rb-tick-box" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="1.5" y="1.5" width="17" height="17" rx="1" />
        {checked && <path d="M4.8 10.4 8.4 14l7-8.6" />}
      </svg>
      <span className="rb-tick-label">{label}</span>
      <span className="rb-tick-state">{checked ? "On" : "Off"}</span>
    </button>
  );
}

function StatusLabel({ path, screenText }: { path: string; screenText: string }) {
  const settings = useSettings();
  return (
    <section className="rb-label" aria-labelledby="rb-status">
      <header className="rb-label-head">
        <h2 id="rb-status">Nokia 3310</h2>
        <span>Now showing</span>
      </header>
      <dl className="rb-spec">
        <div>
          <dt>Path</dt>
          <dd className="rb-data">{path}</dd>
        </div>
        <div>
          <dt>Display</dt>
          <dd className="rb-data rb-lcd">{screenText}</dd>
        </div>
      </dl>
      <div className="rb-ticks" role="group" aria-label="Phone settings">
        <TickBox
          label="Sound"
          checked={!settings.muted}
          onToggle={() => {
            updateSettings({ muted: !settings.muted });
          }}
        />
        <TickBox
          label="Lights"
          checked={settings.backlight}
          onToggle={() => {
            updateSettings({ backlight: !settings.backlight });
          }}
        />
      </div>
      <div className="rb-code">
        <Barcode value={path} />
        <span className="rb-data">{path}</span>
      </div>
    </section>
  );
}

// ── Registration card: whose phone it is ───────────────────────────────────

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

function RegistrationCard() {
  return (
    <section className="rb-card" aria-labelledby="rb-owner">
      <h2 className="rb-card-title">Owner registration</h2>
      <dl className="rb-form">
        <div>
          <dt>Name</dt>
          <dd id="rb-owner" className="rb-owner">
            {site.name}
          </dd>
        </div>
        <div>
          <dt>Occupation</dt>
          <dd>{site.jobTitle}</dd>
        </div>
        <div>
          <dt>Remarks</dt>
          <dd>{site.tagline}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <ul className="rb-links">
              {site.sameAs.map((url) => (
                <li key={url}>
                  <a href={url} rel="me noopener" target="_blank">
                    {linkLabel(url)}
                  </a>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}
