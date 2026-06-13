import { updateSettings, useSettings } from "../settings";

/** Global mute. aria-pressed=true means SOUND IS ON (it's a sound toggle). */
export default function SoundToggle() {
  const { muted } = useSettings();
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={!muted}
      onClick={() => updateSettings({ muted: !muted })}
    >
      {muted ? "🔇 Sound off" : "🔊 Sound on"}
    </button>
  );
}
