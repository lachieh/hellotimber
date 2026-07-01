import Key from "./Key";
import { KEY_LAYOUT } from "./layout";
import type { Nokia3310Key } from "./types";

export interface KeypadProps {
  backlightOn: boolean;
  pressedKeys?: ReadonlySet<Nokia3310Key>;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
}

/** The seventeen physical keys, one pressable mesh each. */
export default function Keypad({ backlightOn, pressedKeys, onKey }: KeypadProps) {
  return (
    <>
      {KEY_LAYOUT.map((entry) => (
        <Key
          key={entry.key}
          entry={entry}
          backlightOn={backlightOn}
          pressed={pressedKeys?.has(entry.key) ?? false}
          onKey={onKey}
        />
      ))}
    </>
  );
}
