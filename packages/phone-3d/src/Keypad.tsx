import { Key } from "./Key";
import { KEY_LAYOUT } from "./layout";
import type { Nokia3310Key } from "./types";

export interface KeypadProps {
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  pressedKeys?: ReadonlySet<Nokia3310Key>;
}

/** All 17 keys from KEY_LAYOUT as independent pressable meshes. */
export function Keypad({ onKey, pressedKeys }: KeypadProps) {
  return (
    <group>
      {KEY_LAYOUT.map((entry) => (
        <Key
          key={entry.key}
          entry={entry}
          onKey={onKey}
          externallyPressed={pressedKeys?.has(entry.key) ?? false}
        />
      ))}
    </group>
  );
}
