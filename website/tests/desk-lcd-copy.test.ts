import { createStockPhone } from "@hellotimber/nokia-os";
import { expect, it } from "vite-plus/test";
import { deskHint } from "../src/desk/lcd-copy";
it("hints at the keypad in the message editor", () => {
  const phone = createStockPhone({ carrier: "LACHLAN", boot: "skip" });
  phone.navigate("menu/messages/write");
  expect(deskHint(phone.path, phone.screen)).toContain("0-9");
});
