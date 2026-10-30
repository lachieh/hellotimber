import { expect, it } from "vite-plus/test";
import { describeStockScreen } from "../src/index";
import { callRig, play } from "./support/calls";

it("asks the host to hold and keeps the call active", () => {
  let holds = 0;
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    dial(call, control) {
      const link = network.dial!(call, control);
      return {
        ...link,
        hold: () => {
          holds++;
          return true;
        },
      };
    },
  }));
  play(rig, "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down menu +2000");
  expect(holds).toBe(1);
  expect(describeStockScreen(rig.phone.screen)).toContain("Call 1");
});
it("opens a new-call number entry without inventing network progress", () => {
  const rig = callRig();
  play(rig, "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down menu +500");
  expect(describeStockScreen(rig.phone.screen)).toContain("Phone number:");
  expect(rig.net.dialled).toHaveLength(1);
  play(rig, "1 2 3 menu +500");
  expect(rig.net.dialled).toHaveLength(2);
  expect(describeStockScreen(rig.phone.screen)).toContain("[End call]");
});
it("sends the entered DTMF string through the host link", () => {
  const sent: string[] = [];
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    dial(call, control) {
      return {
        ...network.dial!(call, control),
        sendDtmf: (text: string) => {
          sent.push(text);
          return true;
        },
      };
    },
  }));
  play(
    rig,
    "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down menu +500 1 2 3 menu +5000",
  );
  expect(sent).toEqual(["123"]);
  expect(describeStockScreen(rig.phone.screen)).toContain("Call 1");
});

for (const mode of ["pause", "wait"] as const)
  it(`sends post-connect ${mode} digits through the host`, () => {
    const sent: string[] = [];
    const rig = callRig("virgin", false, false, (network) => ({
      ...network,
      dial(call, control) {
        return {
          ...network.dial!(call, control),
          sendDtmf: (text: string) => {
            sent.push(text);
            return true;
          },
        };
      },
    }));
    play(
      rig,
      `0 4 1 2 3 4 5 6 7 8 ${"* ".repeat(mode === "pause" ? 3 : 4)} +1700 1 2 3 menu +10000`,
    );
    if (mode === "wait") {
      expect(sent).toEqual([]);
      expect(describeStockScreen(rig.phone.screen)).toContain("Send");
      rig.press("navi");
      rig.advance(3000);
    }
    expect(sent).toEqual(["123"]);
  });

it("cancels a pending DTMF transmission on power-off", () => {
  let signal: AbortSignal | undefined;
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    dial(call, control) {
      return {
        ...network.dial!(call, control),
        sendDtmf: (_text: string, abort: AbortSignal) => {
          signal = abort;
          return new Promise<boolean>(() => {});
        },
      };
    },
  }));
  play(
    rig,
    "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down menu +500 1 2 3 menu +100",
  );
  expect(signal?.aborted).toBe(false);
  rig.press("power", 1000);
  expect(signal?.aborted).toBe(true);
});
it("does not hold a call when the host rejects Hold", () => {
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    dial(call, control) {
      return { ...network.dial!(call, control), hold: () => false };
    },
  }));
  play(
    rig,
    "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down menu +1000 c +1000 menu +1500 down",
  );
  expect(describeStockScreen(rig.phone.screen)).toContain("Hold");
  expect(describeStockScreen(rig.phone.screen)).not.toContain("Retrieve");
});

it("sounds transmitted DTMF pairs after host success", () => {
  const rig = callRig("factory", false, false, (network) => ({
    ...network,
    dial(call, control) {
      return { ...network.dial!(call, control), sendDtmf: () => true };
    },
  }));
  play(rig, "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down menu +500 1 2 3");
  const seen = rig.sounds.length;
  play(rig, "menu +3000");
  const pairs = rig.sounds
    .slice(seen)
    .filter((event) => event.output === "tone" && event.hz !== null && event.hz2 !== undefined);
  expect(
    pairs.map((event) =>
      event.output === "tone" && event.hz !== null ? [event.hz, event.hz2] : [],
    ),
  ).toEqual([
    [1209, 697],
    [1336, 697],
    [1477, 697],
  ]);
});
