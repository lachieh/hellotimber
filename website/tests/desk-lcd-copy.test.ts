import { createStockPhone } from "@hellotimber/nokia-os";
import type { ScreenModel } from "@hellotimber/phone-core";
import { expect, it } from "vite-plus/test";
import { deskHint } from "../src/desk/lcd-copy";
it("hints at the keypad in the message editor", () => {
  const phone = createStockPhone({ carrier: "LACHLAN", boot: "skip" });
  phone.navigate("menu/messages/write");
  expect(deskHint(phone.path, phone.screen)).toContain("0-9");
});

it("asks for a number on the number entry screen", () => {
  const phone = createStockPhone({ carrier: "LACHLAN", boot: "skip" });
  phone.navigate("menu/chat");
  expect(deskHint(phone.path, phone.screen)).toBe("press a number on 0-9, then Enter = Search");
});

it("names the phone's own keys for touch", () => {
  // The hint reads only the screen's kind (and a pending notice) at standby.
  const standby = { kind: "standby" } as ScreenModel;
  expect(deskHint("standby", standby, "touch")).toBe("tap Menu, the big middle key");
  const phone = createStockPhone({ carrier: "LACHLAN", boot: "skip" });
  phone.navigate("menu/messages");
  const hint = deskHint(phone.path, phone.screen, "touch");
  expect(hint).not.toMatch(/Enter|Esc/);
  expect(hint).toContain("the middle key");
});
