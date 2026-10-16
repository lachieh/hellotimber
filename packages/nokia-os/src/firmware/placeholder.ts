import { PhoneApplication } from "@hellotimber/phone-core";
import type { ApplicationContext, PhoneApplicationSession } from "@hellotimber/phone-core";
import { placeholderFrame } from "../display/placeholder";
import { attachDescription, describeWidget } from "../display/describe";

/**
 * A stock leaf that later plans implement (D13). It shows a marked placeholder frame; C exits to
 * the parent screen and every other key is swallowed, so the path stays at the leaf.
 */
export class PlaceholderApplication extends PhoneApplication {
  readonly label: string;
  /** The plan that implements the leaf (plan 14 "Leaf ownership"); never drawn. */
  readonly ownerPlan: string;

  constructor(id: string, label: string, ownerPlan: string) {
    super(id);
    this.label = label;
    this.ownerPlan = ownerPlan;
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const frame = placeholderFrame(this.label);
    attachDescription(frame, describeWidget({ kind: "placeholder", label: this.label }));
    const screen = { kind: "custom" as const, appId: this.id, frame };
    return {
      onKey(event) {
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick() {},
      render: () => screen,
    };
  }
}
