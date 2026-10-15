// The editors' Options › Template and Insert smiley (plan 18c Task 5, `content/editor-*`): the
// Templates or Smileys list with `Select` (indicator `<option>-<slot>`) over Options' place;
// Select inserts the slot's text at the cursor exactly (an `(empty)` slot nothing), C returns to
// the editor. Write messages, Reply, Edit, Forward and Chat open it.
import type { StockServices } from "../firmware/features/feature";
import { contentList } from "../widgets/content-list";
import type { EditorControl } from "../widgets/text-entry";
import type { Widget } from "../widgets/flow";
import { StockTextSlots, type TextSlotsKind } from "./slots";

/** A slot's row and Read text: its text, or `(empty)`. */
export const EMPTY_SLOT = "(empty)";

/** The rows' icon sprite, by list (templates only, `content/templates-list`). */
export const ROW_ICONS: Readonly<Partial<Record<TextSlotsKind, string>>> = {
  templates: "content/template",
};

/** A list's rows as the screens show them. */
export function slotRows(slots: StockTextSlots): () => readonly string[] {
  return () => slots.list().map((text) => text ?? EMPTY_SLOT);
}

/**
 * The list Template (`kind` templates) or Insert smiley opens from Options entry `option`, over
 * the editor `entry`; undefined on the virgin EEPROM (no response, `sms/template`).
 */
export function insertionList(
  services: StockServices,
  kind: TextSlotsKind,
  option: number,
  entry: EditorControl,
): Widget | undefined {
  const slots = new StockTextSlots(services.eeprom, kind);
  if (!slots.provisioned) return undefined;
  const icon = ROW_ICONS[kind];
  return contentList({
    rows: slotRows(slots),
    ...(icon === undefined ? {} : { icon }),
    opening: 0,
    softkey: "Select",
    indicatorPrefix: [option],
    choose(index, flow) {
      const text = slots.text(index);
      if (text !== null) entry.insert(text);
      flow.back();
    },
  });
}
