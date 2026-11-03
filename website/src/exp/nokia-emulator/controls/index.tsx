import type { LucideIcon } from "lucide-react";
import { useId, useRef } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

/** A 1px thin-line icon (lucide, at a fixed 1px stroke whatever its size). */
export function Icon({ icon: Glyph, size = 14 }: { icon: LucideIcon; size?: number }) {
  return (
    <Glyph
      className="emu-icon"
      size={size}
      strokeWidth={1}
      absoluteStrokeWidth
      aria-hidden="true"
      focusable="false"
    />
  );
}

/** A label, a value in tabular mono and its unit: one row of a readout table. */
export function Readout({
  label,
  value,
  unit,
  warn,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  warn?: boolean;
  /** Anything after the value (an LED). */
  children?: ReactNode;
}) {
  return (
    <div className="emu-readout" data-warn={warn ? "" : undefined}>
      <dt>{label}</dt>
      <dd>
        {children}
        <span className="emu-num">{value}</span>
        {unit !== undefined && <span className="emu-unit">{unit}</span>}
      </dd>
    </div>
  );
}

/** A status LED: lit in the signal colour, amber when it warns, dark when off. */
export function Led({ on, warn, label }: { on: boolean; warn?: boolean; label: string }) {
  return (
    <span
      className="emu-led"
      data-on={on ? "" : undefined}
      data-warn={warn ? "" : undefined}
      role="img"
      aria-label={`${label}: ${on ? "on" : "off"}`}
    />
  );
}

/** A 2px switch. */
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="emu-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="emu-toggle__label">{label}</span>
      <span className="emu-toggle__track" aria-hidden="true">
        <span className="emu-toggle__thumb" />
      </span>
    </button>
  );
}

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The value as shown (units included in `unit`). */
  format?: (value: number) => string;
  unit?: string;
  onChange: (value: number) => void;
  /** The drag or key press that set the value has ended. */
  onCommit?: () => void;
  warn?: boolean;
  disabled?: boolean;
}

/** A grooved slider over a native range input (keyboard and assistive tech for free). */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  unit,
  onChange,
  onCommit,
  warn,
  disabled,
}: RangeProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="emu-slider" data-warn={warn ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id} className="emu-num">
        {format(value)}
        {unit !== undefined && <span className="emu-unit">{unit}</span>}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${format(value)}${unit === undefined ? "" : ` ${unit}`}`}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

/** Pixels of vertical drag that sweep the knob's whole range. */
const KNOB_DRAG_PX = 160;
/** The knob's sweep, degrees either side of straight up. */
const KNOB_SWEEP = 135;

/** A small rotary knob: drag up or down, or use the arrow, Page and Home/End keys. */
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  unit,
  onChange,
  onCommit,
  disabled,
}: RangeProps) {
  const id = useId();
  const drag = useRef<{ y: number; value: number } | undefined>(undefined);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const t = (value - min) / (max - min);
  const angle = -KNOB_SWEEP + t * 2 * KNOB_SWEEP;
  const arc = describeArc(-KNOB_SWEEP, angle);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = Math.max(step, (max - min) / 10);
    const next: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (!(event.key in next)) return;
    // The page's phone listens for arrows too: the knob keeps the keys it uses.
    event.preventDefault();
    event.stopPropagation();
    onChange(clamp(next[event.key]!));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, value };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === undefined) return;
    const dy = drag.current.y - event.clientY;
    onChange(clamp(drag.current.value + (dy / KNOB_DRAG_PX) * (max - min)));
  };
  const endDrag = () => {
    if (drag.current === undefined) return;
    drag.current = undefined;
    onCommit?.();
  };
  return (
    <div className="emu-knob">
      <div
        id={id}
        className="emu-knob__dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${format(value)}${unit === undefined ? "" : ` ${unit}`}`}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        onKeyUp={onCommit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          onChange(clamp((min + max) / 2));
          onCommit?.();
        }}
      >
        <svg viewBox="-16 -16 32 32" aria-hidden="true">
          <path className="emu-knob__track" d={describeArc(-KNOB_SWEEP, KNOB_SWEEP)} />
          <path className="emu-knob__value" d={arc} />
          <circle className="emu-knob__body" r="9" />
          <line
            className="emu-knob__pointer"
            x1="0"
            y1="-3"
            x2="0"
            y2="-8"
            transform={`rotate(${angle})`}
          />
        </svg>
      </div>
      <span className="emu-knob__label" aria-hidden="true">
        {label}
      </span>
      <span className="emu-num emu-knob__value-text" aria-hidden="true">
        {format(value)}
        {unit !== undefined && <span className="emu-unit">{unit}</span>}
      </span>
    </div>
  );
}

/** An SVG arc on the knob's 13-unit ring from `from` to `to` degrees (0 = up, clockwise). */
function describeArc(from: number, to: number): string {
  const r = 13;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(3)} ${(r * Math.sin(rad)).toFixed(3)}`;
  };
  if (to <= from) return `M ${point(from)}`;
  const large = to - from > 180 ? 1 : 0;
  return `M ${point(from)} A ${r} ${r} 0 ${large} 1 ${point(to)}`;
}

/** A segmented control: one choice of a few, as a radio group with arrow-key movement. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const index = options.findIndex((option) => option.value === value);
    const next = (index + by + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div className="emu-segmented">
      <span className="emu-segmented__label" id={id}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="emu-segmented__group" onKeyDown={move}>
        {options.map((option, i) => (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A titled group in a tab, collapsible. */
export function Section({
  title,
  children,
  actions,
  open,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <section className="emu-section" data-open={open ? "" : undefined}>
      <header className="emu-section__head">
        <h3>
          <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
            <svg className="emu-chevron" viewBox="0 0 8 8" aria-hidden="true">
              <path d="M2.5 1.5 5.5 4 2.5 6.5" />
            </svg>
            {title}
          </button>
        </h3>
        {actions !== undefined && <div className="emu-section__actions">{actions}</div>}
      </header>
      <div id={id} className="emu-section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
