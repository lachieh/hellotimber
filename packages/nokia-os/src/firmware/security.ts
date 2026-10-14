// The security code (plan 15 D6, D10): one EEPROM record shared by the boot gate and every
// in-menu prompt, with the captured rules of Task 0 (A2-A5 entry, A3 lockout, B3 SIM, B4 change).
import { PHONE_SECURITY_KEY } from "./bindings";
import type { EepromRecord, StockEeprom } from "./eeprom";
import type { StockSettings } from "./settings";

export interface SecurityState {
  /** The stored code: 5 digits (the virgin and factory code is `12345`, user guide). */
  readonly code: string;
  /** The last SIMs that passed power-on, most recent first (D10: five at most). */
  readonly recentSims: readonly string[];
  /** Consecutive wrong codes (the firmware's EEPROM counter at 0x111B88, Task 0 A3). */
  readonly wrongAttempts: number;
}

/** A new security code has exactly this many digits (B4: 0, 4, 6 and 10 show `Code error`). */
export const SECURITY_CODE_DIGITS = 5;
/** The code entry holds this many digits; the 11th key is ignored (A2/A5). */
export const CODE_ENTRY_MAX_DIGITS = 10;
/** This many consecutive wrong codes lock every code entry (A3: four do not). */
export const WRONG_CODE_LIMIT = 5;
/**
 * How long the lockout lasts after the last entry (A3, emulated time: `12345` was rejected
 * 286.7 s after the fifth wrong code and accepted 291.7 s after it).
 */
export const LOCKOUT_MS = 290_000;
/** The SIMs Phone security remembers (user guide: "the last five used"). */
export const RECENT_SIMS = 5;

const CODE = /^\d{5}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The security record (D6). It has no `factory`: Restore factory settings keeps the code
 * (`probe/accept-c7-restore`: `11111` still restores) and the counter. SIM names that are not
 * strings, and SIMs past the fifth, are dropped as stale.
 */
export const SECURITY_RECORD: EepromRecord<SecurityState> = {
  name: "security",
  version: 1,
  initial: () => ({ code: "12345", recentSims: [], wrongAttempts: 0 }),
  decode(data) {
    if (!isPlainObject(data)) throw new Error("not an object.");
    const { code, recentSims, wrongAttempts = 0 } = data;
    if (typeof code !== "string" || !CODE.test(code)) throw new Error("code must be 5 digits.");
    if (!Array.isArray(recentSims)) throw new Error("recentSims is not a list.");
    if (
      typeof wrongAttempts !== "number" ||
      !Number.isInteger(wrongAttempts) ||
      wrongAttempts < 0
    ) {
      throw new Error("wrongAttempts must be a non-negative integer.");
    }
    const sims = recentSims.filter((sim): sim is string => typeof sim === "string");
    return { code, recentSims: sims.slice(0, RECENT_SIMS), wrongAttempts };
  },
  encode: (value) => ({ ...value }),
};

/** The SIM a phone has when the host names none (D10). */
export const STOCK_DEFAULT_SIM = "sim-1";

export interface StockSecurityOptions {
  /** The kernel clock (ms) the lockout is timed by. Default: always 0. */
  readonly now?: () => number;
  /** The inserted SIM card's identity (D10). Default STOCK_DEFAULT_SIM. */
  readonly sim?: string;
}

/**
 * The phone's security code over its EEPROM, with the inserted SIM. The lockout's
 * start is kept in memory: a phone that loads a locked record (a power cycle, a reload) starts
 * the lockout again at its first entry, as the capture shows a cold power-on still locked (A3).
 */
export class StockSecurity {
  readonly #eeprom: StockEeprom;
  readonly #settings: StockSettings;
  readonly #now: () => number;
  /** The inserted SIM card (D10). */
  readonly sim: string;
  /** When the lockout last (re)started, if this phone has seen it start. */
  #lockedAt: number | undefined;

  constructor(eeprom: StockEeprom, settings: StockSettings, options: StockSecurityOptions = {}) {
    this.#eeprom = eeprom;
    this.#settings = settings;
    this.#now = options.now ?? (() => 0);
    this.sim = options.sim ?? STOCK_DEFAULT_SIM;
  }

  /**
   * Whether `code` is the stored code. Every entry counts (A2/A5: OK with too few digits is
   * `Code error` too; whether the firmware counts those is UNVERIFIED). After five wrong codes
   * every entry fails and restarts the lockout until LOCKOUT_MS pass without one (A3); an
   * accepted code resets the counter.
   */
  verify(code: string): boolean {
    const state = this.#state;
    const now = this.#now();
    if (state.wrongAttempts >= WRONG_CODE_LIMIT) {
      const expired = this.#lockedAt !== undefined && now - this.#lockedAt >= LOCKOUT_MS;
      if (!expired) {
        this.#lockedAt = now;
        return false;
      }
      this.#write({ ...state, wrongAttempts: 0 });
    }
    if (code === this.#state.code) {
      if (this.#state.wrongAttempts !== 0) this.#write({ ...this.#state, wrongAttempts: 0 });
      return true;
    }
    const wrongAttempts = this.#state.wrongAttempts + 1;
    if (wrongAttempts >= WRONG_CODE_LIMIT) this.#lockedAt = now;
    this.#write({ ...this.#state, wrongAttempts });
    return false;
  }

  /** Stores a new code; throws unless it has exactly 5 digits (B4). */
  changeCode(code: string): void {
    if (!CODE.test(code)) {
      throw new Error(
        `A security code has exactly ${SECURITY_CODE_DIGITS} digits (got "${code}").`,
      );
    }
    this.#write({ ...this.#state, code });
  }

  /** Settings › Security settings › Phone security is On. */
  phoneSecurity(): boolean {
    return this.#settings.label(PHONE_SECURITY_KEY) === "On";
  }

  /** Power-on asks for the code: Phone security is On and `sim` is not a recent SIM (B3). */
  asksAtPowerOn(sim: string): boolean {
    return this.phoneSecurity() && !this.#state.recentSims.includes(sim);
  }

  /** `sim` moves to the front of the recent SIMs (five at most). */
  insertSim(sim: string): void {
    const state = this.#state;
    if (state.recentSims[0] === sim) return;
    const recentSims = [sim, ...state.recentSims.filter((s) => s !== sim)].slice(0, RECENT_SIMS);
    this.#write({ ...state, recentSims });
  }

  get #state(): SecurityState {
    return this.#eeprom.read(SECURITY_RECORD);
  }

  #write(state: SecurityState): void {
    this.#eeprom.write(SECURITY_RECORD, state);
  }
}
