import type { CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";

export const SERVICE_RECORDINGS = [
  ["verified/ok/divert-all-cancel", "calls-services/verified-ok-divert-all-cancel"],
  ["verified/ok/divert-cancel", "calls-services/verified-ok-divert-cancel"],
  ["verified/ok/divert-mailbox", "calls-services/verified-ok-divert-mailbox"],
  ["verified/ok/divert-other", "calls-services/verified-ok-divert-other"],
  ["verified/ok/divert-status", "calls-services/verified-ok-divert-status"],
  ["verified/ok/string-0", "calls-services/verified-ok-string-0"],
  ["verified/ok/string-1", "calls-services/verified-ok-string-1"],
  ["verified/ok/string-2", "calls-services/verified-ok-string-2"],
  ["verified/ok/string-3", "calls-services/verified-ok-string-3"],
  ["verified/ok/string-4", "calls-services/verified-ok-string-4"],
  ["verified/ok/string-5", "calls-services/verified-ok-string-5"],
  ["verified/ok/waiting-activate", "calls-services/verified-ok-waiting-activate"],
  ["verified/ok/waiting-cancel", "calls-services/verified-ok-waiting-cancel"],
  ["verified/ok/waiting-status", "calls-services/verified-ok-waiting-status"],
  ["verified/error/divert-all-cancel", "calls-services/verified-error-divert-all-cancel"],
  ["verified/error/divert-cancel", "calls-services/verified-error-divert-cancel"],
  ["verified/error/divert-mailbox", "calls-services/verified-error-divert-mailbox"],
  ["verified/error/divert-other", "calls-services/verified-error-divert-other"],
  ["verified/error/divert-status", "calls-services/verified-error-divert-status"],
  ["verified/error/string-0", "calls-services/verified-error-string-0"],
  ["verified/error/string-1", "calls-services/verified-error-string-1"],
  ["verified/error/string-2", "calls-services/verified-error-string-2"],
  ["verified/error/string-3", "calls-services/verified-error-string-3"],
  ["verified/error/string-4", "calls-services/verified-error-string-4"],
  ["verified/error/string-5", "calls-services/verified-error-string-5"],
  ["verified/error/waiting-activate", "calls-services/verified-error-waiting-activate"],
  ["verified/error/waiting-cancel", "calls-services/verified-error-waiting-cancel"],
  ["verified/error/waiting-status", "calls-services/verified-error-waiting-status"],
  ["none/divert-all-cancel", "calls-services/none-divert-all-cancel"],
  ["none/divert-cancel", "calls-services/none-divert-cancel"],
  ["none/divert-mailbox", "calls-services/none-divert-mailbox"],
  ["none/divert-other", "calls-services/none-divert-other"],
  ["none/divert-status", "calls-services/none-divert-status"],
  ["none/string-0", "calls-services/none-string-0"],
  ["none/string-1", "calls-services/none-string-1"],
  ["none/string-2", "calls-services/none-string-2"],
  ["none/string-3", "calls-services/none-string-3"],
  ["none/string-4", "calls-services/none-string-4"],
  ["none/string-5", "calls-services/none-string-5"],
  ["none/waiting-activate", "calls-services/none-waiting-activate"],
  ["none/waiting-cancel", "calls-services/none-waiting-cancel"],
  ["none/waiting-status", "calls-services/none-waiting-status"],
  ["in-call-ack/hold", "calls-services/in-call-ack-hold"],
  ["in-call-ack/new-call", "calls-services/in-call-ack-new-call"],
  ["in-call-ack/pause", "calls-services/in-call-ack-pause"],
  ["in-call-ack/second-call", "calls-services/in-call-ack-second-call"],
  ["in-call-ack/send-dtmf", "calls-services/in-call-ack-send-dtmf"],
  ["in-call-ack/wait", "calls-services/in-call-ack-wait"],
  ["redial/off", "calls-services/redial-off"],
  ["redial/on", "calls-services/redial-on"],
  ["identity-persist/identity-0", "calls-services/identity-persist-identity-0"],
  ["identity-persist/identity-1", "calls-services/identity-persist-identity-1"],
  ["identity-persist/identity-2", "calls-services/identity-persist-identity-2"],
  ["persist/reboot", "calls-services/persist-reboot"],
] as const;

export const callsServices: PlanCaptureSet = {
  plan: "22b",
  resources: {
    spriteBatches: [
      {
        order: 221,
        entries: [
          {
            id: "calls-services/in-call-pen",
            group: "calls-services",
            golden: "calls-services/in-call-ack-new-call",
            image: "b",
            x0: 20,
            x1: 28,
            y0: 0,
            y1: 5,
          },
          {
            id: "call/icon-held",
            group: "call",
            golden: "calls-services/in-call-ack-hold",
            image: "d",
            x0: 6,
            x1: 12,
            y0: 8,
            y1: 14,
          },
          {
            id: "calls-services/divert",
            group: "calls-services",
            golden: "calls-services/divert-indicator",
            image: "active-standby",
            x0: 7,
            x1: 18,
            y0: 0,
            y1: 5,
          },
        ],
      },
    ],
  },
  lcd: (io) => [
    ...SERVICE_RECORDINGS.map<CaptureSetEntry>(([dir, id]) => ({
      id,
      kind: "timeline",
      status:
        dir === "in-call-ack/second-call"
          ? "pending:22c"
          : /^(verified|none|in-call-ack)\//.test(dir)
            ? "asserted"
            : "pending:22b",
      prefer: {
        source: { kind: "recording", dir: `plan22b/${dir}` },
        triggerFrame: (io.frames.recording(`plan22b/${dir}`)?.length ?? 0) > 1 ? 1 : 0,
      },
    })),
    {
      id: "calls-services/divert-indicator",
      kind: "still",
      status: "asserted",
      prefer: { source: { kind: "shot", file: "plan22b/persist/active-standby.png" } },
    },
  ],
  notImported: {
    "plan22b/ok/**, plan22b/error/**":
      "Invalid initial SS build omitted service-8 hook; verified/ replaces these recordings",
    "plan22b/**/*.wav, plan22b/**/*.events.csv":
      "Virgin sound is not factory evidence; restored factory-sound probes await analysis",
    "plan22b/closure*/**, plan22b/persist-unlock/**":
      "Final Task 0 probes await lifecycle and persistence analysis",
    "plan22b/**/*.fls, plan22b/**/*.py, plan22b/**/*.log, plan22b/**/*@8x.png":
      "External firmware, capture scripts, network logs and previews are never imported",
  },
};
