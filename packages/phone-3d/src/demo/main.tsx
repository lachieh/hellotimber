import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PhoneStage } from "../PhoneStage";
import type { Nokia3310Key } from "../types";
import { createTestPattern } from "./test-pattern";

const KEYBOARD_KEYS = new Set<string>(["*", "#", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

function App() {
  const pattern = useMemo(() => createTestPattern(), []);
  const [version, setVersion] = useState(pattern.version);
  const [log, setLog] = useState<string[]>([]);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<Nokia3310Key>>(new Set());
  const [backlightOn, setBacklightOn] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      pattern.drawFrame();
      setVersion(pattern.version);
    }, 500);
    return () => clearInterval(id);
  }, [pattern]);

  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    pattern.canvas.className = "pattern-preview";
    host.appendChild(pattern.canvas);
    return () => {
      pattern.canvas.remove();
    };
  }, [pattern]);

  // Physical keyboard demo for the pressedKeys prop
  useEffect(() => {
    const update = (key: string, held: boolean) => {
      if (!KEYBOARD_KEYS.has(key)) return;
      setPressedKeys((prev) => {
        const next = new Set(prev);
        if (held) next.add(key as Nokia3310Key);
        else next.delete(key as Nokia3310Key);
        return next;
      });
    };
    const down = (e: KeyboardEvent) => update(e.key, true);
    const up = (e: KeyboardEvent) => update(e.key, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleKey = (key: Nokia3310Key, action: "down" | "up") => {
    setLog((prev) => [`${key} ${action}`, ...prev].slice(0, 30));
  };

  return (
    <div className="demo">
      <PhoneStage
        className="stage"
        screenCanvas={pattern.canvas}
        screenVersion={version}
        onKey={handleKey}
        backlightOn={backlightOn}
        pressedKeys={pressedKeys}
      />
      <aside className="sidebar">
        <h2>backlight</h2>
        <label>
          <input
            type="checkbox"
            checked={backlightOn}
            onChange={(e) => setBacklightOn(e.target.checked)}
          />{" "}
          backlight on
        </label>
        <h2>test pattern (version {version})</h2>
        <div ref={previewRef} />
        <h2>key log</h2>
        <div id="key-log">{log.join("\n")}</div>
      </aside>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
