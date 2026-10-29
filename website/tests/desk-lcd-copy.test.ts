import { createStockPhone, describeStockScreen } from "@hellotimber/nokia-os";
import { expect, it } from "vite-plus/test";
import { lcdCopy, deskHint } from "../src/desk/lcd-copy";
it("copies stock widget text rather than calling every widget pixels", () => {
  const phone = createStockPhone({ carrier: "LACHLAN", boot: "skip" });
  phone.navigate("menu/messages/write");
  const copy = lcdCopy(phone.screen);
  expect(copy.rows[0]?.text).toContain("Editor:");
  expect(copy.softkey).toBe("Options");
  expect(describeStockScreen(phone.screen)).toContain(copy.rows[0]?.text);
  expect(deskHint(phone.path, phone.screen)).toContain("0-9");
});
