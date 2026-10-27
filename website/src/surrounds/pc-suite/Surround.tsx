import type { PhoneKey } from "@hellotimber/phone-core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { site } from "../../content/site";
import { phoneKeyForKeyboardKey } from "../../phone/keyboard";
import { tapPhoneKey, updateSettings, usePhoneLive, useSettings } from "../live";
import {
  AppIcon,
  ArrowIcon,
  FolderIcon,
  InfoIcon,
  KeypadIcon,
  LinkIcon,
  MinimiseGlyph,
  MonitorIcon,
  PersonIcon,
  PlugIcon,
  ScreenLeafIcon,
  SettingsIcon,
  SpeakerIcon,
} from "./icons";
import "./surround.css";

type WindowId = "monitor" | "keypad" | "settings" | "owner";

const WINDOWS: { id: WindowId; title: string; Icon: (p: { size?: number }) => ReactNode }[] = [
  { id: "monitor", title: "Phone monitor", Icon: MonitorIcon },
  { id: "keypad", title: "Keypad", Icon: KeypadIcon },
  { id: "settings", title: "Phone settings", Icon: SettingsIcon },
  { id: "owner", title: "Owner properties", Icon: PersonIcon },
];

export default function Surround({ phone }: { phone: ReactNode }) {
  const live = usePhoneLive();
  const [minimised, setMinimised] = useState<ReadonlySet<WindowId>>(new Set());
  const [active, setActive] = useState<WindowId>("monitor");
  const pressed = useKeyboardEcho();

  const deskRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<HTMLElement>(null);
  const cable = useCablePath(deskRef, stageRef, monitorRef, minimised.has("monitor"));

  const toggle = (id: WindowId) => {
    setMinimised((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setActive(id);
      } else next.add(id);
      return next;
    });
  };
  const frame = (id: WindowId) => ({
    id,
    active: active === id,
    minimised: minimised.has(id),
    onActivate: () => {
      setActive(id);
    },
    onMinimise: () => {
      toggle(id);
    },
  });

  return (
    <div className="sr-pc-suite">
      <div className="sr-pc-suite__desk" ref={deskRef}>
        <svg className="sr-pc-suite__cable" aria-hidden="true" focusable="false">
          {cable === null ? null : <Cable {...cable} />}
        </svg>

        <div className="sr-pc-suite__stage" ref={stageRef}>
          {phone}
        </div>

        <Win {...frame("monitor")} ref={monitorRef} area="monitor">
          <PhoneMonitor path={live.path} screenText={live.screenText} />
        </Win>
        <Win {...frame("keypad")} area="keypad">
          <Keypad pressed={pressed} />
        </Win>
        <Win {...frame("settings")} area="settings">
          <SettingsSheet path={live.path} />
        </Win>
        <Win {...frame("owner")} area="owner">
          <OwnerProperties />
        </Win>
      </div>

      <Taskbar
        minimised={minimised}
        active={active}
        onToggle={toggle}
        onShowAll={() => {
          setMinimised(new Set());
        }}
      />
    </div>
  );
}

/* ── windows ─────────────────────────────────────────────────────────── */

function Win({
  id,
  area,
  active,
  minimised,
  onActivate,
  onMinimise,
  ref,
  children,
}: {
  id: WindowId;
  area: string;
  active: boolean;
  minimised: boolean;
  onActivate: () => void;
  onMinimise: () => void;
  ref?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const meta = WINDOWS.find((w) => w.id === id);
  if (meta === undefined) return null;
  const titleId = `sr-pc-suite-${id}-title`;
  return (
    <section
      ref={ref}
      className={`sr-pc-suite__win sr-pc-suite__win--${area}${active ? " is-active" : ""}`}
      aria-labelledby={titleId}
      hidden={minimised}
      onPointerDown={onActivate}
      onFocus={onActivate}
    >
      <header className="sr-pc-suite__titlebar">
        <meta.Icon />
        <h2 id={titleId}>{meta.title}</h2>
        <button
          type="button"
          className="sr-pc-suite__btn sr-pc-suite__winctl"
          aria-label={`Minimise ${meta.title}`}
          title="Minimise"
          onClick={onMinimise}
        >
          <MinimiseGlyph />
        </button>
      </header>
      <div className="sr-pc-suite__winbody">{children}</div>
    </section>
  );
}

/* ── Phone monitor: live path tree, LCD text, contextual hint ───────── */

function PhoneMonitor({ path, screenText }: { path: string; screenText: string }) {
  const segments = path === "" ? ["standby"] : path.split("/");
  const lines = screenText
    .split(/(?<=\.)\s+/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  return (
    <>
      <div className="sr-pc-suite__address">
        <span className="sr-pc-suite__label" id="sr-pc-suite-addr">
          Location
        </span>
        <output className="sr-pc-suite__field sr-pc-suite__path" aria-labelledby="sr-pc-suite-addr">
          {path === "" ? "standby" : path}
        </output>
      </div>

      <div className="sr-pc-suite__split">
        <div className="sr-pc-suite__field sr-pc-suite__tree" aria-label="Path tree">
          <ul>
            <li>
              <span className="sr-pc-suite__node">
                <AppIcon />
                Phone
              </span>
              <TreeLevel segments={segments} />
            </li>
          </ul>
        </div>

        <div className="sr-pc-suite__field sr-pc-suite__lcd" role="presentation">
          <div className="sr-pc-suite__lcdhead">Display</div>
          <ol aria-label="Screen text">
            {lines.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ol>
        </div>
      </div>

      <p className="sr-pc-suite__hint">
        <InfoIcon />
        <span>{hintFor(path, screenText)}</span>
      </p>

      <footer className="sr-pc-suite__statusbar">
        <span className="sr-pc-suite__pane">Connected</span>
        <span className="sr-pc-suite__pane sr-pc-suite__pane--grow">
          {segments.length} level{segments.length === 1 ? "" : "s"} deep
        </span>
      </footer>
    </>
  );
}

function TreeLevel({ segments }: { segments: string[] }) {
  const [head, ...rest] = segments;
  if (head === undefined) return null;
  const leaf = rest.length === 0;
  return (
    <ul>
      <li>
        <span className={`sr-pc-suite__node${leaf ? " is-selected" : ""}`}>
          {leaf ? <ScreenLeafIcon /> : <FolderIcon open />}
          {humanise(head)}
        </span>
        <TreeLevel segments={rest} />
      </li>
    </ul>
  );
}

function humanise(segment: string): string {
  const words = segment.replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function hintFor(path: string, screenText: string): string {
  if (screenText.startsWith("Phone off")) return "Press P (Power) to switch the phone on.";
  if (screenText.startsWith("Starting up")) return "The phone is starting up. Give it a moment.";
  if (path.includes("snake")) return "Steer the snake with 2, 4, 6 and 8.";
  if (path === "standby" || path === "") {
    return screenText.includes("Press Menu")
      ? "Press Menu (Enter) to open the menu."
      : "Press the NaviKey (Enter) to choose what the bottom line of the screen offers.";
  }
  if (screenText.startsWith("Menu")) {
    return "Scroll with the Up and Down arrows, select with Enter, go back with Backspace.";
  }
  return "Enter selects, Backspace (C) goes back, digits type.";
}

/* ── Keypad: clickable keys + keyboard mapping ───────────────────────── */

const DIGITS: PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const MAPPING: { keys: string; phone: string; does: string }[] = [
  { keys: "Up / Down arrows", phone: "Scroll keys", does: "Move through lists" },
  { keys: "Enter", phone: "NaviKey", does: "Menu, Select, OK" },
  { keys: "Backspace, Esc", phone: "C", does: "Back, clear" },
  { keys: "0–9, *, #", phone: "Keypad", does: "Type, shortcuts" },
  { keys: "P", phone: "Power", does: "Switch on or off" },
];

function Keypad({ pressed }: { pressed: ReadonlySet<PhoneKey> }) {
  const key = (k: PhoneKey, label: ReactNode, name: string, extra = "") => (
    <button
      type="button"
      className={`sr-pc-suite__btn sr-pc-suite__key${extra}${pressed.has(k) ? " is-down" : ""}`}
      aria-label={name}
      onClick={() => {
        tapPhoneKey(k);
      }}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="sr-pc-suite__keys">
        <div className="sr-pc-suite__keyrow">
          {key("power", "Power", "Power (P)")}
          {key("navi", "Menu / Select", "NaviKey (Enter)", " sr-pc-suite__key--navi")}
          {key("c", "C", "C, back (Backspace)")}
          {key("up", <ArrowIcon dir="up" />, "Scroll up (Up arrow)")}
          {key("down", <ArrowIcon dir="down" />, "Scroll down (Down arrow)")}
        </div>
        <div className="sr-pc-suite__digits">
          {DIGITS.map((d) => (
            <span key={d}>{key(d, d, `Key ${d}`)}</span>
          ))}
        </div>
      </div>
      <table className="sr-pc-suite__field sr-pc-suite__table">
        <caption className="sr-pc-suite__label">Keyboard mapping</caption>
        <thead>
          <tr>
            <th scope="col">Keyboard</th>
            <th scope="col">Phone key</th>
            <th scope="col">Does</th>
          </tr>
        </thead>
        <tbody>
          {MAPPING.map((row) => (
            <tr key={row.phone}>
              <td>
                <kbd>{row.keys}</kbd>
              </td>
              <td>{row.phone}</td>
              <td>{row.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Light up keypad buttons while the matching keyboard key is held. Never prevents defaults. */
function useKeyboardEcho(): ReadonlySet<PhoneKey> {
  const [pressed, setPressed] = useState<ReadonlySet<PhoneKey>>(new Set());
  useEffect(() => {
    const on = (down: boolean) => (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = phoneKeyForKeyboardKey(e.key);
      if (k === null) return;
      setPressed((prev) => {
        if (prev.has(k) === down) return prev;
        const next = new Set(prev);
        if (down) next.add(k);
        else next.delete(k);
        return next;
      });
    };
    const down = on(true);
    const up = on(false);
    const clear = () => {
      setPressed(new Set());
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return pressed;
}

/* ── Settings: tabbed property sheet ─────────────────────────────────── */

function SettingsSheet({ path }: { path: string }) {
  const settings = useSettings();
  const [tab, setTab] = useState<"phone" | "connection">("phone");
  const tabs = [
    { id: "phone", label: "Sound and lights" },
    { id: "connection", label: "Connection" },
  ] as const;
  return (
    <div className="sr-pc-suite__sheet">
      <div className="sr-pc-suite__tabs" role="tablist" aria-label="Settings pages">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`sr-pc-suite-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`sr-pc-suite-panel-${t.id}`}
            className="sr-pc-suite__tab"
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="sr-pc-suite__tabpanel"
        role="tabpanel"
        id={`sr-pc-suite-panel-${tab}`}
        aria-labelledby={`sr-pc-suite-tab-${tab}`}
      >
        {tab === "phone" ? (
          <>
            <fieldset className="sr-pc-suite__group">
              <legend>Sound</legend>
              <Check
                label="Sound on"
                checked={!settings.muted}
                onChange={(on) => updateSettings({ muted: !on })}
              />
              <Check
                label="Keypad tones"
                checked={settings.keypadTones}
                disabled={settings.muted}
                onChange={(on) => updateSettings({ keypadTones: on })}
              />
            </fieldset>
            <fieldset className="sr-pc-suite__group">
              <legend>Lights</legend>
              <Check
                label="Display and keypad lights"
                checked={settings.backlight}
                onChange={(on) => updateSettings({ backlight: on })}
              />
            </fieldset>
          </>
        ) : (
          <dl className="sr-pc-suite__props">
            <dt>Model</dt>
            <dd>3310</dd>
            <dt>Firmware</dt>
            <dd>V 06.39 (reproduction)</dd>
            <dt>Link</dt>
            <dd>Data cable</dd>
            <dt>Status</dt>
            <dd>Connected</dd>
            <dt>Screen</dt>
            <dd className="sr-pc-suite__mono">{path === "" ? "standby" : path}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className={`sr-pc-suite__check${disabled ? " is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.currentTarget.checked);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

/* ── Owner properties ────────────────────────────────────────────────── */

function OwnerProperties() {
  return (
    <div className="sr-pc-suite__owner">
      <div className="sr-pc-suite__ownerhead">
        <PersonIcon size={32} />
        <div>
          <p className="sr-pc-suite__name">{site.name}</p>
          <p>{site.jobTitle}</p>
        </div>
      </div>
      <hr />
      <p className="sr-pc-suite__tagline">{site.tagline}</p>
      <fieldset className="sr-pc-suite__group">
        <legend>Links</legend>
        <ul className="sr-pc-suite__links">
          {site.sameAs.map((href) => (
            <li key={href}>
              <LinkIcon />
              <a href={href} rel="me noopener" target="_blank">
                {href.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}

/* ── Taskbar ─────────────────────────────────────────────────────────── */

function Taskbar({
  minimised,
  active,
  onToggle,
  onShowAll,
}: {
  minimised: ReadonlySet<WindowId>;
  active: WindowId;
  onToggle: (id: WindowId) => void;
  onShowAll: () => void;
}) {
  const settings = useSettings();
  const clock = useClock();
  return (
    <nav className="sr-pc-suite__taskbar" aria-label="Taskbar">
      <button
        type="button"
        className="sr-pc-suite__btn sr-pc-suite__start"
        onClick={onShowAll}
        title="Show all windows"
      >
        <AppIcon />
        <span>hellotimber</span>
      </button>
      <span className="sr-pc-suite__sep" aria-hidden="true" />
      <div className="sr-pc-suite__tasks">
        {WINDOWS.map(({ id, title, Icon }) => {
          const open = !minimised.has(id);
          return (
            <button
              key={id}
              type="button"
              className={`sr-pc-suite__btn sr-pc-suite__task${open && active === id ? " is-down" : ""}`}
              aria-pressed={open}
              title={open ? `Minimise ${title}` : `Restore ${title}`}
              onClick={() => {
                onToggle(id);
              }}
            >
              <Icon />
              <span>{title}</span>
            </button>
          );
        })}
      </div>
      <div className="sr-pc-suite__tray">
        <span title="Phone connected by data cable" className="sr-pc-suite__trayitem">
          <PlugIcon connected />
          <span className="sr-only">Phone connected</span>
        </span>
        <button
          type="button"
          className="sr-pc-suite__trayitem sr-pc-suite__traybtn"
          aria-pressed={!settings.muted}
          aria-label="Sound"
          title={settings.muted ? "Sound off: click to turn on" : "Sound on: click to mute"}
          onClick={() => updateSettings({ muted: !settings.muted })}
        >
          <SpeakerIcon muted={settings.muted} />
        </button>
        <time className="sr-pc-suite__clock">{clock}</time>
      </div>
    </nav>
  );
}

function useClock(): string {
  const format = () =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase();
  const [now, setNow] = useState(format);
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(format());
    }, 10_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  return now;
}

/* ── the data cable ──────────────────────────────────────────────────── */

interface CableGeometry {
  d: string;
  start: { x: number; y: number };
  /** Where the plug meets the window, and which window edge it enters. */
  end: { x: number; y: number; edge: "east" | "west" | "north" };
}

function Cable({ d, start, end }: CableGeometry) {
  const plug = {
    east: { x: end.x - 2, y: end.y - 7 },
    west: { x: end.x - 12, y: end.y - 7 },
    north: { x: end.x - 7, y: end.y - 12 },
  }[end.edge];
  return (
    <>
      <path d={d} className="sr-pc-suite__cord-shadow" />
      <path d={d} className="sr-pc-suite__cord" />
      <path d={d} className="sr-pc-suite__cord-shine" />
      <rect x={start.x - 9} y={start.y - 3} width="18" height="9" className="sr-pc-suite__plug" />
      <rect x={plug.x} y={plug.y} width="14" height="14" className="sr-pc-suite__plug" />
    </>
  );
}

/** Route the cable from the phone's base to the Phone monitor window; re-measured on resize. */
function useCablePath(
  deskRef: RefObject<HTMLDivElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  monitorRef: RefObject<HTMLElement | null>,
  monitorHidden: boolean,
): CableGeometry | null {
  const [geo, setGeo] = useState<CableGeometry | null>(null);
  useLayoutEffect(() => {
    const desk = deskRef.current;
    const stage = stageRef.current;
    const monitor = monitorRef.current;
    if (desk === null || stage === null || monitor === null) return;
    const measure = () => {
      if (monitorHidden) {
        setGeo(null);
        return;
      }
      const d = desk.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const m = monitor.getBoundingClientRect();
      const ox = d.left - desk.scrollLeft;
      const oy = d.top - desk.scrollTop;
      // The phone's base sits just above the bottom of its stage (it fills ~90% of the height).
      const start = { x: s.left + s.width / 2 - ox, y: s.top + s.height * 0.955 - oy };
      const beside = m.right <= start.x + ox || m.left >= start.x + ox;
      if (beside) {
        // Drape: down off the base, along the desk below the phone, then up into the window.
        const west = m.left >= start.x + ox;
        const dir = west ? -1 : 1;
        const x = (west ? m.left : m.right) - ox;
        const end = { x, y: m.top + m.height * 0.62 - oy, edge: west ? "west" : "east" } as const;
        const floor = Math.max(
          start.y + 24,
          Math.min(start.y + 60, d.height + desk.scrollTop - 14),
        );
        const riser = x + dir * 56;
        const turn = start.x - dir * 70;
        const tip = x + dir * 12;
        setGeo({
          d: [
            `M ${start.x} ${start.y}`,
            `C ${start.x} ${floor}, ${start.x} ${floor}, ${turn} ${floor}`,
            `L ${riser + dir * 60} ${floor}`,
            `C ${riser} ${floor}, ${riser} ${end.y}, ${tip} ${end.y}`,
          ].join(" "),
          start,
          end,
        });
      } else {
        const end = { x: m.left + m.width * 0.5 - ox, y: m.top - oy, edge: "north" } as const;
        const tipY = end.y - 12;
        const bend = Math.max(8, (tipY - start.y) / 2);
        setGeo({
          d: `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${tipY - bend}, ${end.x} ${tipY}`,
          start,
          end,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(desk);
    ro.observe(stage);
    ro.observe(monitor);
    desk.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      desk.removeEventListener("scroll", measure);
    };
  }, [deskRef, stageRef, monitorRef, monitorHidden]);
  return geo;
}
