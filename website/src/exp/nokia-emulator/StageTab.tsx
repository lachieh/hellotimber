import { Check, Copy, Play, RotateCcw } from "lucide-react";
import type { LcdShadow } from "@hellotimber/phone-3d";
import { useState } from "react";
import { REVEAL_MS } from "../../phone/reveal";
import { Icon, Knob, Section, Slider, Toggle } from "./controls";
import {
  DEFAULT_STAGE,
  LIGHT_ANGLE,
  LCD_SHADOW_RANGE,
  LIGHT_INTENSITY,
  PITCH,
  SCALE,
  TILT,
  YAW,
  type StageSettings,
} from "./stage-settings";

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

export function StageTab({
  stage,
  onChange,
  onReplay,
  motion,
}: {
  stage: StageSettings;
  onChange: (patch: Partial<StageSettings>) => void;
  onReplay: () => void;
  /** False under reduced motion: the float stays off. */
  motion: boolean;
}) {
  const [open, setOpen] = useState({
    light: true,
    tilt: true,
    shadow: true,
    turn: true,
    reveal: true,
    size: true,
  });
  const toggle = (key: keyof typeof open) => () =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const viewMoved = stage.yaw !== DEFAULT_STAGE.yaw || stage.pitch !== DEFAULT_STAGE.pitch;
  const tilted = stage.tilt.x !== 0 || stage.tilt.y !== 0;
  const shadow = stage.lcdShadow;
  const setShadow = (patch: Partial<LcdShadow>) =>
    onChange({ lcdShadow: { ...stage.lcdShadow, ...patch } });
  const shadowMoved = (Object.keys(LCD_SHADOW_RANGE) as (keyof typeof LCD_SHADOW_RANGE)[]).some(
    (key) => shadow[key] !== DEFAULT_STAGE.lcdShadow[key],
  );
  const [copied, setCopied] = useState(false);
  const copyShadow = () => {
    const { highlight: _, ...values } = shadow;
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <>
      <Section title="Key light" open={open.light} onToggle={toggle("light")}>
        <div className="emu-knobs">
          <Knob
            label="Bearing"
            value={stage.lightAngle}
            min={LIGHT_ANGLE.min}
            max={LIGHT_ANGLE.max}
            step={5}
            format={signed}
            unit="°"
            onChange={(lightAngle) => onChange({ lightAngle })}
          />
          <Knob
            label="Intensity"
            value={stage.lightIntensity}
            min={LIGHT_INTENSITY.min}
            max={LIGHT_INTENSITY.max}
            step={0.05}
            format={(v) => v.toFixed(2)}
            unit="×"
            onChange={(lightIntensity) => onChange({ lightIntensity })}
          />
        </div>
        <p className="emu-hint">
          A rim light sits opposite the key; a warm bounce comes off the floor.
        </p>
      </Section>

      <Section
        title="Device tilt"
        open={open.tilt}
        onToggle={toggle("tilt")}
        actions={
          <button
            type="button"
            className="emu-icon-button"
            aria-label="Level the device"
            title="Level"
            disabled={!tilted}
            onClick={() => onChange({ tilt: { x: 0, y: 0 } })}
          >
            <Icon icon={RotateCcw} />
          </button>
        }
      >
        <div className="emu-knobs">
          <Knob
            label="Roll"
            value={stage.tilt.x}
            min={TILT.min}
            max={TILT.max}
            format={signed}
            unit="°"
            onChange={(x) => onChange({ tilt: { ...stage.tilt, x } })}
          />
          <Knob
            label="Pitch"
            value={stage.tilt.y}
            min={TILT.min}
            max={TILT.max}
            format={signed}
            unit="°"
            onChange={(y) => onChange({ tilt: { ...stage.tilt, y } })}
          />
        </div>
        <p className="emu-hint">
          Holds the handset tilted, as the tilt sensor would: the lights swing against it.
        </p>
      </Section>

      <Section
        title="LCD shadow"
        open={open.shadow}
        onToggle={toggle("shadow")}
        actions={
          <>
            <button
              type="button"
              className="emu-icon-button"
              aria-label="Copy the LCD shadow's values"
              title={copied ? "Copied" : "Copy values"}
              onClick={copyShadow}
            >
              <Icon icon={copied ? Check : Copy} />
            </button>
            <button
              type="button"
              className="emu-icon-button"
              aria-label="Reset the LCD shadow"
              title="Reset"
              disabled={!shadowMoved}
              onClick={() =>
                onChange({
                  lcdShadow: { ...DEFAULT_STAGE.lcdShadow, highlight: shadow.highlight },
                })
              }
            >
              <Icon icon={RotateCcw} />
            </button>
          </>
        }
      >
        <Slider
          label="Darkness"
          value={shadow.opacity}
          {...LCD_SHADOW_RANGE.opacity}
          format={(v) => v.toFixed(2)}
          onChange={(opacity) => setShadow({ opacity })}
        />
        <Slider
          label="Recess depth"
          value={shadow.depth}
          {...LCD_SHADOW_RANGE.depth}
          format={(v) => v.toFixed(2)}
          unit="×"
          onChange={(depth) => setShadow({ depth })}
        />
        <Slider
          label="Edge softness"
          value={shadow.softness}
          {...LCD_SHADOW_RANGE.softness}
          format={(v) => v.toFixed(2)}
          unit="× recess"
          onChange={(softness) => setShadow({ softness })}
        />
        <Slider
          label="Softens with length"
          value={shadow.spread}
          {...LCD_SHADOW_RANGE.spread}
          format={(v) => v.toFixed(2)}
          onChange={(spread) => setShadow({ spread })}
        />
        <Slider
          label="Longest"
          value={shadow.reach}
          {...LCD_SHADOW_RANGE.reach}
          format={(v) => v.toFixed(1)}
          unit="× recess"
          onChange={(reach) => setShadow({ reach })}
        />
        <Toggle
          label="Show in red"
          checked={shadow.highlight}
          onChange={(highlight) => setShadow({ highlight })}
        />
        <p className="emu-hint">
          Cast by the brightest light (the key) over the lip the LCD sits under. Scrub the reveal to
          see it with the phone flat and popping out.
        </p>
      </Section>

      <Section
        title="Turn"
        open={open.turn}
        onToggle={toggle("turn")}
        actions={
          <button
            type="button"
            className="emu-icon-button"
            aria-label="Reset the phone's turn"
            title="Reset turn"
            disabled={!viewMoved}
            onClick={() => onChange({ yaw: DEFAULT_STAGE.yaw, pitch: DEFAULT_STAGE.pitch })}
          >
            <Icon icon={RotateCcw} />
          </button>
        }
      >
        <div className="emu-knobs">
          <Knob
            label="Turn"
            value={stage.yaw}
            min={YAW.min}
            max={YAW.max}
            format={signed}
            unit="°"
            onChange={(yaw) => onChange({ yaw })}
          />
          <Knob
            label="Tip"
            value={stage.pitch}
            min={PITCH.min}
            max={PITCH.max}
            format={signed}
            unit="°"
            onChange={(pitch) => onChange({ pitch })}
          />
        </div>
        <Toggle
          label={motion ? "Idle float" : "Idle float (reduced motion)"}
          checked={stage.float && motion}
          disabled={!motion}
          onChange={(float) => onChange({ float })}
        />
      </Section>

      <Section
        title="Reveal"
        open={open.reveal}
        onToggle={toggle("reveal")}
        actions={
          <button
            type="button"
            className="emu-icon-button"
            aria-label="Play the reveal"
            title="Play"
            onClick={onReplay}
          >
            <Icon icon={Play} />
          </button>
        }
      >
        <Slider
          label="Sketch to 3D"
          value={Math.round(stage.reveal)}
          min={0}
          max={REVEAL_MS}
          step={10}
          unit="ms"
          onChange={(reveal) => onChange({ reveal })}
        />
        <p className="emu-hint">
          The home page's entrance: the drawing wipes into the model as it leaps.
        </p>
      </Section>

      <Section title="Size" open={open.size} onToggle={toggle("size")}>
        <Slider
          label="Phone scale"
          value={stage.scale}
          min={SCALE.min}
          max={SCALE.max}
          unit="%"
          onChange={(scale) => onChange({ scale })}
        />
      </Section>
    </>
  );
}
