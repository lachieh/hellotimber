// Carousel graphics for the homepage firmware's own items. About and Work are drawn here in the
// stock icons' style: a 1-bit object 14 rows tall beside the stock hand and pen every carousel
// icon carries, ending at x 63 like the stock ones. Writing, Now and Contact reuse stock icons.
import type { CarouselGraphic } from "@hellotimber/nokia-os";
import { STOCK_MENU_ICONS, stockMenuGraphic } from "@hellotimber/nokia-kit/ui/resources";
import { bitmapFromArt, type Bitmap } from "@hellotimber/phone-screen";

/** Columns of the stock hand at the right of every carousel icon (Chat's has nothing else there). */
const HAND_WIDTH = 19;
const ICON_RIGHT = 64;
const ICON_TOP = 23;

function handRows(): string[] {
  const chat = STOCK_MENU_ICONS.chat!.frames[0]!;
  const rows: string[] = [];
  for (let y = 0; y < chat.height; y++) {
    let row = "";
    for (let x = chat.width - HAND_WIDTH; x < chat.width; x++) {
      row += chat.pixels[y * chat.width + x] ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/** `art` (14 rows), a blank column and the stock hand, as a static carousel graphic. */
function drawn(art: readonly string[]): CarouselGraphic {
  const hand = handRows();
  if (art.length !== hand.length) throw new Error(`Icon art needs ${hand.length} rows.`);
  const frame: Bitmap = bitmapFromArt(art.map((row, y) => `${row}.${hand[y]}`));
  return { x: ICON_RIGHT - frame.width, y: ICON_TOP, frames: [frame] };
}

/** A stock icon's frames and timeline under another item (its per-reveal timelines aren't kept). */
function stock(id: string): CarouselGraphic {
  const icon = STOCK_MENU_ICONS[id];
  if (icon === undefined) throw new Error(`No stock menu icon "${id}".`);
  const { timeline } = stockMenuGraphic(id);
  return { ...icon, ...(timeline === undefined ? {} : { timeline }) };
}

/** A head and shoulders. */
const ABOUT = drawn([
  "........######........",
  ".......#......#.......",
  "......#........#......",
  "......#........#......",
  "......#........#......",
  ".......#......#.......",
  "........######........",
  ".....##........##.....",
  "...##............##...",
  "..#................#..",
  ".#..................#.",
  "#....................#",
  "#....................#",
  "######################",
]);

/** A briefcase. */
const WORK = drawn([
  ".........########.........",
  "........#........#........",
  "........#........#........",
  "##########################",
  "#........................#",
  "#........................#",
  "#...........####.........#",
  "############.##.##########",
  "#...........####.........#",
  "#........................#",
  "#........................#",
  "#........................#",
  "#........................#",
  "##########################",
]);

export const HOME_ICONS = {
  about: ABOUT,
  work: WORK,
  writing: stock("messages"),
  now: stock("reminders"),
  contact: stock("phone-book"),
} as const;
