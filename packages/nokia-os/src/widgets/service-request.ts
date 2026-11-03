import { Timeline } from "@hellotimber/phone-core";
import type { StockServices } from "../firmware/features/feature";
import { telephoneOf } from "../firmware/features/dialling";
import { timelineById, timelineByName } from "../kit/ui/timelines";
import { ServiceRequest, type StockServiceResult } from "../services/calls/services";
import type { Widget } from "../kit/ui/widgets/flow";
import { afterDown } from "./call";
import { infoScreen } from "../kit/ui/widgets/info-screen";
import { note } from "../kit/ui/widgets/note";
import { Playback } from "../kit/ui/widgets/playback";

function resultWidget(
  result: Exclude<StockServiceResult, { kind: "failed" | "waiting" }>,
  clock: boolean,
  returnLevels: number,
): Widget {
  return {
    render: () => ({
      kind: "info-screen",
      lines: [
        result.kind === "active" ? "Active:" : "Inactive:",
        result.scope === "voice" ? "Voice" : "All",
        result.scope === "voice" ? "calls" : "services",
      ],
      softkey: result.kind === "active" ? "Number" : "Back",
    }),
    onKeyDown(key, flow) {
      if (key === "c" || (key === "navi" && result.kind === "inactive")) {
        if (clock) flow.standby();
        else flow.back(returnLevels);
      } else if (key === "navi" && result.kind === "active")
        flow.push(
          afterDown(
            "navi",
            infoScreen({
              lines: () => ["To number", result.number],
              softkey: "Back",
            }),
          ),
        );
    },
  };
}

export function serviceRequest(
  services: StockServices,
  text: string,
  clock = false,
  entryLead = clock,
  returnLevels = 1,
): Widget {
  const request = telephoneOf(services)?.service(text) ?? new ServiceRequest(text, undefined);
  let elapsed = 0;
  const bar = new Playback(timelineById("7-6", "Requesting's bar"));
  return {
    render() {
      if (entryLead && elapsed < 44)
        return {
          kind: "call",
          body: { kind: "digits", text },
          softkey: "Call",
          handset: false,
          ladders: false,
          ...(services.ports.clock === undefined ? {} : { clock: services.ports.clock() }),
        };
      const frame = bar.frame;
      if (frame.kind !== "sprite") throw Error("Requesting needs a progress sprite");
      const time = clock ? services.ports.clock?.() : undefined;
      return {
        kind: clock ? "service-request" : "progress",
        text: "Requesting",
        bar: frame.sprite,
        softkey: "Quit",
        ...(time === undefined ? {} : { clock: time }),
      };
    },
    tick(dtMs, flow) {
      elapsed += dtMs;
      if (!entryLead || elapsed >= 44) bar.advance(dtMs);
      request.tick(dtMs);
      const result = request.result;
      if (result === undefined) return;
      flow.replace(
        result.kind === "failed"
          ? note({
              lines: ["Not", "done"],
              timeline: timelineByName("service-not-done"),
              end: clock ? "standby" : { levels: returnLevels },
              sound: services.noteSound,
            })
          : result.kind === "waiting"
            ? note({
                lines: ["Call", "waiting", result.active ? "active" : "not active"],
                timeline: {
                  ...timelineByName("saved"),
                  timeline: new Timeline([
                    { frame: 0, durationMs: 684 },
                    { frame: 1, durationMs: 235 },
                    { frame: 2, durationMs: 530 },
                  ]),
                },
                end: "back",
                sound: services.noteSound,
              })
            : resultWidget(result, clock, returnLevels),
      );
    },
    onKey(key, flow) {
      if (key !== "navi" && key !== "c") return;
      flow.replace(
        note({
          lines: ["Request", "not", "confirmed"],
          timeline: timelineByName("request-not-confirmed"),
          end: "standby",
          sound: services.noteSound,
        }),
      );
    },
    close: () => request.cancel(),
  };
}
