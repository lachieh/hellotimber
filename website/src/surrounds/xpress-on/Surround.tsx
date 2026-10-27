import type { PhoneKey } from "@hellotimber/phone-core";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { site } from "../../content/site";
import { tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "../live";
import { COVERS, CoverArt } from "./covers";
import type { Cover, CoverId } from "./covers";
import { hintFor } from "./hint";
import "./surround.css";

const SHOP_LIGHT = "#efe7d2";

export default function Surround({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  const hint = hintFor(live.path, live.screenText);
  const [picked, setPicked] = useState<CoverId | null>(null);
  const [previewing, setPreviewing] = useState<CoverId | null>(null);
  const shown = COVERS.find((c) => c.id === (previewing ?? picked));
  const style = { "--wash": shown?.wash ?? SHOP_LIGHT } as CSSProperties;

  return (
    <div className="sr-xpress-on" style={style}>
      <div className="xp-wall">
        <section className="xp-hero" aria-label="Nokia 3310">
          <Hook />
          <div className="xp-display">
            <div className="xp-display-head">
              <span className="xp-slot" aria-hidden="true" />
              <p className="xp-wordmark">hellotimber</p>
            </div>
            <div className="xp-phone">{phone}</div>
            <p className="xp-tryme" aria-hidden="true">
              <span>Try</span> me
            </p>
          </div>
        </section>

        <ShelfLabel path={live.path} screenText={live.screenText} hint={hint.text} />

        <section className="xp-covers" aria-labelledby="xp-covers-title">
          <h2 id="xp-covers-title" className="xp-rail-title">
            Xpress-on covers
          </h2>
          <ul className="xp-cover-list">
            {COVERS.map((cover) => (
              <li key={cover.id}>
                <CoverPack
                  cover={cover}
                  picked={picked === cover.id}
                  onPreview={(on) => {
                    setPreviewing(on ? cover.id : null);
                  }}
                  onPick={() => {
                    setPicked((p) => (p === cover.id ? null : cover.id));
                  }}
                />
              </li>
            ))}
          </ul>
        </section>

        <KeyGuide suggested={hint.keys} />
        <SoundLights />
        <StaffBadge />
      </div>
    </div>
  );
}

function Hook() {
  return (
    <svg className="xp-hook" viewBox="0 0 60 70" aria-hidden="true">
      <defs>
        <linearGradient
          id="xp-hook-metal"
          gradientUnits="userSpaceOnUse"
          x1="27"
          y1="0"
          x2="33"
          y2="0"
        >
          <stop offset="0" stopColor="#7d858d" />
          <stop offset="0.45" stopColor="#f2f4f6" />
          <stop offset="1" stopColor="#5d656d" />
        </linearGradient>
      </defs>
      <rect x="22" y="2" width="16" height="9" rx="3" fill="#8f979e" />
      <path
        d="M30 8V52"
        fill="none"
        stroke="url(#xp-hook-metal)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShelfLabel({
  path,
  screenText,
  hint,
}: {
  path: string;
  screenText: string;
  hint: string;
}) {
  return (
    <section className="xp-shelf" aria-label="Phone status">
      <div className="xp-label">
        <dl className="xp-lcd">
          <div className="xp-lcd-field xp-lcd-path">
            <dt>Path</dt>
            <dd>{path}</dd>
          </div>
          <div className="xp-lcd-field xp-lcd-screen">
            <dt>Screen</dt>
            <dd>{screenText}</dd>
          </div>
          <div className="xp-lcd-field xp-lcd-hint">
            <dt>Next</dt>
            <dd>{hint}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function CoverPack({
  cover,
  picked,
  onPreview,
  onPick,
}: {
  cover: Cover;
  picked: boolean;
  onPreview: (on: boolean) => void;
  onPick: () => void;
}) {
  const bandStyle = { "--band": cover.band, "--band-ink": cover.bandInk } as CSSProperties;
  return (
    <button
      type="button"
      className="xp-pack"
      style={bandStyle}
      aria-pressed={picked}
      onPointerEnter={() => {
        onPreview(true);
      }}
      onPointerLeave={() => {
        onPreview(false);
      }}
      onFocus={() => {
        onPreview(true);
      }}
      onBlur={() => {
        onPreview(false);
      }}
      onClick={onPick}
    >
      <span className="xp-hang" aria-hidden="true" />
      <span className="xp-blister" aria-hidden="true">
        <CoverArt cover={cover.id} />
      </span>
      <span className="xp-pack-band">
        <span className="xp-pack-name">{cover.name}</span>
        <span className="xp-pack-sub">{picked ? "Lighting the wall" : "3310 cover"}</span>
      </span>
    </button>
  );
}

interface GuideKey {
  key: PhoneKey;
  label: ReactNode;
  keyboard: string;
  does: string;
}

const MAIN_KEYS: readonly GuideKey[] = [
  { key: "navi", label: "Menu", keyboard: "Enter", does: "Open, select" },
  { key: "c", label: "C", keyboard: "Esc / Bksp", does: "Back, clear" },
  { key: "up", label: <Chevron up />, keyboard: "Up arrow", does: "Scroll up" },
  { key: "down", label: <Chevron />, keyboard: "Down arrow", does: "Scroll down" },
  { key: "power", label: <PowerGlyph />, keyboard: "P", does: "Power (hold)" },
];

const PAD: readonly PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function KeyGuide({ suggested }: { suggested: readonly PhoneKey[] }) {
  return (
    <section className="xp-card xp-keys" aria-labelledby="xp-keys-title">
      <span className="xp-hang" aria-hidden="true" />
      <h2 id="xp-keys-title" className="xp-card-title">
        How to drive it
      </h2>
      <p className="xp-card-note">Use your keyboard, tap the keys on the phone, or press these.</p>
      <ul className="xp-keylist">
        {MAIN_KEYS.map((k) => (
          <li key={k.key}>
            <button
              type="button"
              className="xp-key"
              data-next={suggested.includes(k.key) || undefined}
              aria-label={`${k.does} (${k.keyboard})`}
              onClick={() => {
                tapPhoneKey(k.key);
              }}
            >
              <span className="xp-cap">{k.label}</span>
              <span className="xp-key-text">
                <span className="xp-key-does">{k.does}</span>
                <kbd>{k.keyboard}</kbd>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div
        className="xp-pad"
        role="group"
        aria-label="Number keys, also your keyboard digits, * and #"
      >
        {PAD.map((k) => (
          <button
            key={k}
            type="button"
            className="xp-padkey"
            aria-label={`Key ${k}`}
            data-next={suggested.includes(k) || undefined}
            onClick={() => {
              tapPhoneKey(k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </section>
  );
}

function SoundLights() {
  const settings = useSettings();
  return (
    <section className="xp-card xp-settings" aria-labelledby="xp-settings-title">
      <span className="xp-hang" aria-hidden="true" />
      <h2 id="xp-settings-title" className="xp-card-title">
        Sound / Lights
      </h2>
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
    </section>
  );
}

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
      role="switch"
      aria-checked={on}
      className="xp-toggle"
      onClick={() => {
        onChange(!on);
      }}
    >
      <span className="xp-toggle-label">{label}</span>
      <span className="xp-toggle-state">{on ? "On" : "Off"}</span>
      <span className="xp-switch" aria-hidden="true">
        <span className="xp-switch-knob" />
      </span>
    </button>
  );
}

const LINK_NAMES: Record<string, string> = {
  "github.com": "GitHub",
  "www.linkedin.com": "LinkedIn",
  "linkedin.com": "LinkedIn",
};

function StaffBadge() {
  return (
    <section className="xp-badge" aria-labelledby="xp-badge-name">
      <span className="xp-clip" aria-hidden="true" />
      <div className="xp-badge-band">
        <span>hellotimber</span>
      </div>
      <div className="xp-badge-body">
        <h2 id="xp-badge-name" className="xp-badge-name">
          {site.name}
        </h2>
        <p className="xp-badge-role">{site.jobTitle}</p>
        <p className="xp-badge-tagline">{site.tagline}</p>
        <ul className="xp-badge-links">
          {site.sameAs.map((href) => {
            const host = new URL(href).hostname;
            return (
              <li key={href}>
                <a href={href} rel="me noopener" target="_blank">
                  {LINK_NAMES[host] ?? host}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={up ? "M3 10.5 8 5.5l5 5" : "M3 5.5 8 10.5l5-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PowerGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M8 2.2v5.2M4.6 4.4a5 5 0 1 0 6.8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
