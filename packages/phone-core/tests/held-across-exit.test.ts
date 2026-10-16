// Plan 19: a key held across an application's exit keeps its long press (C held from a screen
// that leaves at C's down still reaches standby, as the stock firmware's menus do), while its
// release is swallowed (the level it returned to sees no C tap).
import { describe, expect, it } from "vite-plus/test";
import { PhoneApplication } from "../src/index";
import type { ApplicationContext, PhoneApplicationSession } from "../src/index";
import { bootedPhone, testMenu } from "./fixtures";

/** An application that exits at C's down (`endHolds`: ending the hold too). */
class LeavesAtDown extends PhoneApplication {
  constructor(
    id: string,
    readonly endHolds = false,
  ) {
    super(id);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey: (event) => {
        if (event.type === "down" && event.key === "c") {
          context.exit(this.endHolds ? { endHolds: true } : undefined);
        }
      },
      tick: () => {},
      render: () => ({ kind: "confirm", text: "Names", softkey: "OK" }),
    };
  }
}

function inApplication(endHolds = false) {
  const phone = bootedPhone({ menu: testMenu(new LeavesAtDown("write-message", endHolds)) });
  // bootedPhone powered on with a 1000 ms press: the phone's clock is there.
  let now = 1000;
  phone.navigate("menu/messages/write");
  const advance = (ms: number): void => {
    for (const end = now + ms; now < end; ) phone.tick(++now);
  };
  return { phone, advance };
}

describe("a key held across an application's exit", () => {
  it("swallows the release: a tap of C leaves the application, not the level", () => {
    const { phone } = inApplication();
    phone.pressKey("c");
    expect(phone.path).toBe("menu/messages");
  });

  it("keeps the long press: C held goes on to standby", () => {
    const { phone, advance } = inApplication();
    phone.send({ type: "down", key: "c" });
    expect(phone.path).toBe("menu/messages");
    advance(900);
    expect(phone.path).toBe("standby");
    phone.send({ type: "up", key: "c" });
    expect(phone.path).toBe("standby");
  });

  it("with endHolds loses the long press too: C held stays on the level (plan 21)", () => {
    const { phone, advance } = inApplication(true);
    phone.send({ type: "down", key: "c" });
    advance(900);
    expect(phone.path).toBe("menu/messages");
    phone.send({ type: "up", key: "c" });
    expect(phone.path).toBe("menu/messages");
  });
});
