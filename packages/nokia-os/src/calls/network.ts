// The call half of the host network port (plan 22 D5): the objects a call is made of. The host
// owns what a call does; the phone shows it and keeps its own link times (D10). Every network
// cause looks alike on the 3310 (S14), so a release carries none.

/** An outgoing call as the phone places it, when Calling appears. */
export interface StockOutgoingCall {
  /** The number dialled: the entry cut at a later `+` or at the first `p`/`w`. */
  readonly number: string;
  /** The phone book name saved for the number, when the phone book knows one. */
  readonly name?: string;
  /** An emergency call (`112`): `Attempting emergency call`. */
  readonly emergency: boolean;
}

/** An incoming call as the network presents it. */
export interface StockIncomingCall {
  /** Digits (a leading `+` is dropped on screen, S17). */
  readonly number: string;
}

/** The host's side of one call; the phone calls each at most once. */
export interface StockCallLink {
  /** Incoming calls only: the user answered. */
  hold?(): boolean | Promise<boolean>;
  retrieve?(): boolean | Promise<boolean>;
  sendDtmf?(text: string, signal: AbortSignal): boolean | Promise<boolean>;
  answer(): void;
  /** The user ended the call, or rejected it while it rang (End, C, power-off). */
  hangUp(): void;
}

/** The phone's side of one call; the host calls these, applied at the phone's next tick. */
export interface StockCallControl {
  /** Outgoing: the far end is ringing (`Call 1`, the ringback). */
  alerting(): void;
  /** The speech channel connected (the ringback stops, the duration starts). */
  connected(): void;
  /**
   * The far end or the network ended the call, or refused it before it alerted: the network's end
   * (the checkered `Call 1`, three beeps), then standby; an incoming call released before Answer
   * is a missed call.
   */
  released(): void;
}

/** How the host rings the phone: `ring(call, link)` returns the phone's control of the call. */
export type StockRing = (call: StockIncomingCall, link: StockCallLink) => StockCallControl;

/** A call the synthetic network rang: hang it up from the far end, or read its state. */
export interface SyntheticRing {
  hangUp(): void;
  readonly state: "ringing" | "connected" | "ended";
}

/** The synthetic network's call half (`createSyntheticNetwork` in messages/network). */
export interface SyntheticCalls {
  dial(call: StockOutgoingCall, phone: StockCallControl): StockCallLink;
  subscribeCalls(ring: StockRing): () => void;
  /** Rings every subscribed phone from `number`. */
  ring(number: string): SyntheticRing;
  /** Every call phones placed through this network, in order. */
  readonly dialled: readonly StockOutgoingCall[];
}

/**
 * The emulator's cell (D5, D15): a dialled call alerts and connects at once (an emergency call
 * does neither, as the emulator's `112`); calls last until the phone or `ring`'s handle ends them.
 */
export function syntheticCalls(): SyntheticCalls {
  const rings = new Set<StockRing>();
  const dialled: StockOutgoingCall[] = [];
  return {
    dial(call, phone) {
      dialled.push({ ...call });
      if (!call.emergency) {
        phone.alerting();
        phone.connected();
      }
      return {
        answer() {},
        hangUp() {},
        hold: () => true,
        retrieve: () => true,
        sendDtmf: () => true,
      };
    },
    subscribeCalls(ring) {
      rings.add(ring);
      return () => {
        rings.delete(ring);
      };
    },
    ring(number) {
      let state: SyntheticRing["state"] = "ringing";
      const link: StockCallLink = {
        answer() {
          if (state !== "ringing") return;
          state = "connected";
          for (const control of controls) control.connected();
        },
        hangUp() {
          state = "ended";
        },
      };
      const controls = Array.from(rings).map((ring) => ring({ number }, link));
      return {
        hangUp() {
          if (state === "ended") return;
          state = "ended";
          for (const control of controls) control.released();
        },
        get state() {
          return state;
        },
      };
    },
    dialled,
  };
}
