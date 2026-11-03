// SMS stored on the SIM card (plan 30 D2, Task 0 M) as data. Their validation against the GSM
// 7-bit alphabet and the stock faces is src/sim/messages.ts.
import type { StockTimestamp } from "../messaging/network";

/** Plan 30: one received SMS stored on the SIM (`EF_SMS`). */
export interface StockSimMessage {
  /** The originator: `+` and 1-20 digits (plan 19's number rules, no `* # p`). */
  readonly number: string;
  /**
   * One SMS: GSM 7-bit default alphabet and its extension table (two septets each), at most 160
   * septets, every character drawable in the small face; `[ ] { } ~ | ^` draw as `?` (Task 0 M).
   */
  readonly text: string;
  /** The service centre's time stamp (plan 18's `StockTimestamp`). */
  readonly sentAt: StockTimestamp;
  /** `EF_SMS` status: read (default) or unread. */
  readonly read?: boolean;
  /** Details' `Message centre:`: the record's service-centre address. Default "". */
  readonly centre?: string;
}

/** A SIM message with its defaults filled in. */
export interface SimMessage {
  readonly number: string;
  readonly text: string;
  readonly sentAt: StockTimestamp;
  readonly read: boolean;
  readonly centre: string;
}

/** The SIM's message records with their defaults filled in: one per slot up to the last used. */
export interface SimMessages {
  readonly slots: number;
  /** By slot (index 0 = slot 1); null = free. */
  readonly entries: readonly (SimMessage | null)[];
}

/** The emulator SIM's `EF_SMS`: 15 records (plan 18 D7); capacity follows the SIM (Task 0 M). */
export const SIM_MESSAGE_SLOTS = 15;
