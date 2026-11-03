import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { updateSettings, useSettings } from "../settings";
import { deskHint } from "./lcd-copy";
import type { KeyInput } from "./lcd-copy";
import { usePhoneLive } from "./live";
import Graffiti from "./Graffiti";
import PencilCase from "./PencilCase";
import "./desk.css";

/** "Left on the desk, 2001": the phone put down on a graffitied school desk among a teenager's
 *  things, which carry the info. */
export default function Desk({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  const input = useKeyInput();
  return (
    <div className="desk">
      <div className="d01-desk">
        <DeskGrain />
        <Graffiti />
        <div className="d01-window-light" aria-hidden="true" />

        <section className="d01-phone" aria-label="The phone" aria-describedby="d01-phone-keys">
          <p id="d01-phone-keys" className="d01-sr">
            A working Nokia 3310. Arrow keys scroll, Enter is the middle key, Escape or Backspace is
            C, 0 to 9, star and hash type, and P is power. What the screen shows is read out as it
            changes. To reach Lachlan, text him on 0491 570 006 from Messages.
          </p>
          <div className="d01-phone__shadow" aria-hidden="true" />
          <div className="d01-phone__stage">{phone}</div>
        </section>

        <p className="d01-more" aria-hidden="true">
          more on the desk
          <ScribbleArrow />
        </p>

        <StickyNote hint={deskHint(live.path, live.screen, input)} />
        <PencilCase />
        <Biro />
      </div>
    </div>
  );
}

/* ── sticky note pad: what to do next ────────────────────────────────────── */

const COARSE = "(pointer: coarse)";

/** Touch when the primary pointer is a finger (the hint names the phone's keys, not the
 *  keyboard's); the keyboard on the server and until hydrated. */
function useKeyInput(): KeyInput {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(COARSE);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => (window.matchMedia(COARSE).matches ? "touch" : "keyboard"),
    () => "keyboard",
  );
}

/** The hint on screen and the one it replaced (peeling off the pad until the next change). */
function useHintChange(hint: string): { hint: string; previous: string | null } {
  const [state, setState] = useState<{ hint: string; previous: string | null }>({
    hint,
    previous: null,
  });
  if (state.hint !== hint) {
    const next = { hint, previous: state.hint };
    setState(next);
    return next;
  }
  return state;
}

/**
 * A pad of sticky notes with what to do next on the top sheet. When the hint changes, that sheet
 * peels off the pad and the new hint is written on the blank one beneath it.
 */
function StickyNote({ hint }: { hint: string }) {
  const change = useHintChange(hint);
  return (
    <section className="d01-obj d01-sticky" aria-label="What to do next">
      {/* Announced from one element that stays put; the sheets come and go. */}
      <p className="d01-sr" aria-live="polite">
        now: {change.hint}
      </p>
      <div className="d01-sticky__sheet" key={change.hint} aria-hidden="true">
        <SheetText hint={change.hint} className="d01-sticky__hint--new" />
      </div>
      {change.previous !== null && (
        <div
          className="d01-sticky__sheet d01-sticky__sheet--peel"
          key={`old:${change.previous}`}
          aria-hidden="true"
        >
          <SheetText hint={change.previous} />
        </div>
      )}
      <MuteBox />
    </section>
  );
}

/** A tick-box drawn in the pad's corner: ticked, the phone makes no sound. */
function MuteBox() {
  const { muted } = useSettings();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={muted}
      aria-label="Sound off"
      className="d01-sticky__mute"
      onClick={() => updateSettings({ muted: !muted })}
    >
      <svg className="d01-sticky__mute-box" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.2c5.4-1 10.8-1.2 16-.4.9 5 1 10.2.2 15.2-5.2.9-10.6.9-16 .2-.9-5-1-10 0-15z" />
        {muted && <path className="d01-sticky__mute-tick" d="M6.5 12.5l4 4.5 9-13" />}
      </svg>
      <span aria-hidden="true">shh, no sound</span>
    </button>
  );
}

function SheetText({ hint, className = "" }: { hint: string; className?: string }) {
  return (
    <p className={`d01-sticky__hint ${className}`}>
      <ScribbleArrow className="d01-sticky__hint-arrow" />
      <span>now: {hint}</span>
    </p>
  );
}

/* ── decorative period objects ───────────────────────────────────────────── */

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
          values="0 0 0 0 0.5  0 0 0 0 0.3  0 0 0 0 0.1  1.6 0 0 0 -0.7"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#d01-grain)" />
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
