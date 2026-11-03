import { useEffect, useState } from "react";
import { getHomeRuntime } from "../home/runtime";

/** Visually-hidden, polite live region that mirrors the handset screen for AT. */
export default function ScreenMirror() {
  const { phone, describe } = getHomeRuntime();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(describe(phone.screen));
    return phone.subscribe((snap) => setText(describe(snap.screen)));
  }, [phone, describe]);
  return (
    <p className="sr-only" aria-live="polite" role="status">
      {text}
    </p>
  );
}
