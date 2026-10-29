import type { Framebuffer } from "@hellotimber/phone-screen";
import type { SpaceImpactRenderModel } from "../../games/space-impact/model";
import { SPACE_IMPACT_DATA } from "../../resources/generated/space-impact";

export interface SpaceImpactModel {
  readonly kind: "space-impact";
  readonly board: SpaceImpactRenderModel;
}

export function paintSpaceImpact(fb: Framebuffer, { board }: SpaceImpactModel): void {
  const { level, scroll, hud } = board;
  const ceiling = level === 4 || level === 5;
  const inverted = level === 0 || ceiling;
  fb.clear(inverted ? 1 : 0);
  const draw = (id: string, left: number, top: number, xor = inverted) => {
    const art = SPACE_IMPACT_DATA.sprites[id];
    if (!art) throw new Error(`Space impact: missing sprite ${id}`);
    for (const [dy, row] of art.entries()) {
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] !== "#") continue;
        const x = left + dx,
          y = top + dy;
        fb.setPixel(x, y, xor ? (fb.getPixel(x, y) === 1 ? 0 : 1) : 1);
      }
    }
  };
  if (level !== 0) {
    const map = SPACE_IMPACT_DATA.terrain[level];
    if (!map) throw new Error(`Space impact: missing terrain ${level}`);
    for (let dy = 0; dy < 16; dy++) {
      for (let x = 0; x < 84; x++) {
        const worldX = (scroll + x) % 512;
        const column = Math.floor(worldX / 32);
        let tile = map.rows[Math.floor(dy / 8)]![column];
        if (tile === null || tile === undefined)
          throw new Error(`Space impact: UNVERIFIED terrain ${level}/${column}`);
        if (x === 0 && scroll % 32 === 0 && dy >= 8) tile = map.leadingTiles[column] ?? tile;
        if (tile !== "blank" && SPACE_IMPACT_DATA.sprites[tile]![dy % 8]![worldX % 32] === "#")
          fb.setPixel(x, map.top + dy, inverted ? 0 : 1);
      }
    }
  }
  const hudY = ceiling ? 43 : 0;
  for (let heart = 0; heart < hud.lives; heart++) draw("heart", heart * 6, hudY, true);
  draw(`special/${hud.weapon}`, 36, hudY, true);
  const digits = (value: number, x: number, length: number) => {
    for (const [offset, digit] of String(value).padStart(length, "0").split("").entries())
      draw(`digit/${digit}`, x + offset * 4, hudY, true);
  };
  digits(hud.count, 43, 2);
  digits(hud.score, 57, 5);
  for (const sprite of board.sprites) draw(sprite.picture, sprite.x, sprite.y);
}
