import { updateSettings, useSettings } from "./live";
import "./walkman.css";

/** A brushed-aluminium cassette player whose orange slide switches are the phone's Sound and Lights. */
export default function Walkman() {
  const settings = useSettings();
  return (
    <section
      className="d01-obj d01-walkman"
      aria-labelledby="d01-walkman-title"
      data-playing={!settings.muted}
    >
      <h2 id="d01-walkman-title" className="d01-sr">
        Phone sound and lights
      </h2>
      <WalkmanCord />
      <div className="d01-wm">
        <WalkmanBody />
        <div className="d01-wm__switches">
          <Slide
            label="Sound"
            on={!settings.muted}
            onToggle={() => {
              updateSettings({ muted: !settings.muted });
            }}
          />
          <Slide
            label="Lights"
            on={settings.backlight}
            onToggle={() => {
              updateSettings({ backlight: !settings.backlight });
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Slide({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="d01-slide"
      data-on={on}
      onClick={onToggle}
    >
      <span className="d01-slide__label">{label}</span>
      <span className="d01-slide__row" aria-hidden="true">
        <span className="d01-slide__mark">off</span>
        <span className="d01-slide__track">
          <span className="d01-slide__knob" />
        </span>
        <span className="d01-slide__mark">on</span>
      </span>
    </button>
  );
}

/* The casing is drawn at 300 × 224; the switches sit in its lower band (y 150–214). */
function WalkmanBody() {
  return (
    <svg className="d01-wm__body" viewBox="0 0 300 224" aria-hidden="true">
      <defs>
        <linearGradient id="d01wm-alu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4e8ec" />
          <stop offset="0.42" stopColor="#cdd2d8" />
          <stop offset="0.5" stopColor="#bcc2c9" />
          <stop offset="1" stopColor="#c9ced4" />
        </linearGradient>
        <linearGradient id="d01wm-sheen" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.58" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.72" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="d01wm-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#9aa1a9" />
          <stop offset="1" stopColor="#5f666e" />
        </linearGradient>
        <linearGradient id="d01wm-recess" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1013" />
          <stop offset="1" stopColor="#2b3238" />
        </linearGradient>
        <linearGradient id="d01wm-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9d4c8" />
          <stop offset="1" stopColor="#b7b1a3" />
        </linearGradient>
        <linearGradient id="d01wm-key" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f3f5" />
          <stop offset="1" stopColor="#aab1b9" />
        </linearGradient>
        <radialGradient id="d01wm-jack">
          <stop offset="0" stopColor="#050607" />
          <stop offset="0.55" stopColor="#1b1f23" />
          <stop offset="0.62" stopColor="#e9ecef" />
          <stop offset="1" stopColor="#7d848c" />
        </radialGradient>
        {/* Brushed metal: noise stretched hard along x, so it reads as fine horizontal grain. */}
        <filter id="d01wm-brush" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.9" numOctaves="3" seed="3" />
          <feColorMatrix
            type="matrix"
            values="1.2 0 0 0 -0.1  1.2 0 0 0 -0.1  1.2 0 0 0 -0.1  0 0 0 0 1"
          />
        </filter>
        <clipPath id="d01wm-face">
          <rect x="1" y="1" width="296" height="219" rx="17" />
        </clipPath>
        <clipPath id="d01wm-tapewin">
          <rect x="74" y="54" width="152" height="34" rx="4" />
        </clipPath>
      </defs>

      {/* casing: the lower-right rim is the side of the body, in shade */}
      <rect x="0" y="0" width="300" height="224" rx="18" fill="url(#d01wm-rim)" />
      <rect x="1" y="1" width="296" height="219" rx="17" fill="url(#d01wm-alu)" />
      <rect
        x="1"
        y="1"
        width="296"
        height="219"
        rx="17"
        filter="url(#d01wm-brush)"
        clipPath="url(#d01wm-face)"
        opacity="0.5"
        style={{ mixBlendMode: "overlay" }}
      />
      <rect x="1" y="1" width="296" height="219" rx="17" fill="url(#d01wm-sheen)" />
      <rect
        x="2"
        y="2"
        width="294"
        height="217"
        rx="16"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.75"
        strokeWidth="1"
      />

      {/* headphone jack on the top edge, where the cord plugs in */}
      <circle cx="222" cy="7" r="5.2" fill="url(#d01wm-jack)" />
      <text className="d01-wm__silk" x="234" y="10" fontSize="5">
        PHONES
      </text>

      {/* tape window: a smoked lid over the cassette */}
      <rect x="15" y="16" width="270" height="90" rx="9" fill="url(#d01wm-recess)" />
      <rect
        x="15.5"
        y="16.5"
        width="269"
        height="89"
        rx="8.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
      />
      <g opacity="0.82">
        <rect x="28" y="22" width="244" height="78" rx="5" fill="url(#d01wm-shell)" />
        <rect x="38" y="26" width="224" height="22" rx="2" fill="#f2ecdf" />
        <rect x="38" y="40" width="224" height="5" fill="#e0632a" />
        <text className="d01-wm__label" x="46" y="38" fontSize="12">
          summer mix &apos;01
        </text>
        <text className="d01-wm__silk" x="244" y="37" fontSize="6" fill="#6a5f50">
          A
        </text>
        <rect x="74" y="54" width="152" height="34" rx="4" fill="#3b3430" />
        <g clipPath="url(#d01wm-tapewin)">
          <circle cx="99" cy="71" r="27" fill="#4b2e21" />
          <circle cx="201" cy="71" r="17" fill="#4b2e21" />
          <circle cx="99" cy="71" r="27" fill="none" stroke="#6b4433" strokeWidth="0.6" />
          <circle cx="201" cy="71" r="17" fill="none" stroke="#6b4433" strokeWidth="0.6" />
        </g>
        <Hub cx={99} cy={71} className="d01-wm__hub d01-wm__hub--full" />
        <Hub cx={201} cy={71} className="d01-wm__hub d01-wm__hub--empty" />
        <circle cx="52" cy="90" r="3" fill="#8f877a" />
        <circle cx="248" cy="90" r="3" fill="#8f877a" />
      </g>
      {/* glare across the smoked lid */}
      <path d="M15 40 L70 16 L118 16 L15 78 Z" fill="#fff" opacity="0.13" />
      <path d="M150 106 L262 16 L276 16 L172 106 Z" fill="#fff" opacity="0.07" />

      {/* transport keys and silkscreen */}
      <text className="d01-wm__silk" x="18" y="122" fontSize="6.4">
        STEREO CASSETTE PLAYER
      </text>
      <text className="d01-wm__silk" x="18" y="132" fontSize="4.6" fill="#59616a">
        AUTO REVERSE · 2 BAND EQ
      </text>
      {TRANSPORT.map(({ x, icon }) => (
        <g key={x} transform={`translate(${x} 113)`}>
          <rect x="0" y="0" width="27" height="20" rx="4" fill="#5d646c" />
          <rect x="0.6" y="0.4" width="25.8" height="18.6" rx="3.5" fill="url(#d01wm-key)" />
          <path d={icon} fill="#2b3238" />
        </g>
      ))}
      <text className="d01-wm__silk" x="168" y="141" fontSize="4.2" fill="#59616a">
        REW
      </text>
      <text className="d01-wm__silk" x="200" y="141" fontSize="4.2" fill="#59616a">
        PLAY
      </text>
      <text className="d01-wm__silk" x="230" y="141" fontSize="4.2" fill="#59616a">
        FF
      </text>
      <text className="d01-wm__silk" x="258" y="141" fontSize="4.2" fill="#59616a">
        STOP
      </text>

      {/* engraved groove above the switch band */}
      <line x1="16" y1="148" x2="284" y2="148" stroke="#6c737b" strokeWidth="0.9" />
      <line
        x1="16"
        y1="149"
        x2="284"
        y2="149"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="0.9"
      />
    </svg>
  );
}

const TRANSPORT = [
  { x: 166, icon: "M7 10 L13 5.5 V14.5 Z M13 10 L19 5.5 V14.5 Z" },
  { x: 196, icon: "M10 5 L18 10 L10 15 Z" },
  { x: 226, icon: "M8 5.5 L14 10 L8 14.5 Z M14 5.5 L20 10 L14 14.5 Z" },
  { x: 256, icon: "M9 6 H18 V14 H9 Z" },
];

/** A cassette hub: a white sprocket ring around a toothed hole. Turns while Sound is on. */
function Hub({ cx, cy, className }: { cx: number; cy: number; className: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={className}>
        <circle r="10.5" fill="#f6f2e9" stroke="#a79f8f" strokeWidth="0.8" />
        <circle r="6.6" fill="#16120f" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x="-1.3"
            y="-6.8"
            width="2.6"
            height="3"
            fill="#f6f2e9"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
    </g>
  );
}

function WalkmanCord() {
  return (
    <svg className="d01-walkman__cord" viewBox="0 0 160 260" aria-hidden="true">
      <path
        d="M120 232 C 120 170, 30 180, 50 110 S 150 40, 96 -20"
        fill="none"
        stroke="#1d1b1a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="114" y="222" width="12" height="22" rx="3" fill="#2a2725" />
      <rect x="115" y="224" width="3" height="18" rx="1.5" fill="#fff" fillOpacity="0.18" />
      <rect x="116.5" y="244" width="7" height="8" fill="#c8c3b7" />
      <rect x="116.5" y="248" width="7" height="1" fill="#6f6a60" />
    </svg>
  );
}
