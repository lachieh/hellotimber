import { Canvas } from "@react-three/fiber";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PhoneBody } from "../PhoneBody";
import { Screen } from "../Screen";
import { createTestPattern } from "./test-pattern";

function App() {
  const pattern = useMemo(() => createTestPattern(), []);
  const [version, setVersion] = useState(pattern.version);
  const previewRef = useRef<HTMLDivElement>(null);

  // Animate the test pattern at 2 fps — counter + checkerboard flip
  useEffect(() => {
    const id = setInterval(() => {
      pattern.drawFrame();
      setVersion(pattern.version);
    }, 500);
    return () => clearInterval(id);
  }, [pattern]);

  // Show the live pattern canvas itself in the sidebar
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    pattern.canvas.className = "pattern-preview";
    host.appendChild(pattern.canvas);
    return () => {
      pattern.canvas.remove();
    };
  }, [pattern]);

  return (
    <div className="demo">
      <div className="stage">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 18], fov: 40 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 6, 8]} intensity={1.4} />
          <directionalLight position={[-5, -2, 4]} intensity={0.3} />
          <PhoneBody />
          <Screen screenCanvas={pattern.canvas} screenVersion={version} />
        </Canvas>
      </div>
      <aside className="sidebar">
        <h2>test pattern (version {version})</h2>
        <div ref={previewRef} />
        <h2>key log</h2>
        <div id="key-log">(keypad arrives in Task 5)</div>
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
