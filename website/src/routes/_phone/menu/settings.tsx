import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { pageHead } from "../../../seo";
import { updateSettings, useSettings } from "../../../settings";

export const Route = createFileRoute("/_phone/menu/settings")({
  head: () =>
    pageHead({
      section: "Settings",
      description: "Phone settings: keypad tones, backlight, welcome note.",
    }),
  component: SettingsPanel,
});

function SettingsPanel() {
  const s = useSettings();
  return (
    <ContentPanel title="Settings">
      <fieldset className="space-y-3 border-0 p-0">
        <label className="flex items-center justify-between gap-4">
          <span>Keypad tones</span>
          <input
            type="checkbox"
            checked={s.keypadTones}
            onChange={(e) => updateSettings({ keypadTones: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Backlight</span>
          <input
            type="checkbox"
            checked={s.backlight}
            onChange={(e) => updateSettings({ backlight: e.target.checked })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Welcome note</span>
          <input
            type="text"
            maxLength={40}
            value={s.welcomeNote}
            placeholder="(shown on next boot)"
            onChange={(e) => updateSettings({ welcomeNote: e.target.value })}
            className="rounded border border-current/30 bg-transparent px-2 py-1"
          />
        </label>
      </fieldset>
    </ContentPanel>
  );
}
