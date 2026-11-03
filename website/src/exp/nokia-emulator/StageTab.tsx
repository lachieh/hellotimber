import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { REVEAL_MS } from "../../phone/reveal";
import { Icon, Knob, Section, Slider, Toggle } from "./controls";
import {
  DEFAULT_STAGE,
  LIGHT_ANGLE,
  LIGHT_INTENSITY,
  PITCH,
  SCALE,
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
  const [open, setOpen] = useState({ light: true, camera: true, reveal: true, size: true });
  const toggle = (key: keyof typeof open) => () =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const viewMoved = stage.yaw !== DEFAULT_STAGE.yaw || stage.pitch !== DEFAULT_STAGE.pitch;
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
        title="Camera"
        open={open.camera}
        onToggle={toggle("camera")}
        actions={
          <button
            type="button"
            className="emu-icon-button"
            aria-label="Reset the camera"
            title="Reset camera"
            disabled={!viewMoved}
            onClick={() => onChange({ yaw: DEFAULT_STAGE.yaw, pitch: DEFAULT_STAGE.pitch })}
          >
            <Icon icon={RotateCcw} />
          </button>
        }
      >
        <div className="emu-knobs">
          <Knob
            label="Orbit"
            value={stage.yaw}
            min={YAW.min}
            max={YAW.max}
            format={signed}
            unit="°"
            onChange={(yaw) => onChange({ yaw })}
          />
          <Knob
            label="Elevation"
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
