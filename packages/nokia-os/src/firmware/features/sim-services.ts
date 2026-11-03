// SIM services (plan 30 D3, D5; Task 0 K): the SIM toolkit's Menu 14. A SIM with a toolkit adds a
// 13th carousel slot numbered 14 (`sim/slot.ts`: there is no 13), labelled with the toolkit's title
// and drawn with its own icon; its level lists the `SET UP MENU` items (a rows list with `OK`, no title and no
// menu number: `display/paint.ts`), each a route `menu/sim-services/<id>` whose session plays the
// applet's steps (`sim/session.ts`). No tree node is involved, so the feature binds no node tables.
import {
  ApplicationEntry,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  SubmenuEntry,
  TopLevelEntry,
} from "@hellotimber/phone-core";
import { stockMenuGraphic } from "../../kit/ui/resources";
import { SIM_SERVICES_SLUG } from "../../sim/slot";
import type { SimServicesSlot } from "../firmware";
import { carouselLabel, rowLabel, type StockSimToolkit } from "../../sim/toolkit";
import { toolkitSession, type ToolkitDial } from "../../sim/session";
import { StockFlowApplication } from "../../kit/ui/widgets/flow";
import type { StockFeature, StockServices } from "./feature";
import { placeCall } from "./dialling";

/** SET UP CALL reuses the phone-book call flow (UNVERIFIED composition: plan 30 D6). */
export function toolkitDial(services: StockServices): ToolkitDial {
  return (number, flow) => placeCall(services, flow, number, false, "list");
}

/** Menu 14 for `toolkit`: its carousel slot and level over one phone's `services`. */
export function simServicesEntry(
  toolkit: StockSimToolkit,
  services: StockServices,
  slot: SimServicesSlot,
): TopLevelEntry {
  const deps = { dial: toolkitDial(services) };
  const items = toolkit.items.map(
    (item, i) =>
      new ApplicationEntry(
        new MenuSlug(item.id),
        new MenuOrder(i + 1),
        item.label,
        new StockFlowApplication(`stock:${SIM_SERVICES_SLUG}/${item.id}`, () =>
          toolkitSession(item, deps),
        ),
      ),
  );
  const level = new SubmenuEntry(
    new MenuSlug(SIM_SERVICES_SLUG),
    new MenuOrder(slot.number),
    carouselLabel(toolkit.title)!,
    new MenuLevel(items),
    undefined,
    { presentation: "rows", softkey: "OK", label: (child) => rowLabel(child.label) },
  );
  return new TopLevelEntry(level, stockMenuGraphic(SIM_SERVICES_SLUG));
}

export const simServicesFeature: StockFeature = { name: "sim-services" };
