/* Hand-authored 16×16 pixel icons in the spirit of the 2000-era desktop. */

type IconProps = { size?: number };

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className="sr-pc-suite__icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** A handset joined to a cable: the app icon. */
export function AppIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="1" width="6" height="13" fill="#1d3a5c" />
      <rect x="5" y="2" width="4" height="4" fill="#b7d79a" />
      <rect x="5" y="7" width="4" height="1" fill="#8aa8c8" />
      <rect x="5" y="9" width="1" height="1" fill="#d4d0c8" />
      <rect x="7" y="9" width="1" height="1" fill="#d4d0c8" />
      <rect x="5" y="11" width="1" height="1" fill="#d4d0c8" />
      <rect x="7" y="11" width="1" height="1" fill="#d4d0c8" />
      <rect x="6" y="14" width="2" height="1" fill="#404040" />
      <rect x="7" y="15" width="7" height="1" fill="#404040" />
      <rect x="13" y="12" width="1" height="3" fill="#404040" />
      <rect x="12" y="10" width="3" height="2" fill="#808080" />
    </Svg>
  );
}

/** A small CRT showing an LCD: the Phone monitor window. */
export function MonitorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1" y="2" width="14" height="10" fill="#404040" />
      <rect x="2" y="3" width="12" height="8" fill="#d4d0c8" />
      <rect x="3" y="4" width="10" height="6" fill="#b7d79a" />
      <rect x="4" y="5" width="5" height="1" fill="#2c3a1e" />
      <rect x="4" y="7" width="7" height="1" fill="#2c3a1e" />
      <rect x="6" y="12" width="4" height="2" fill="#808080" />
      <rect x="4" y="14" width="8" height="1" fill="#404040" />
    </Svg>
  );
}

/** A dial knob over a slider: the Settings window. */
export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1" y="3" width="14" height="2" fill="#808080" />
      <rect x="1" y="11" width="14" height="2" fill="#808080" />
      <rect x="4" y="1" width="3" height="6" fill="#0a246a" />
      <rect x="5" y="2" width="1" height="4" fill="#a6caf0" />
      <rect x="9" y="9" width="3" height="6" fill="#0a246a" />
      <rect x="10" y="10" width="1" height="4" fill="#a6caf0" />
    </Svg>
  );
}

/** A 3×3 keypad: the Keypad window. */
export function KeypadIcon(props: IconProps) {
  const keys = [2, 6, 10].flatMap((y) => [2, 6, 10].map((x) => ({ x, y })));
  return (
    <Svg {...props}>
      <rect x="1" y="1" width="14" height="14" fill="#404040" />
      {keys.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="3" fill="#ffffff" />
      ))}
    </Svg>
  );
}

/** A head and shoulders on a card: the owner Properties window. */
export function PersonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1" y="2" width="14" height="12" fill="#ffffff" />
      <rect x="1" y="2" width="14" height="1" fill="#404040" />
      <rect x="1" y="13" width="14" height="1" fill="#404040" />
      <rect x="1" y="2" width="1" height="12" fill="#404040" />
      <rect x="14" y="2" width="1" height="12" fill="#404040" />
      <rect x="4" y="4" width="3" height="3" fill="#b0632c" />
      <rect x="3" y="8" width="5" height="4" fill="#0a246a" />
      <rect x="9" y="5" width="4" height="1" fill="#808080" />
      <rect x="9" y="8" width="4" height="1" fill="#808080" />
      <rect x="9" y="10" width="3" height="1" fill="#808080" />
    </Svg>
  );
}

/** Closed or open folder for the path tree. */
export function FolderIcon({ open = false, ...props }: IconProps & { open?: boolean }) {
  return (
    <Svg {...props}>
      <rect x="1" y="3" width="6" height="2" fill="#c8a032" />
      <rect x="1" y="4" width="14" height="10" fill="#e8c44a" />
      <rect x="1" y="13" width="14" height="1" fill="#8c6a12" />
      {open ? <rect x="3" y="7" width="13" height="7" fill="#f6dc7a" /> : null}
    </Svg>
  );
}

/** A screen leaf in the path tree. */
export function ScreenLeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="1" width="10" height="14" fill="#404040" />
      <rect x="4" y="2" width="8" height="12" fill="#ffffff" />
      <rect x="5" y="4" width="6" height="4" fill="#b7d79a" />
      <rect x="5" y="10" width="6" height="1" fill="#808080" />
      <rect x="5" y="12" width="4" height="1" fill="#808080" />
    </Svg>
  );
}

/** Plug-and-socket tray icon for the connection. */
export function PlugIcon({ connected, ...props }: IconProps & { connected: boolean }) {
  return (
    <Svg {...props}>
      <rect x="1" y="6" width="5" height="5" fill="#404040" />
      <rect x="6" y="7" width="2" height="1" fill="#808080" />
      <rect x="6" y="9" width="2" height="1" fill="#808080" />
      <rect x={connected ? 8 : 10} y="5" width="5" height="7" fill="#808080" />
      <rect x={connected ? 13 : 15} y="8" width="2" height="1" fill="#404040" />
      {connected ? <rect x="2" y="7" width="1" height="1" fill="#5ad25a" /> : null}
    </Svg>
  );
}

/** Speaker tray icon; `muted` adds the strike. */
export function SpeakerIcon({ muted, ...props }: IconProps & { muted: boolean }) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="3" height="4" fill="#404040" />
      <polygon points="5,6 9,2 9,14 5,10" fill="#404040" />
      {muted ? (
        <path d="M10 5 L15 11 M15 5 L10 11" stroke="#c00000" strokeWidth="1.5" />
      ) : (
        <>
          <rect x="11" y="6" width="1" height="4" fill="#404040" />
          <rect x="13" y="4" width="1" height="8" fill="#404040" />
        </>
      )}
    </Svg>
  );
}

/** Information balloon used for the contextual hint. */
export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="#ffffff"
        stroke="#0a246a"
        shapeRendering="geometricPrecision"
      />
      <rect x="7" y="3" width="2" height="2" fill="#0a246a" />
      <rect x="7" y="6" width="2" height="6" fill="#0a246a" />
      <rect x="6" y="11" width="4" height="1" fill="#0a246a" />
    </Svg>
  );
}

/** A chain link for outbound links. */
export function LinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6.5 9.5 L9.5 6.5 M7 4.5 L8.5 3 a2.5 2.5 0 0 1 3.5 3.5 L10.5 8 M9 11.5 L7.5 13 a2.5 2.5 0 0 1 -3.5 -3.5 L5.5 8"
        fill="none"
        stroke="#0a246a"
        strokeWidth="1.5"
        shapeRendering="geometricPrecision"
      />
    </Svg>
  );
}

/** Scroll arrows for the up/down keys. */
export function ArrowIcon({ dir, ...props }: IconProps & { dir: "up" | "down" }) {
  return (
    <Svg {...props}>
      <polygon points={dir === "up" ? "8,4 13,10 3,10" : "3,6 13,6 8,12"} fill="currentColor" />
    </Svg>
  );
}

/** The window-control minimise bar. */
export function MinimiseGlyph() {
  return (
    <svg width="8" height="7" viewBox="0 0 8 7" aria-hidden="true" focusable="false">
      <rect x="0" y="5" width="6" height="2" fill="currentColor" />
    </svg>
  );
}
