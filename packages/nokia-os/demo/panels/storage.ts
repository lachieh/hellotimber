// The phone's EEPROM in the page's localStorage (plan 15): settings survive a reload, and empty
// storage is the virgin phone. "Erase EEPROM" empties it; "Factory settings" restarts over the
// factory state (plan 16 D7: the virgin phone is nearly silent); the SIM select swaps the card
// (Phone security's new-SIM prompt).
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { STOCK_STORAGE_PREFIX } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

/** The names of the EEPROM records stored in localStorage (`settings`, `security`). */
function storedRecords(): string[] {
  const names: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(STOCK_STORAGE_PREFIX)) names.push(key.slice(STOCK_STORAGE_PREFIX.length));
  }
  return names.sort();
}

function eraseRecords(): void {
  for (const name of storedRecords()) window.localStorage.removeItem(STOCK_STORAGE_PREFIX + name);
}

let sim: HTMLSelectElement | undefined;
let storageError: HTMLParagraphElement | undefined;

export const storagePanel: DemoPanel = {
  name: "storage",
  plan: 15,
  mount(slots, host) {
    const simLabel = html<HTMLLabelElement>(`
      <label>
        SIM card (restarts the phone)
        <select id="sim">
          <option value="sim-1">SIM 1</option>
          <option value="sim-2">SIM 2</option>
        </select>
      </label>`);
    sim = byId<HTMLSelectElement>(simLabel, "sim");
    // A new SIM card: with Phone security On, the next power-on asks for the code (plan 15 D10).
    sim.addEventListener("change", () => host.restart());
    const eeprom = html(`
      <div class="eeprom">
        <div class="buttons">
          <button id="erase" type="button">Erase EEPROM</button>
          <button id="factory" type="button">Factory settings</button>
        </div>
        <p class="note">
          Settings persist in this page's localStorage. Erase removes every
          <code>nokia-os/</code> record and restarts the virgin phone. With Phone security On, a
          SIM the phone has not seen asks for the security code (12345) at power-on. The virgin
          phone is nearly silent (its tone settings are unset); Factory settings restarts it over
          the factory state, where keys beep, tone lists preview and Snake II sounds. Sound starts
          with the first key or click.
        </p>
        <p id="storage-error" class="error" role="alert" hidden></p>
      </div>`);
    storageError = byId<HTMLParagraphElement>(eeprom, "storage-error");
    // Erase EEPROM: every nokia-os record goes, so the next phone is the virgin one (plan 15 D4).
    byId(eeprom, "erase").addEventListener("click", () => {
      eraseRecords();
      host.restart();
    });
    // Factory settings: the EEPROM erased, then the factory state written (Restore factory
    // settings' values, plan 15 D5), and the phone restarted over it (plan 16 Open question 3).
    byId(eeprom, "factory").addEventListener("click", () => {
      eraseRecords();
      createStockSettings(new StockEeprom(window.localStorage)).restoreFactory();
      host.restart();
    });
    slots.control(simLabel);
    slots.wideControl(eeprom);
  },
  config: () => ({ storage: window.localStorage, ...(sim ? { sim: sim.value } : {}) }),
  // A malformed record makes createStockPhone throw, naming its key: shown with the Erase button.
  started(error) {
    if (storageError === undefined) return;
    storageError.hidden = error === undefined;
    if (error !== undefined) {
      storageError.textContent = `${error.message} Erase the EEPROM to start again.`;
    }
  },
  status: () => `EEPROM: ${storedRecords().join(", ") || "empty"}`,
};
