import { site } from "../content/site";
import "./pencil-case.css";

/** A navy nylon pencil case: the name on masking tape, the rest in correction pen. */
export default function PencilCase() {
  return (
    <section className="d01-obj d01-case" aria-labelledby="d01-case-name">
      <CaseFilters />
      <Zip />
      <h2 id="d01-case-name" className="d01-pc__tape-wrap">
        <span className="d01-pc__tape">{site.name}</span>
      </h2>
      <div className="d01-pc__ink">
        <p className="d01-pc__job">{site.jobTitle}</p>
        <p className="d01-pc__tagline">{site.tagline}</p>
        <ul className="d01-pc__links">
          {site.sameAs.map((href) => (
            <li key={href}>
              <a href={href} rel="me noreferrer" target="_blank">
                {href.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Correction fluid dries chalky: grainy coverage and slightly lumpy edges. */
function CaseFilters() {
  return (
    <svg className="d01-pc__defs" aria-hidden="true" focusable="false">
      <filter id="d01-pc-chalk" x="-4%" y="-8%" width="108%" height="116%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed="4"
          result="grain"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="grain"
          scale="1.4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="lumpy"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 0 0 0 1.55"
          result="speckle"
        />
        <feComposite in="lumpy" in2="speckle" operator="in" />
      </filter>
    </svg>
  );
}

/** Interlocking metal teeth along the top seam, with the slider and its pull tab. */
function Zip() {
  return (
    <div className="d01-pc__zip" aria-hidden="true">
      <svg className="d01-pc__teeth" width="100%" height="14">
        <defs>
          <linearGradient id="d01pc-tooth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef0f3" />
            <stop offset="1" stopColor="#8b919a" />
          </linearGradient>
          <pattern id="d01pc-teeth" width="5" height="14" patternUnits="userSpaceOnUse">
            <rect x="0.4" y="1.5" width="3" height="6.4" rx="1" fill="url(#d01pc-tooth)" />
            <rect x="2.9" y="6.1" width="3" height="6.4" rx="1" fill="url(#d01pc-tooth)" />
          </pattern>
        </defs>
        <rect width="100%" height="14" rx="2" fill="#0f1630" />
        <rect y="0.5" width="100%" height="13" fill="url(#d01pc-teeth)" />
      </svg>
      <svg className="d01-pc__slider" viewBox="0 0 30 56">
        <defs>
          <linearGradient id="d01pc-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6f7f9" />
            <stop offset="0.45" stopColor="#b9bec6" />
            <stop offset="1" stopColor="#6d737c" />
          </linearGradient>
        </defs>
        <path
          d="M3 3 Q3 0 6 0 H24 Q27 0 27 3 L24 18 H6 Z"
          fill="url(#d01pc-metal)"
          stroke="#5a6068"
          strokeWidth="0.8"
        />
        <rect x="11" y="13" width="8" height="8" rx="2" fill="#7d838c" />
        <g transform="rotate(-6 15 18)">
          <path
            d="M9 17 H21 Q23 17 23 19 L22 50 Q22 55 15 55 Q8 55 8 50 L7 19 Q7 17 9 17 Z"
            fill="url(#d01pc-metal)"
            stroke="#5a6068"
            strokeWidth="0.8"
          />
          <rect x="12" y="40" width="6" height="9" rx="3" fill="#141b36" />
          <path
            d="M10 22 L11 38"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
