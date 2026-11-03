// The SIM card's phone book (plan 19): a select restarts the phone with an empty SIM (the storage
// panel's SIM 1 or 2, as the virgin phone has it), a sample SIM with a handful of invented names
// and two service numbers, or a full SIM (50 names). A SIM's names live in the EEPROM by its id
// (D3): what the phone adds, edits or erases survives a reload until the EEPROM is erased.
import { StockEeprom } from "../../src/firmware/eeprom";
import type { StockContact, StockSimCard } from "../../src/index";
import { normaliseSim } from "../../src/phone-book/sim-card";
import { StockPhoneBook } from "@hellotimber/phone-services/phone-book/store";
import { byId, html, type DemoPanel } from "../panel";

const SAMPLE_NAMES: readonly StockContact[] = [
  { name: "Ada Lovelace", number: "0412000001" },
  { name: "Alan", number: "0412000002" },
  { name: "Bea", number: "0412000003" },
  { name: "Cy", number: "+61412000004" },
  { name: "Dot", number: "0412000005" },
  { name: "Grace Hopper", number: "0412000006" },
  { name: "Mum", number: "0412000007" },
  { name: "Xavier", number: "0412000008" },
];

/** The SIM cards the select offers; `empty` leaves the storage panel's SIM id in place. */
const SIMS: Readonly<Record<string, StockSimCard | undefined>> = {
  empty: undefined,
  sample: {
    id: "demo-sample",
    phoneBook: { entries: SAMPLE_NAMES },
    serviceNumbers: [
      { name: "Voice mail", number: "101" },
      { name: "Customer care", number: "125111" },
    ],
  },
  full: {
    id: "demo-full",
    phoneBook: {
      entries: Array.from({ length: 50 }, (_, i) => ({
        name: `Name ${String(i + 1).padStart(2, "0")}`,
        number: `04120001${String(i + 1).padStart(2, "0")}`,
      })),
    },
  },
};

let select: HTMLSelectElement | undefined;
/** The SIM the running phone has (the storage panel's id while the empty SIM is chosen). */
let current: StockSimCard | undefined;

/** The SIM's id and its used/free locations, read from the EEPROM as the phone wrote them. */
function simStatus(): string {
  const sim = current ?? { id: storageSim() };
  const book = new StockPhoneBook(new StockEeprom(window.localStorage), normaliseSim(sim));
  return `SIM ${sim.id}: ${book.used()} names, ${book.free()} free`;
}

/** The storage panel's SIM select (`sim-1`, `sim-2`). */
function storageSim(): string {
  return document.querySelector<HTMLSelectElement>("#sim")?.value ?? "sim-1";
}

export const phoneBookPanel: DemoPanel = {
  name: "phone-book",
  plan: 19,
  mount(slots, host) {
    const label = html<HTMLLabelElement>(`
      <label>
        SIM phone book (restarts the phone)
        <select id="sim-phone-book">
          <option value="empty">Empty SIM</option>
          <option value="sample">Sample SIM</option>
          <option value="full">Full SIM</option>
        </select>
      </label>`);
    select = byId<HTMLSelectElement>(label, "sim-phone-book");
    select.addEventListener("change", () => host.restart());
    slots.control(label);
  },
  config() {
    current = SIMS[select?.value ?? "empty"];
    return current === undefined ? {} : { sim: current };
  },
  status: simStatus,
};
