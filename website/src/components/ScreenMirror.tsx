import { useEffect, useState } from "react";
import { getPhoneRuntime } from "../phone/stock-phone";
import { describeStockScreen } from "@hellotimber/nokia-os";

/** Visually-hidden, polite live region that mirrors the handset screen for AT. */
export default function ScreenMirror() {
  const { phone } = getPhoneRuntime();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(describeStockScreen(phone.screen));
    return phone.subscribe((snap) => setText(describeStockScreen(snap.screen)));
  }, [phone]);
  return (
    <p className="sr-only" aria-live="polite" role="status">
      {text}
    </p>
  );
}
