// Read committed goldens by id (tests never read the REF corpus).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findGoldenImage, parseGolden, type Golden } from "../../scripts/golden-format.ts";
import type { GoldenImageRef } from "./golden.ts";

const GOLDENS = join(import.meta.dirname, "../../goldens");

export function loadGolden(id: string): Golden {
  const file = `${id}.lcd.txt`;
  return parseGolden(readFileSync(join(GOLDENS, file), "utf8"), file);
}

export function goldenImage(id: string, name: string): GoldenImageRef {
  return { id, image: findGoldenImage(loadGolden(id), name) };
}
