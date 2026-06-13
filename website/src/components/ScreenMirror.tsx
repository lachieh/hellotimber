import { useEffect, useState } from "react";
import { getPhoneRuntime } from "../phone/phone";
import { screenToText } from "../phone/screen-text";

/** Visually-hidden, polite live region that mirrors the handset screen for AT. */
export default function ScreenMirror() {
  const [text, setText] = useState("");
  useEffect(() => {
    const { phone } = getPhoneRuntime();
    setText(screenToText(phone.screen));
    return phone.subscribe((snap) => setText(screenToText(snap.screen)));
  }, []);
  return (
    <p className="sr-only" aria-live="polite" role="status">
      {text}
    </p>
  );
}
