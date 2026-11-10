// Structural validation of a game manifest (plan 28 D4, D19). A manifest reaches the host as
// untrusted JSON; this checks that it is well-formed and returns a frozen copy. It bounds nothing a
// game may choose: the only limits are those of `limits.ts`. Whether the labels can be drawn in
// the host's fonts, and whether the id collides with a game the host already has, is the host's
// check.

import { decodeBase64 } from "./base64";
import type { GameManifest, GameMenuItem, GameSplash } from "./contract";
import { MAX_STORAGE_BYTES, PACKED_FRAME_BYTES } from "./limits";

/** Lower-case letters and digits in dash-separated runs. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The slugs of the entries the shell adds itself (D5), which a play or choice item may not take. */
const RESERVED_SLUGS: readonly string[] = ["continue", "level", "top-score", "instructions"];

type Fields = Readonly<Record<string, unknown>>;

function fail(path: string, expected: string): never {
  throw new Error(`Invalid game manifest: ${path}: expected ${expected}`);
}

/** Reads every own field once into a plain object, so later reads cannot differ. */
function fields(value: unknown, path: string, known: readonly string[]): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "an object");
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) fail(path === "manifest" ? key : `${path}.${key}`, "no such field");
    copy[key] = (value as Record<string, unknown>)[key];
  }
  return copy;
}

function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, "a list of at least one");
  return Array.from(value as readonly unknown[]);
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "text");
  return value;
}

function label(value: unknown, path: string): string {
  if (text(value, path) === "") fail(path, "text that is not empty");
  return value as string;
}

function kebab(value: unknown, path: string): string {
  if (typeof value !== "string" || !KEBAB.test(value)) fail(path, "a kebab-case slug");
  return value;
}

function integer(value: unknown, path: string, min: number, max?: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
    fail(
      path,
      max === undefined ? `an integer of at least ${min}` : `an integer in ${min}..${max}`,
    );
  }
  if (max !== undefined && value > max) fail(path, `an integer in ${min}..${max}`);
  return value;
}

function flag(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "true or false");
  return value;
}

function splash(value: unknown): GameSplash {
  const source = fields(value, "splash", ["frames", "steps"]);
  const frames = list(source.frames, "splash.frames").map((frame, i) => {
    const path = `splash.frames[${i}]`;
    let bytes: number;
    try {
      bytes = decodeBase64(text(frame, path)).length;
    } catch {
      fail(path, "a base64 packed frame");
    }
    if (bytes !== PACKED_FRAME_BYTES) {
      fail(path, `a packed frame of ${PACKED_FRAME_BYTES} bytes, not ${bytes}`);
    }
    return frame as string;
  });
  const steps = list(source.steps, "splash.steps").map((step, i) => {
    const path = `splash.steps[${i}]`;
    const { frame, ms } = fields(step, path, ["frame", "ms"]);
    return Object.freeze({
      frame: integer(frame, `${path}.frame`, 0, frames.length - 1),
      ms: integer(ms, `${path}.ms`, 1),
    });
  });
  return Object.freeze({ frames: Object.freeze(frames), steps: Object.freeze(steps) });
}

function menuItem(value: unknown, path: string): GameMenuItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "an object");
  const kind = (value as { kind?: unknown }).kind;
  switch (kind) {
    case "play": {
      const source = fields(value, path, ["kind", "slug", "label", "mode"]);
      return Object.freeze({
        kind,
        slug: kebab(source.slug, `${path}.slug`),
        label: label(source.label, `${path}.label`),
        ...(source.mode === undefined ? {} : { mode: text(source.mode, `${path}.mode`) }),
      });
    }
    case "choice": {
      const source = fields(value, path, ["kind", "slug", "label", "options", "initial"]);
      const options = list(source.options, `${path}.options`).map((option, i) =>
        label(option, `${path}.options[${i}]`),
      );
      return Object.freeze({
        kind,
        slug: kebab(source.slug, `${path}.slug`),
        label: label(source.label, `${path}.label`),
        options: Object.freeze(options),
        initial: integer(source.initial, `${path}.initial`, 0, options.length - 1),
      });
    }
    case "level":
    case "top-score":
      fields(value, path, ["kind"]);
      return Object.freeze({ kind });
    case "instructions": {
      const source = fields(value, path, ["kind", "pages"]);
      const pages = list(source.pages, `${path}.pages`).map((page, i) =>
        label(page, `${path}.pages[${i}]`),
      );
      return Object.freeze({ kind, pages: Object.freeze(pages) });
    }
    default:
      return fail(`${path}.kind`, "play, level, choice, top-score or instructions");
  }
}

function menu(value: unknown, hasLevel: boolean, scores: boolean): readonly GameMenuItem[] {
  const items = list(value, "menu").map((item, i) => menuItem(item, `menu[${i}]`));
  if (items[0]!.kind !== "play") fail("menu[0].kind", "play: the first item starts a game");
  // Each item is one entry of the game menu, so its slug is taken once: a play or choice item's
  // own, and the fixed slug of the others.
  const taken = new Set<string>();
  items.forEach((item, i) => {
    const path = `menu[${i}]`;
    if (item.kind === "play" || item.kind === "choice") {
      if (RESERVED_SLUGS.includes(item.slug)) fail(`${path}.slug`, "a slug the shell does not use");
      if (taken.has(item.slug)) fail(`${path}.slug`, "a slug no other item has");
      taken.add(item.slug);
      return;
    }
    if (taken.has(item.kind)) fail(`${path}.kind`, `one ${item.kind} item at most`);
    taken.add(item.kind);
    if (item.kind === "level" && !hasLevel) fail(`${path}.kind`, "no level item without `level`");
    if (item.kind === "top-score" && !scores) {
      fail(`${path}.kind`, "no top-score item with `scores: false`");
    }
  });
  return Object.freeze(items);
}

/** Checks a manifest's structure and returns a frozen copy. Throws naming the field. */
export function validateManifest(value: unknown): GameManifest {
  const source = fields(value, "manifest", [
    "sdk",
    "id",
    "name",
    "splash",
    "menu",
    "level",
    "suspend",
    "scores",
    "storageBytes",
  ]);
  if (source.sdk !== 1) fail("sdk", "1");
  let level: GameManifest["level"];
  if (source.level !== undefined) {
    const { max, initial } = fields(source.level, "level", ["max", "initial"]);
    const top = integer(max, "level.max", 1);
    level = Object.freeze({ max: top, initial: integer(initial, "level.initial", 1, top) });
  }
  const scores = source.scores === undefined ? undefined : flag(source.scores, "scores");
  const manifest: GameManifest = {
    sdk: 1,
    id: kebab(source.id, "id"),
    name: label(source.name, "name"),
    splash: splash(source.splash),
    menu: menu(source.menu, level !== undefined, scores !== false),
    ...(level === undefined ? {} : { level }),
    ...(source.suspend === undefined ? {} : { suspend: flag(source.suspend, "suspend") }),
    ...(scores === undefined ? {} : { scores }),
    ...(source.storageBytes === undefined
      ? {}
      : { storageBytes: integer(source.storageBytes, "storageBytes", 0, MAX_STORAGE_BYTES) }),
  };
  return Object.freeze(manifest);
}
