// The inserted SIM card (plan 19 D2) as data: host config and the contacts seam. A string is the
// emulator SIM under that identity; a `StockSimCard` adds its phone book and service numbers. Plan
// 30 adds the SIM's messages (`EF_SMS`) and toolkit menu. src/phone-book/sim-card.ts validates it
// once, when the phone is created.
import type { SimMessages, StockSimMessage } from "./messages";
import type { StockSimToolkit } from "./toolkit";

/** Plan 19: one SIM phone book entry or service number. */
export interface StockContact {
  /** Within the SIM's name length; every glyph in the small and large faces; "" = no name. */
  readonly name: string;
  /** 0-20 of `0-9 * # p` after an optional `+` (a SIM cannot hold `w`); "" = no number. */
  readonly number: string;
}

/** Plan 19: the inserted SIM card. Plan 15's string `sim` is `{ id }` with these defaults. */
export interface StockSimCard {
  /** Identity (plan 15: Phone security's recent SIMs; plan 18: messages). Non-empty. */
  readonly id: string;
  readonly phoneBook?: {
    /** Default 50 (the emulator SIM). */
    readonly locations?: number;
    /** Default 16. */
    readonly nameLength?: number;
    /** Initial entries by location (index 0 = location 1); null = a free location. */
    readonly entries?: readonly (StockContact | null)[];
  };
  /** The SIM's service numbers (Service Nos.), in SIM order. Default none. */
  readonly serviceNumbers?: readonly StockContact[];
  /**
   * Plan 30: `EF_SMS`. Default: 15 slots, none used. `entries` by slot (index 0 = slot 1); null =
   * a free slot.
   */
  readonly messages?: {
    readonly slots?: number;
    readonly entries?: readonly (StockSimMessage | null)[];
  };
  /** Plan 30: the SIM applet's menu (SIM services, Menu 14). Default: none. */
  readonly toolkit?: StockSimToolkit;
}

/** A validated SIM card with its defaults filled in. */
export interface NormalisedSimCard {
  readonly id: string;
  readonly locations: number;
  readonly nameLength: number;
  /** One per location (index 0 = location 1); null = free. */
  readonly entries: readonly (StockContact | null)[];
  readonly serviceNumbers: readonly StockContact[];
  /** Plan 30: its message slots and the received messages in them. */
  readonly messages: SimMessages;
  /** Plan 30: its toolkit menu, if it has one. */
  readonly toolkit?: StockSimToolkit;
}
