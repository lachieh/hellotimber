// The capture-set vocabulary (scripts/capture-set.ts): a `shots` source's image names.
import { describe, expect, it } from "vite-plus/test";
import { shotImages } from "../scripts/capture-set.ts";

describe("shotImages", () => {
  it("names a path after its file stem, as before", () => {
    expect(
      shotImages(["plan15/boot/gate-keys/00-prompt.png", "menu/6-4-keys/01-prompt.png"]),
    ).toEqual([
      { file: "plan15/boot/gate-keys/00-prompt.png", name: "00-prompt" },
      { file: "menu/6-4-keys/01-prompt.png", name: "01-prompt" },
    ]);
  });

  it("uses the name an entry gives, beside unnamed paths", () => {
    expect(
      shotImages([
        { file: "plan20/results/0.1+0.2.png", name: "0p1plus0p2" },
        "plan20/results/1d3.png",
      ]),
    ).toEqual([
      { file: "plan20/results/0.1+0.2.png", name: "0p1plus0p2" },
      { file: "plan20/results/1d3.png", name: "1d3" },
    ]);
  });

  it("rejects a name outside the golden format, naming the file", () => {
    expect(() => shotImages([{ file: "plan20/results/12+3.png", name: "12+3" }])).toThrow(
      'plan20/results/12+3.png: image name "12+3" must match [a-z0-9-]+',
    );
    expect(() => shotImages(["plan20/results/12+3.png"])).toThrow(
      'plan20/results/12+3.png: image name "12+3" must match [a-z0-9-]+ (name the shot: { file, name })',
    );
  });
});
