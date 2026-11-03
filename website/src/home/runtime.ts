// The homepage's phone: one runtime per session running the homepage firmware, on its own
// EEPROM (so stock-firmware state an older visit left in localStorage can't reach it).
import { PEOPLE } from "../content/people";
import { hostClock, hostDate } from "../phone/host-clock";
import { imeiForHash } from "../phone/imei";
import { createPortfolioNetwork } from "../phone/network";
import { loadEnglishT9, startPhoneRuntime, type PhoneRuntime } from "../phone/runtime";
import { hostStorage, scopedStorage } from "../phone/storage";
import { homeFirmware } from "./firmware";

export const HOME_STORAGE_PREFIX = "hellotimber.home/";

/** The SIM: the personas in the phone book, so Chat's Search finds them. */
export const HOME_SIM = {
  id: "hellotimber-home",
  phoneBook: { entries: PEOPLE.map(({ name, number }) => ({ name, number })) },
};

/** Who follows the phone's links to site paths (the router bridge); none: a full page load. */
const siteLinkListeners = new Set<(path: string) => void>();

/** Calls `listener` for each site path the phone opens until the returned function is called. */
export function onSiteLink(listener: (path: string) => void): () => void {
  siteLinkListeners.add(listener);
  return () => siteLinkListeners.delete(listener);
}

/** An absolute URL opens in a new tab (a key press is the user gesture); a site path navigates. */
export function openLink(href: string): void {
  if (/^[a-z]+:/i.test(href)) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  if (siteLinkListeners.size === 0) window.location.assign(href);
  for (const listener of Array.from(siteLinkListeners)) listener(href);
}

function createRuntime(english: Parameters<typeof startPhoneRuntime>[0]["english"]) {
  const storage = scopedStorage(hostStorage(), HOME_STORAGE_PREFIX);
  return startPhoneRuntime({
    english,
    firmware: homeFirmware(openLink),
    carrier: "LACHLAN",
    storage,
    sim: HOME_SIM,
    // Snake II at level 5 (217 ms a step): the virgin EEPROM's level 175 steps every ≈7.7 ms.
    preload: { snakeLevel: 5 },
    imei: imeiForHash(__BUILD_HASH__),
    clock: hostClock,
    date: hostDate,
    network: createPortfolioNetwork({ storage, simId: HOME_SIM.id }),
  });
}

let runtime: PhoneRuntime | undefined;
let loading: Promise<PhoneRuntime> | undefined;
export function loadHomeRuntime(): Promise<PhoneRuntime> {
  if (typeof window === "undefined") throw new Error("Phone runtime is client-only");
  return (loading ??= loadEnglishT9()
    .then(createRuntime)
    .then((ready) => (runtime = ready)));
}
/** The loaded runtime; suspends (throws its loading promise) until it has loaded. */
export function getHomeRuntime(): PhoneRuntime {
  if (runtime) return runtime;
  throw loadHomeRuntime();
}
