// Security settings and Restore factory settings (plan 15 D7, D8): the security-code leaves use
// the stock code entry, and an accepted code opens the leaf's flow; Phone security stores a
// single choice behind the code. The security code itself is `../security.ts`.
import { codeEntry, codeError, maskedEntry } from "../../widgets/code-entry";
import type { Flow, Widget } from "../../widgets/flow";
import { note } from "../../widgets/note";
import { OptionListWidget } from "../../widgets/option-list";
import { splitPromptLines } from "../../widgets/prompt";
import type { EepromRecord } from "../eeprom";
import { SECURITY_CODE_DIGITS, SECURITY_RECORD } from "../security";
import { timelineByName } from "../timelines";
import type { NamedNote, ScreenBinding, ScreenPlace, StockFeature, StockServices } from "./feature";

/** What an accepted security code opens (D8, Task 0c: `probe/accept-*`, all v6.39 captures). */
export type AcceptFlow =
  /** The `Off`/`On` list on the stored value; OK stores it, `note`, then the page. */
  | {
      readonly kind: "phone-security";
      /** The option labels in list order; the page reads the choice like a setter level's. */
      readonly labels: readonly string[];
      readonly note: NamedNote;
    }
  /**
   * `enter`, then `verify` (the new code twice, masked); a match stores it, `note`, then the
   * page; a mismatch, or a new code that is not 5 digits, shows `Code error`, then `enter`.
   */
  | {
      readonly kind: "change-code";
      readonly enter: readonly string[];
      readonly verify: readonly string[];
      readonly note: NamedNote;
    }
  /** Restore factory settings (D5), `note`, then the page. */
  | { readonly kind: "restore"; readonly note: NamedNote }
  /** `note`, then the page. */
  | { readonly kind: "note"; readonly note: NamedNote };

/**
 * A security-code leaf (D7): the stock code entry over the tree screen's label and soft key; an
 * accepted code opens `flow`. Strings are v6.39's (`$REF/extracted/6.39/text/english.txt`), as the
 * accept goldens show them; each note's timeline is its own recording's.
 */
export function securityCodeScreen(flow: AcceptFlow): ScreenBinding {
  return (services, { number, screen, key, numbering }) => {
    if (!("lines" in screen) || screen.softkey === undefined) {
      throw new Error(`${number}: a code prompt without a soft key.`);
    }
    const softkey = screen.softkey;
    const { label } = splitPromptLines(screen.lines);
    const accepted = acceptFlow(services, { key, numbering }, softkey, flow);
    const { security, noteSound: sound } = services;
    return () => codeEntry({ lines: label, softkey, security, accepted, sound });
  };
}

function acceptNote(services: StockServices, binding: NamedNote): () => Widget {
  const timeline = timelineByName(binding.timeline);
  return () => note({ lines: binding.lines, timeline, sound: services.noteSound });
}

/** What an accepted code opens at the leaf, as `probe/accept-*` records it. */
function acceptFlow(
  services: StockServices,
  { key, numbering }: Pick<ScreenPlace, "key" | "numbering">,
  softkey: string,
  flow: AcceptFlow,
): (flow: Flow) => void {
  const done = acceptNote(services, flow.note);
  const { settings, security, noteSound: sound } = services;
  switch (flow.kind) {
    case "phone-security": {
      const { labels } = flow;
      return (f) =>
        f.replace(
          new OptionListWidget({
            labels,
            softkey,
            opening: settings.choice(key),
            numbering,
            choose: (index, inner) => {
              settings.choose(key, index);
              if (security.phoneSecurity()) security.insertSim(security.sim);
              inner.replace(done());
            },
          }),
        );
    }
    case "change-code": {
      const { enter, verify } = flow;
      // The new code twice; a mismatch or a wrong length: `Code error`, then `enter` (B4).
      const enterNew = (): Widget =>
        maskedEntry({
          lines: enter,
          softkey,
          submit(code, f, clear) {
            if (code.length !== SECURITY_CODE_DIGITS) {
              clear();
              f.push(codeError(undefined, sound));
              return;
            }
            f.replace(
              maskedEntry({
                lines: verify,
                softkey,
                submit(again, g) {
                  if (again === code) {
                    security.changeCode(code);
                    g.replace(done());
                    return;
                  }
                  g.replace(enterNew());
                  g.push(codeError(undefined, sound));
                },
              }),
            );
          },
        });
      return (f) => f.replace(enterNew());
    }
    case "restore":
      return (f) => {
        settings.restoreFactory();
        f.replace(done());
      };
    case "note":
      return (f) => f.replace(done());
  }
}

/** Phone security's list (`probe/accept-6-3-5-on` image h); the page reads `Off` virgin. */
const PHONE_SECURITY_LABELS = ["Off", "On"];

export const securityFeature: StockFeature = {
  name: "security",
  screens: {
    // probe/accept-6-3-5-off image j: `Done` (687/232/549 ms).
    "6-3-5": securityCodeScreen({
      kind: "phone-security",
      labels: PHONE_SECURITY_LABELS,
      note: { lines: ["Done"], timeline: "phone-security-done" },
    }),
    // probe/accept-6-3-6-1-match images a, g and m (680/232/537 ms). `Enter new\nsecurity code:`
    // 0x3d5, `Verify new\nsecurity code:` 0x3d6, `Security\ncode\nchanged` 0x3d3.
    "6-3-6-1": securityCodeScreen({
      kind: "change-code",
      enter: ["Enter new", "security code:"],
      verify: ["Verify new", "security code:"],
      note: { lines: ["Security", "code", "changed"], timeline: "security-code-changed" },
    }),
    // probe/accept-c7-restore image h (689/233/523 ms; 6-4-restore 697/217/546, 6-4-new-code
    // 679/233/515: c7's lies within 18 ms of both). `Settings\nrestored` 0x2d6.
    "6-4": securityCodeScreen({
      kind: "restore",
      note: { lines: ["Settings", "restored"], timeline: "settings-restored" },
    }),
  },
  widgets: {
    // Closed user group › Group number (6-3-4-2).
    promptLayouts: { "6-3-4-2": { icons: ["pen"], entry: "end" } },
  },
  settings: {
    // Phone security is a single choice behind the code (virgin `Off`, `tree/06-settings/6-3.sub`).
    codeSettings: { "6-3-5": PHONE_SECURITY_LABELS },
  },
  records: [SECURITY_RECORD as EepromRecord<unknown>],
};
