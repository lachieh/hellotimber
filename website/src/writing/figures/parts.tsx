// What every figure is made of: the catalogue frame and caption around it, the phone's LCD and the
// keys under it. The frame follows the catalogue; the LCD keeps the phone's own green-grey (D16).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { phoneKeyForKeyboardKey } from "../../phone/keyboard";
import { keyName } from "./machine";
import type { FigurePhoneHandle } from "./use-figure-phone";

/** A numbered figure (the numbers are a CSS counter down the post) with its caption. */
export function Figure({
  kind,
  caption,
  children,
  label,
}: {
  kind: string;
  caption: ReactNode;
  children: ReactNode;
  /** What the figure is, for assistive technology: its caption's first words otherwise. */
  label?: string;
}) {
  return (
    <figure className="fig" data-kind={kind} aria-label={label}>
      <div className="fig-body">{children}</div>
      <figcaption className="fig-caption">{caption}</figcaption>
    </figure>
  );
}

const LOADING_TEXT: Record<FigurePhoneHandle["status"], string> = {
  waiting: "",
  loading: "Switching on…",
  ready: "",
  failed: "Can't switch on.",
};

/**
 * The LCD: the phone's canvas once it has loaded, a blank pane before (what the server sends).
 * Focus it and the keyboard works the phone as on the homepage: arrows, Enter, Escape, digits.
 */
export function LcdScreen({
  phone,
  label,
  interactive = true,
}: {
  phone: FigurePhoneHandle;
  label: string;
  interactive?: boolean;
}) {
  const onKey = (action: "down" | "up") => (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = phoneKeyForKeyboardKey(event.key);
    if (key === null || key === "power") return;
    event.preventDefault();
    if (action === "down" && event.repeat) return;
    phone.input(key, action);
  };
  return (
    <div className="fig-lcd" data-status={phone.status}>
      <div
        className="fig-lcd__pane"
        role="group"
        aria-label={label}
        tabIndex={interactive && phone.status === "ready" ? 0 : -1}
        onKeyDown={onKey("down")}
        onKeyUp={onKey("up")}
      >
        <div className="fig-lcd__screen" ref={phone.screenRef} />
        {phone.status !== "ready" && (
          <p className="fig-lcd__status">{LOADING_TEXT[phone.status]}</p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {phone.status === "ready" ? `Screen: ${phone.text}` : LOADING_TEXT[phone.status]}
      </p>
    </div>
  );
}

const NAV_KEYS: readonly PhoneKey[] = ["navi", "c", "up", "down"];
const DIGIT_KEYS: readonly PhoneKey[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "0",
  "#",
];

/** What a key does, for its accessible name. */
const KEY_LABELS: Partial<Record<PhoneKey, string>> = {
  navi: "Navi key, the screen's soft key",
  c: "C key, back or clear",
  up: "Scroll up",
  down: "Scroll down",
};

/** The phone's keys as buttons: held while the pointer or the key is down, as on the handset. */
export function Keypad({ phone, digits = false }: { phone: FigurePhoneHandle; digits?: boolean }) {
  const disabled = phone.status !== "ready";
  const button = (key: PhoneKey) => {
    const release = () => phone.input(key, "up");
    return (
      <button
        key={key}
        type="button"
        className="fig-key"
        data-key={key}
        disabled={disabled}
        aria-label={KEY_LABELS[key] ?? `Key ${key}`}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          phone.input(key, "down");
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            phone.input(key, "down");
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            release();
          }
        }}
      >
        {keyName(key)}
      </button>
    );
  };
  return (
    <div className="fig-keys" role="group" aria-label="Phone keys">
      <div className="fig-keys__nav">{NAV_KEYS.map(button)}</div>
      {digits && <div className="fig-keys__digits">{DIGIT_KEYS.map(button)}</div>}
    </div>
  );
}
