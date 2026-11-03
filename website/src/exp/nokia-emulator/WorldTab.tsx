import { HardDrive, MessageSquare, Phone, PhoneOff, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { hostClock } from "../../phone/host-clock";
import { updateSettings, useSettings } from "../../settings";
import { Icon, Led, Readout, Section, Segmented, Slider, Toggle } from "./controls";
import type { Emulator, EmulatorState } from "./emulator";
import { useLive } from "./live";
import {
  batteryBars,
  formatOffset,
  OFFSET_MINUTES,
  shiftedDate,
  SIGNAL_DBM,
  signalBars,
  type BacklightMode,
} from "./world";

const BACKLIGHT: readonly { value: BacklightMode; label: string }[] = [
  { value: "auto", label: "Firmware" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

/** How long Reset EEPROM stays armed for its confirmation. */
const CONFIRM_MS = 5000;

export function WorldTab({ emulator, state }: { emulator: Emulator; state: EmulatorState }) {
  const [open, setOpen] = useState({
    power: true,
    radio: true,
    clock: true,
    network: true,
    eeprom: true,
  });
  const toggle = (key: keyof typeof open) => () =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const { world } = state;
  const settings = useSettings();
  const live = useLive(emulator, state.runtime);
  const running = state.status === "running";
  return (
    <>
      <Section title="Power and sound" open={open.power} onToggle={toggle("power")}>
        <Toggle
          label="Sound"
          checked={!settings.muted}
          onChange={(on) => {
            updateSettings({ muted: !on });
            emulator.log("world", on ? "Sound on" : "Sound muted");
          }}
        />
        <Segmented
          label="Backlight"
          options={BACKLIGHT}
          value={world.backlight}
          onChange={(backlight) => emulator.setWorld({ backlight })}
        />
        <dl className="emu-readouts">
          <Readout label="Firmware display LED" value={live.display ? "lit" : "dark"}>
            <Led on={live.display} label="Firmware display LED" />
          </Readout>
          <Readout label="Firmware keypad LED" value={live.keypad ? "lit" : "dark"}>
            <Led on={live.keypad} label="Firmware keypad LED" />
          </Readout>
        </dl>
      </Section>

      <Section title="Battery and signal" open={open.radio} onToggle={toggle("radio")}>
        <Slider
          label="Battery"
          value={world.batteryPercent}
          min={0}
          max={100}
          unit="%"
          warn={batteryBars(world.batteryPercent) === 0}
          onChange={(batteryPercent) => emulator.setWorld({ batteryPercent })}
        />
        <Slider
          label="Signal"
          value={world.signalDbm}
          min={SIGNAL_DBM.min}
          max={SIGNAL_DBM.max}
          unit="dBm"
          warn={signalBars(world.signalDbm) === 0}
          onChange={(signalDbm) => emulator.setWorld({ signalDbm })}
        />
        <dl className="emu-readouts">
          <Readout
            label="Battery ladder"
            value={`${batteryBars(world.batteryPercent)}/4`}
            unit="bars"
          />
          <Readout label="Signal ladder" value={`${signalBars(world.signalDbm)}/4`} unit="bars" />
        </dl>
        <p className="emu-hint">
          Standby draws the ladders; other screens keep the captured full bars.
        </p>
      </Section>

      <Section title="Clock" open={open.clock} onToggle={toggle("clock")}>
        <Slider
          label="Offset from host"
          value={world.offsetMinutes}
          min={OFFSET_MINUTES.min}
          max={OFFSET_MINUTES.max}
          step={5}
          format={formatOffset}
          unit="h:mm"
          onChange={(offsetMinutes) => emulator.setWorld({ offsetMinutes })}
          onCommit={() => emulator.commitOffset()}
        />
        <dl className="emu-readouts">
          <PhoneTime offsetMinutes={world.offsetMinutes} />
        </dl>
        <button
          type="button"
          className="emu-button"
          disabled={world.offsetMinutes === 0}
          onClick={() => {
            emulator.setWorld({ offsetMinutes: 0 });
            emulator.commitOffset();
          }}
        >
          <Icon icon={RotateCcw} />
          Match host time
        </button>
      </Section>

      <Section title="Network" open={open.network} onToggle={toggle("network")}>
        <Network emulator={emulator} state={state} disabled={!running} />
      </Section>

      <Section title="EEPROM" open={open.eeprom} onToggle={toggle("eeprom")}>
        <ResetEeprom emulator={emulator} disabled={!running} />
      </Section>
    </>
  );
}

function PhoneTime({ offsetMinutes }: { offsetMinutes: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <Readout label="Host time" value={hostClock()} />
      <Readout label="Phone time" value={hostClock(shiftedDate(offsetMinutes))} />
    </>
  );
}

function Network({
  emulator,
  state,
  disabled,
}: {
  emulator: Emulator;
  state: EmulatorState;
  disabled: boolean;
}) {
  const [from, setFrom] = useState("0412345678");
  const [text, setText] = useState("Meet at the lab at 5?");
  const [caller, setCaller] = useState("0498765432");
  const call = state.call;
  const ringing = call !== undefined && call.state !== "ended";
  return (
    <>
      <form
        className="emu-form"
        onSubmit={(event) => {
          event.preventDefault();
          emulator.incomingSms(from.trim(), text);
        }}
      >
        <label className="emu-field">
          <span>SMS from</span>
          <input
            inputMode="tel"
            autoComplete="off"
            spellCheck={false}
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
        </label>
        <label className="emu-field">
          <span>Text</span>
          <textarea
            rows={2}
            maxLength={160}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
          />
          <span className="emu-num emu-field__count">{text.length}/160</span>
        </label>
        <button type="submit" className="emu-button" disabled={disabled || from.trim() === ""}>
          <Icon icon={MessageSquare} />
          Deliver SMS
        </button>
      </form>
      <form
        className="emu-form"
        onSubmit={(event) => {
          event.preventDefault();
          emulator.incomingCall(caller.trim());
        }}
      >
        <label className="emu-field">
          <span>Call from</span>
          <input
            inputMode="tel"
            autoComplete="off"
            spellCheck={false}
            value={caller}
            onChange={(event) => setCaller(event.currentTarget.value)}
          />
        </label>
        <div className="emu-row">
          <button type="submit" className="emu-button" disabled={disabled || caller.trim() === ""}>
            <Icon icon={Phone} />
            Ring
          </button>
          <button
            type="button"
            className="emu-button"
            disabled={!ringing}
            onClick={() => emulator.hangUp()}
          >
            <Icon icon={PhoneOff} />
            Hang up
          </button>
        </div>
        <dl className="emu-readouts">
          <Readout
            label="Call"
            value={call === undefined ? "idle" : `${call.state} · ${call.number}`}
          >
            <Led on={ringing} label="Call" />
          </Readout>
        </dl>
      </form>
    </>
  );
}

function ResetEeprom({ emulator, disabled }: { emulator: Emulator; disabled: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <>
      <p className="emu-hint">
        Settings, messages, contacts and scores live in this browser, apart from the home page
        phone. A reset switches the phone on virgin.
      </p>
      <div className="emu-row">
        {armed ? (
          <>
            <button
              type="button"
              className="emu-button"
              data-warn=""
              autoFocus
              onClick={() => {
                setArmed(false);
                void emulator.resetEeprom();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  event.preventDefault();
                  setArmed(false);
                }
              }}
            >
              <Icon icon={HardDrive} />
              Erase and restart
            </button>
            <button type="button" className="emu-button" onClick={() => setArmed(false)}>
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="emu-button"
            disabled={disabled}
            onClick={() => setArmed(true)}
          >
            <Icon icon={HardDrive} />
            Reset EEPROM
          </button>
        )}
      </div>
      {armed && (
        <p className="emu-hint" data-warn="" role="alert">
          Erase everything the phone stored? This can't be undone.
        </p>
      )}
    </>
  );
}
