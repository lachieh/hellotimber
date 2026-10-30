import type { StockSimMessage } from "@hellotimber/nokia-os";
import { PEOPLE } from "./people";

export const INTRO_MESSAGE =
  "Hi, I'm Lachlan. I build software for the web - and, apparently, phones. This whole site is a working Nokia 3310.";
export const STACK_MESSAGE =
  "Daily drivers: TypeScript, React, three.js, and an 84x48 pixel grid. I like hard boundaries and small packages.";
export const CONTACT_MESSAGE =
  "Want to talk? Text Lachlan here, or find him on LinkedIn (lachlanh), GitHub (lachieh), Bluesky or X (lachie_h). Based in Atlanta, GA; replies in ET hours.";
export const BIO_MESSAGE =
  "Aussie software engineer in Atlanta, GA. Builds web tooling, SDKs and developer experience. Currently at tambo; before that Cosmonic and Real Theory.";
export const TAMBO_MESSAGE =
  "Now: tambo, a generative UI SDK for React. 100+ merged PRs across the SDK, web app, monorepo builds and security upkeep.";
export const COSMONIC_MESSAGE =
  "Before: Cosmonic, on wasmCloud (CNCF). TypeScript libraries and tooling, the washboard UI, CI, and the wasmcloud.com docs site.";
export const OPEN_SOURCE_MESSAGE =
  "Open source: fixes in Perses (CNCF), Turborepo, Nitro and Raycast extensions. Plus a cmux plugin for herdr and a mise plugin for Raycast.";

export const SIM_MESSAGES: readonly StockSimMessage[] = [
  INTRO_MESSAGE,
  STACK_MESSAGE,
  CONTACT_MESSAGE,
  BIO_MESSAGE,
  TAMBO_MESSAGE,
  COSMONIC_MESSAGE,
  OPEN_SOURCE_MESSAGE,
].map((text, index) => ({
  number: PEOPLE[0].number,
  text,
  sentAt: { year: 2000, month: 9, day: 1, hour: 9, minute: 3 + index, second: 0 },
}));
