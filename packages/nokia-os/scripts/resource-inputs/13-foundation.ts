// The text drawn in each golden image, transcribed by reading the images (plan 13, Task 7).
// PlanCaptureSet.resources registers these runs: the harvester checks every run against
// the pixels and reports any transcription that does not fit (scripts/harvest-glyphs.ts).
//
// Layout facts used to place runs (plan 13 "Stock display observations"):
// - small: 8-row cells (7-row capitals, 1 descender row); large: 13 rows (11-row capitals);
//   digits: 6 rows; thin: 8 rows (7-row capitals, 1 descender row).
// - pages: label lines at tops 7/16/25 from x 0; the value (thin) at top 29, right-aligned.
// - rows: text tops 8/18/28; the selected row is inverted on a band x 0..77; window
//   max(0, selected - 2).
// - carousel: title (large) at top 7; indicator (digits) at top 0; softkey (small) at top 40.
// Runs stop short of the rail (x 81..83) and the standby status bars (x 0..3, 80..83).
import type { TextRun } from "../harvest-glyphs.ts";
import type { ResourceDeclarations } from "../resource-declarations.ts";

const softkey = (text: string): TextRun => ({ font: "small", text, top: 40 });
const indicator = (text: string): TextRun => ({ font: "digits", text, top: 0, left: 40 });
const PAGE_LINE_TOPS = [7, 16, 25] as const;
const ROW_TOPS = [8, 18, 28] as const;

function page(label: string, value?: string): TextRun[] {
  const runs: TextRun[] = label.split("\n").map((text, i) => {
    const top = PAGE_LINE_TOPS[i];
    if (top === undefined) throw new Error(`"${label}" has more than three lines`);
    return { font: "small", text, top, right: 79 };
  });
  if (value !== undefined) runs.push({ font: "thin", text: value, top: 29, right: 79 });
  return runs;
}

function rows(items: readonly string[], selected: number): TextRun[] {
  const first = Math.max(0, selected - 2);
  return items.slice(first, first + 3).map((text, r) => {
    const inverted = first + r === selected;
    return {
      font: "small",
      text,
      top: ROW_TOPS[r]!,
      right: inverted ? 77 : 79,
      ...(inverted ? { inverted } : {}),
    };
  });
}

export interface Level1 {
  readonly slug: string;
  readonly title: string;
  readonly presentation: "rows" | "pages";
  /** Labels in scroll order, with firmware line breaks as `\n` (D10). */
  readonly labels: readonly string[];
  /** Page values by 1-based image number (virgin-EEPROM snapshot, host clock/date inputs). */
  readonly values?: Readonly<Record<number, string>>;
  /**
   * Menu numbers shown in the indicator, when they are not 1..n. The firmware keeps a hidden
   * entry's number: the last Call divert and Games entries are `7-6` and `8-6`, yet the rail
   * places them as the 5th of 5.
   */
  readonly numbers?: readonly number[];
}

export const LEVEL1: readonly Level1[] = [
  {
    slug: "01-phone-book",
    title: "Phone book",
    presentation: "rows",
    labels: [
      "Search",
      "Service Nos.",
      "Add name",
      "Erase",
      "Edit",
      "Assign tone",
      "Send b'card",
      "Options",
      "Speed dials",
      "Voice tags",
    ],
  },
  {
    slug: "02-messages",
    title: "Messages",
    presentation: "pages",
    labels: [
      "Write\nmessages",
      "Inbox",
      "Outbox",
      "Picture\nmessages",
      "Templates",
      "Smileys",
      "Message\nsettings",
      "Info\nservice",
      "Voice\nmailbox\nnumber",
      "Service\ncommand\neditor",
    ],
    values: { 8: "Off" },
  },
  { slug: "03-chat", title: "Chat", presentation: "rows", labels: [] },
  {
    slug: "04-call-register",
    title: "Call register",
    presentation: "pages",
    labels: [
      "Missed\ncalls",
      "Received\ncalls",
      "Dialled\nnumbers",
      "Erase recent\ncall lists",
      "Show call\nduration",
      "Show call\ncosts",
      "Call cost\nsettings",
      "Prepaid credit",
    ],
  },
  {
    slug: "05-tones",
    title: "Tones",
    presentation: "pages",
    labels: [
      "Ringing\ntone",
      "Ringing\nvolume",
      "Incoming\ncall alert",
      "Composer",
      "Message\nalert tone",
      "Keypad\ntones",
      "Warning tones",
      "Vibrating\nalert",
      "Screen saver",
    ],
    values: { 2: "Level 1", 5: "No tone", 6: "Level 1", 9: "Off" },
  },
  {
    slug: "06-settings",
    title: "Settings",
    presentation: "pages",
    labels: [
      "Call\nsettings",
      "Phone\nsettings",
      "Security\nsettings",
      "Restore\nfactory\nsettings",
    ],
  },
  {
    slug: "07-call-divert",
    title: "Call divert",
    presentation: "pages",
    labels: [
      "Divert all\nvoice calls\nwithout ringing",
      "Divert\nwhen busy",
      "Divert if not\nanswered",
      "Divert when\nphone off\nor no coverage",
      "Cancel all\ndiverts",
    ],
    numbers: [1, 2, 3, 4, 6],
  },
  {
    slug: "08-games",
    title: "Games",
    presentation: "rows",
    // The firmware writes "Space impact" with a lower-case i.
    labels: ["Snake II", "Space impact", "Bantumi", "Pairs II", "Settings"],
    numbers: [1, 2, 3, 4, 6],
  },
  { slug: "09-calculator", title: "Calculator", presentation: "rows", labels: [] },
  {
    slug: "10-reminders",
    title: "Reminders",
    presentation: "rows",
    labels: ["Add new", "View all", "Erase"],
  },
  {
    slug: "11-clock",
    title: "Clock",
    presentation: "pages",
    labels: [
      "Alarm\nclock",
      "Clock\nsettings",
      "Date setting",
      "Stopwatch",
      "Countdown\ntimer",
      "Auto update of\ndate and time",
    ],
    // 10:10 and 13.10.2026 are the emulator's clock and the date typed during setup (D11).
    values: { 1: "Off", 2: "10:10", 3: "13.10.2026", 5: "Off", 6: "Off" },
  },
  {
    slug: "12-profiles",
    title: "Profiles",
    presentation: "rows",
    // Slot 6 is omitted from the golden (uninitialised EEPROM name).
    labels: ["General", "Silent", "Discreet", "Loud", "(empty)"],
  },
];

function imageName(n: number): string {
  return String(n).padStart(2, "0");
}

/** Each image of a level-1 `.sub` golden: the label (and page value), indicator and softkey. */
function levelImages(
  level: Level1,
  number: number,
  values = level.values,
): Record<string, readonly TextRun[]> {
  const images: Record<string, readonly TextRun[]> = {};
  level.labels.forEach((label, j) => {
    const body =
      level.presentation === "pages" ? page(label, values?.[j + 1]) : rows(level.labels, j);
    const shown = level.numbers?.[j] ?? j + 1;
    images[imageName(j + 1)] = [...body, indicator(`${number}-${shown}`), softkey("Select")];
  });
  return images;
}

function level1Runs(): Record<string, Record<string, readonly TextRun[]>> {
  const out: Record<string, Record<string, readonly TextRun[]>> = {};
  LEVEL1.forEach((level, i) => {
    const number = i + 1;
    out[`menu/${level.slug}`] = {
      [level.slug]: [
        { font: "large", text: level.title, top: 7, right: 79 },
        indicator(String(number)),
        softkey("Select"),
      ],
    };
    if (level.labels.length === 0) return;
    out[`menu/${level.slug}.sub`] = levelImages(level, number);
  });
  return out;
}

/**
 * The Task 11 clock captures: the same setup with the clock set to 19:48 and to 07:59, so the
 * digits and thin fonts gain every digit. Their standby and Clock pages differ from the 10:10
 * captures only in the time.
 */
function clockTimeRuns(): Record<string, Record<string, readonly TextRun[]>> {
  const clock = LEVEL1.findIndex((level) => level.slug === "11-clock");
  const level = LEVEL1[clock]!;
  const out: Record<string, Record<string, readonly TextRun[]>> = {};
  for (const time of ["19:48", "07:59"]) {
    const suffix = time.replace(":", "");
    out[`standby/standby-${suffix}`] = { standby: standby(time) };
    out[`menu/11-clock.sub-${suffix}`] = levelImages(level, clock + 1, {
      ...level.values,
      2: time,
    });
  }
  return out;
}

// "Orange F" and the clock are emulator artefacts (D11); the bars sit at x 0..3 and 80..83.
function standby(clock: string): TextRun[] {
  return [
    { font: "small", text: "Orange F", top: 8, left: 5, right: 78 },
    { font: "digits", text: clock, top: 0, left: 5, right: 78 },
    softkey("Menu"),
  ];
}

const STANDBY = standby("10:10");

const glyphOverrides = ([] = [
  // menu/02-messages.sub "01" vs "02": `2-1` and `2-2` put the last digit in the same cell, but
  // 1's ink starts one column after 2's. Digits sit in 6-column cells; 1 is drawn one column in.
  { kind: "bearing", font: "digits", char: "1", bearing: 1 },
  // menu/11-clock.sub "03" (13.10.2026) and "02" (10:10): the thin 1 likewise sits one column
  // into a 5-column digit cell (`.` and `:` measure 3 before a 1 and 2 before a 2).
  { kind: "bearing", font: "thin", char: "1", bearing: 1 },
  // probe/unset-down "01" ("Level 1" inverted): the small 1 likewise sits one column into its
  // cell (a 3-column space before it measures 4 without the bearing).
  { kind: "bearing", font: "small", char: "1", bearing: 1 },
  // menu/10-reminders, tree/04-call-register/4-4-4.choose "b" (Received), probe/progress-7-6-quit
  // "l" (Request): the leg of the large R fills its blank column, so R runs into a following e.
  // R's ink is 8 columns.
  { kind: "touch", font: "large", pair: "Re", width: 8 },
  // menu/12-profiles.sub "05" "(empty)": ')' ink is 3 columns.
  { kind: "advance", font: "small", char: ")", advance: 4 },
  // menu/01-phone-book.sub "02" "Service Nos.": '.' ink is 2 columns.
  { kind: "advance", font: "small", char: ".", advance: 3 },
  // menu/03-chat.sub "01" "Phone number:": ':' ink is 2 columns.
  { kind: "advance", font: "small", char: ":", advance: 3 },
  // standby/standby "Orange F": 'F' ink is 5 columns.
  { kind: "advance", font: "small", char: "F", advance: 6 },
  // menu/02-messages.sub "02" "Inbox": 'x' ink is 5 columns.
  { kind: "advance", font: "small", char: "x", advance: 6 },
  // menu/01-phone-book "Phone book": 'k' ink is 6 columns.
  { kind: "advance", font: "large", char: "k", advance: 7 },
  // menu/01-phone-book.sub "03" (`1-3`): '3' ink is 5 columns, a full digit cell.
  { kind: "advance", font: "digits", char: "3", advance: 6 },
  // menu/01-phone-book.sub "09" (`1-9`): '9' ink is 5 columns.
  { kind: "advance", font: "digits", char: "9", advance: 6 },
  // menu/11-clock.sub "03" "13.10.2026": '6' ink is 4 columns, a full thin digit cell.
  { kind: "advance", font: "thin", char: "6", advance: 5 },
  // menu/11-clock.sub-1948 "02" "19:48": '8' ink is 4 columns, a full thin digit cell.
  { kind: "advance", font: "thin", char: "8", advance: 5 },
  // menu/05-tones.sub "02" "Level 1": 'l' ink is 1 column.
  { kind: "advance", font: "thin", char: "l", advance: 2 },
  // Plan 14 (Task 6): characters the menu-tree goldens show only at a word end; each cell is its
  // ink plus one blank column, as above (digits fill their tabular cells the same way).
  // tree/05-tones/5-1.options "10" "That's it!": '!' ink is 2 columns.
  { kind: "advance", font: "small", char: "!", advance: 3 },
] as const);

export const resources: ResourceDeclarations = {
  textRuns: {
    "standby/standby": { "01-standby": STANDBY },
    "standby/idle": { a: STANDBY },
    ...level1Runs(),
    ...clockTimeRuns(),
    // Pending goldens are real firmware output too; their text extends the fonts.
    "menu/03-chat.sub": {
      "01": [{ font: "small", text: "Phone number:", top: 7, right: 79 }, softkey("Search")],
      "02": [
        { font: "large", text: "No phone", top: 3, right: 60 },
        { font: "large", text: "numbers", top: 18, right: 60 },
      ],
    },
    "menu/09-calculator.sub": { "01": [softkey("Options")] },
  },
  glyphOverrides,
};
