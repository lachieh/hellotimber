import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import { playTone, stopTone } from "../phone/audio";
import { TONES } from "../phone/tones";

export default function TonesPanel() {
  return (
    <ContentPanel title="Tones">
      <p>
        Monophonic ringtones, as nature intended. Preview them here, or pick one on the handset
        under Tones → Ringing tone (it previews there too).
      </p>
      <ul>
        {TONES.map((tone) => (
          <li key={tone.id}>
            <button type="button" onClick={() => playTone(tone.id)}>
              ▶ {tone.label}
            </button>
          </li>
        ))}
      </ul>
      <p>
        <button type="button" onClick={() => stopTone()}>
          ■ Stop
        </button>{" "}
        Keypad tones and the screensaver live here too — toggle them on the handset or under{" "}
        <SiteLink path="menu/settings">Settings</SiteLink>.
      </p>
    </ContentPanel>
  );
}
