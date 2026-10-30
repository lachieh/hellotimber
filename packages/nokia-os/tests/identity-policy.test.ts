import { describeStockScreen } from "../src/index";
import { expect, it } from "vite-plus/test";
import { callRig, play } from "./support/calls";

for (const [choice, policy] of ["show", "hide", "network"].entries())
  it(`passes own-number policy ${policy} to the host`, () => {
    const rig = callRig();
    play(
      rig,
      `menu 6 1 4 +1200 ${"down ".repeat(choice)}menu +3500 c@1500 +1000 0 4 1 2 3 4 5 6 7 8 menu +5000`,
    );
    expect(rig.net.dialled.at(-1)).toMatchObject({ ownNumberSending: policy });
  });

it("keeps captured costs and prepaid values zero without network advice", () => {
  const rig = callRig();
  play(rig, "0 4 1 2 3 4 5 6 7 8 menu +5000 menu +3000");
  rig.phone.navigate("menu/call-register/show-call-costs");
  rig.advance(1000);
  expect(describeStockScreen(rig.phone.screen)).toContain("0");
  rig.phone.navigate("menu/call-register/prepaid-credit");
  rig.advance(1000);
  expect(describeStockScreen(rig.phone.screen)).toContain("Credit");
});
