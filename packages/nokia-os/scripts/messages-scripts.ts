// Transcribe plan 18 Task 0's capture command logs for the acceptance scenarios (plan 18 Task 12).
//
//   mise exec -- vp run @hellotimber/nokia-os#messages-scripts /path/to/nokia-3310
//
// Reads `captures/scripts/v639-plan18-<section>.cap` (the exact command stream each capture
// section sent; `gen_v639_plan18.py`) and the Welcome note sections of `v639-plan15.cap`, and
// writes `scripts/generated/messages-scripts.ts`: each log's commands, one per line, without
// comments, indentation and `hex` (a read that takes no emulated time). The setup include
// becomes `include setup`; image paths keep their file name only. Tests replay these streams
// (tests/support/messages.ts), so they never read `$REF`. The glyph sheet sections are left out
// (their goldens are resources, not scenarios), as are the T9 insertion probes (plan 18b
// evidence), the failure attempts (no golden, D14) and the receive limits (not imported).
//
// Idempotent. Runs under Node's type stripping: imports only node:*.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PACKAGE, "scripts/generated/messages-scripts.ts");

/** Sections whose captures no plan 18 scenario replays. */
const LEFT_OUT = new Set([
  "glyphs-digits",
  "glyphs-large",
  "glyphs-small",
  "insert-t9",
  "fail-boot",
  "fail-centre",
  "fail-set2",
  "fail-stall",
  "receive-limits",
]);

function fail(message: string): never {
  console.error(`messages-scripts: ${message}`);
  process.exit(1);
}

/**
 * A log's commands: no comments, blank lines or `hex`; image paths shortened; the setup include,
 * and the setup's commands where a log inlines them (after a reboot), as `include setup`.
 */
export function transcribe(
  log: string,
  setup: readonly string[],
  count: (prefix: string) => number = () => 0,
): string[] {
  const out: string[] = [];
  // The header names the image the log boots and the SMS clock's epoch (the last one given).
  const image = /^# firmware: \S*\/(\S+)$/m.exec(log)?.[1];
  if (image !== undefined && !image.includes("virgin")) out.push(`image ${image}`);
  const epoch = /^# dct3cap args:.*$/m
    .exec(log)?.[0]
    .match(/CAP_EPOCH=\d+/g)
    ?.at(-1);
  if (epoch !== undefined) out.push(`epoch ${epoch.slice("CAP_EPOCH=".length)}`);
  for (const raw of log.split("\n")) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line === "" || line.startsWith("#") || line === "hex") continue;
    const [command, ...args] = line.split(" ");
    if (command === "include") {
      if (!(args[0] ?? "").endsWith("v639-setup.inc")) fail(`unknown include ${args[0]}`);
      out.push("include setup");
    } else if (command === "reboot" || command === "saveflash") {
      out.push(`${command} ${basename(args[0] ?? "")}`);
    } else if (command === "scroll") {
      out.push(`${line} =${count(args[0]!)}`);
    } else out.push(line);
    const tail = out.slice(-setup.length);
    if (setup.length > 0 && tail.join("\n") === setup.join("\n")) {
      out.splice(-setup.length, setup.length, "include setup");
    }
  }
  return out;
}

/** The Welcome note sections of plan 15's log: from the reboot before each to the next reboot. */
export function plan15Welcome(commands: readonly string[]): string[] {
  const sections: string[][] = [];
  for (const command of commands) {
    if (command.startsWith("reboot ") || sections.length === 0) sections.push([]);
    sections.at(-1)!.push(command);
  }
  return sections.filter((s) => s.some((c) => c.includes("plan15/welcome/"))).flat();
}

function main(): void {
  const root = process.argv[2];
  if (root === undefined) fail("usage: messages-scripts <path to nokia-3310>");
  const dir = join(resolve(root), "captures/scripts");
  if (!existsSync(dir)) fail(`missing ${dir}`);
  const include = join(dir, "v639-setup.inc");
  if (!existsSync(include)) fail(`missing ${include}`);
  const setup = transcribe(readFileSync(include, "utf8"), []);
  // A scroll's shots: the `NN.png` files it wrote under captures/6.39.
  const count = (prefix: string): number => {
    const shots = join(resolve(root), "captures/6.39", prefix);
    if (!existsSync(shots)) fail(`missing scroll ${shots}`);
    return readdirSync(shots).filter((name) => /^\d\d\.png$/.test(name)).length;
  };
  const scripts: Record<string, string[]> = {};
  for (const file of readdirSync(dir).sort()) {
    const section = /^v639-plan18-(.+)\.cap$/.exec(file)?.[1];
    if (section === undefined || LEFT_OUT.has(section)) continue;
    scripts[`plan18/${section}`] = transcribe(readFileSync(join(dir, file), "utf8"), setup, count);
  }
  const plan15 = join(dir, "v639-plan15.cap");
  if (!existsSync(plan15)) fail(`missing ${plan15}`);
  scripts["plan15/welcome"] = plan15Welcome(transcribe(readFileSync(plan15, "utf8"), setup, count));
  const body = Object.entries(scripts)
    .map(([name, lines]) => `  ${JSON.stringify(name)}: ${JSON.stringify(lines.join("\n"))},`)
    .join("\n");
  writeFileSync(
    OUT,
    [
      "// GENERATED by scripts/messages-scripts.ts from captures/scripts/v639-plan18-*.cap and v639-plan15.cap - do not edit",
      "// Plan 18 Task 0's capture command logs, one command per line (tests/support/messages.ts replays them).",
      "export const MESSAGES_CAPTURE_SCRIPTS: Readonly<Record<string, string>> = {",
      body,
      "};",
      "",
    ].join("\n"),
  );
  console.log(`messages-scripts: ${Object.keys(scripts).length} logs → ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
