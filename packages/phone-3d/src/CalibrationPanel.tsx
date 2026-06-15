import { useState } from "react";
import {
  calToSource,
  getCal,
  getScreenCal,
  resetCal,
  setKeyCal,
  setScreenCal,
  setSelectedKey,
  useCal,
  useScreenCal,
  useSelectedKey,
} from "./calibration";
import type { KeyCal, ScreenCal } from "./calibration";
import { KEY_HOTSPOTS } from "./hotspots";
import type { Nokia3310Key } from "./types";

const FIELDS: { k: keyof KeyCal; label: string; min: number; max: number; step: number }[] = [
  { k: "x", label: "x (cx)", min: 0, max: 1, step: 0.002 },
  { k: "y", label: "y (cy)", min: 0, max: 1, step: 0.002 },
  { k: "z", label: "z (depth)", min: -0.5, max: 1, step: 0.01 },
  { k: "w", label: "w (width)", min: 0.01, max: 0.6, step: 0.002 },
  { k: "h", label: "h (height)", min: 0.01, max: 0.3, step: 0.002 },
  { k: "rot", label: "rot (°)", min: -45, max: 45, step: 0.5 },
];

const SCREEN_FIELDS: {
  k: keyof ScreenCal;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { k: "scaleW", label: "scale W", min: 0.5, max: 1.5, step: 0.005 },
  { k: "scaleH", label: "scale H", min: 0.5, max: 1.5, step: 0.005 },
  { k: "offX", label: "off X", min: -0.5, max: 0.5, step: 0.005 },
  { k: "offY", label: "off Y", min: -0.5, max: 0.5, step: 0.005 },
  { k: "offZ", label: "off Z", min: -10, max: 5, step: 0.05 },
  { k: "pitch", label: "pitch °", min: -90, max: 90, step: 0.5 },
  { k: "yaw", label: "yaw °", min: -90, max: 90, step: 0.5 },
  { k: "roll", label: "roll °", min: -180, max: 180, step: 0.5 },
];

/**
 * Dev-only DOM overlay for tuning the 17 key hotspots live. Rendered by
 * PhoneStage as a sibling of the Canvas when `?calibrate=1`. Pick a key, drag
 * its x/y/z/w/h, then "Copy hotspots.ts" and paste the result into hotspots.ts.
 */
export function CalibrationPanel() {
  const cal = useCal();
  const selected = useSelectedKey();
  const c = cal[selected];
  const screen = useScreenCal();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const src = calToSource(getCal(), getScreenCal());
    void navigator.clipboard?.writeText(src).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // Clipboard blocked — log so the values are still recoverable.
        console.log(src);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        width: 280,
        padding: 12,
        borderRadius: 10,
        background: "rgba(20,24,28,0.92)",
        color: "#e6f0ea",
        font: "12px ui-monospace, monospace",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Hotspot calibration</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {KEY_HOTSPOTS.map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={() => setSelectedKey(h.key)}
            style={{
              padding: "3px 6px",
              borderRadius: 5,
              border: "1px solid #3a4a44",
              cursor: "pointer",
              background: h.key === selected ? "#22ff88" : "#222b28",
              color: h.key === selected ? "#04130b" : "#cfe",
              minWidth: 26,
            }}
          >
            {labelFor(h.key)}
          </button>
        ))}
      </div>

      {FIELDS.map((f) => (
        <label key={f.k} style={{ display: "block", marginBottom: 6 }}>
          <span style={{ display: "inline-block", width: 78 }}>{f.label}</span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={c[f.k]}
            onChange={(e) => setKeyCal(selected, { [f.k]: Number(e.target.value) })}
            style={{ width: 120, verticalAlign: "middle" }}
          />
          <input
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            value={Number(c[f.k].toFixed(3))}
            onChange={(e) => setKeyCal(selected, { [f.k]: Number(e.target.value) })}
            style={{
              width: 56,
              marginLeft: 6,
              background: "#0e1412",
              color: "#cfe",
              border: "1px solid #3a4a44",
              borderRadius: 4,
            }}
          />
        </label>
      ))}

      <div
        style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #2a3a34", fontWeight: 700 }}
      >
        Screen overlay
      </div>
      {SCREEN_FIELDS.map((f) => (
        <label key={f.k} style={{ display: "block", marginTop: 6 }}>
          <span style={{ display: "inline-block", width: 78 }}>{f.label}</span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={screen[f.k]}
            onChange={(e) => setScreenCal({ [f.k]: Number(e.target.value) })}
            style={{ width: 120, verticalAlign: "middle" }}
          />
          <input
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            value={Number(screen[f.k].toFixed(3))}
            onChange={(e) => setScreenCal({ [f.k]: Number(e.target.value) })}
            style={{
              width: 56,
              marginLeft: 6,
              background: "#0e1412",
              color: "#cfe",
              border: "1px solid #3a4a44",
              borderRadius: 4,
            }}
          />
        </label>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={copy} style={btn("#22ff88", "#04130b")}>
          {copied ? "Copied!" : "Copy hotspots.ts"}
        </button>
        <button type="button" onClick={resetCal} style={btn("#33405a", "#dfe")}>
          Reset
        </button>
      </div>
      <div style={{ marginTop: 8, opacity: 0.7, lineHeight: 1.4 }}>
        Keys: pick one, drag x/y/z/w/h/rot. Screen: scale/offset the LCD into the frame. Copy pastes
        the hotspots + SCREEN_ADJUST block.
      </div>
    </div>
  );
}

function btn(bg: string, fg: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: bg,
    color: fg,
    fontWeight: 700,
  };
}

function labelFor(key: Nokia3310Key): string {
  if (key === "navi") return "OK";
  if (key === "up") return "▲";
  if (key === "down") return "▼";
  if (key === "power") return "⏻";
  return key.toUpperCase();
}
