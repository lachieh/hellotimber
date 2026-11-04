// Shiki's theme for code in posts, from the catalogue's palette (website/DESIGN.md): ink on paper,
// told apart by weight and Ink 2 rather than colour. The signal colour is never text.
import type { ThemeRegistration } from "shiki";

const INK = "#191816";
const INK_2 = "#565552";
const PAPER = "#f4f3f0";

export const CATALOGUE_CODE_THEME: ThemeRegistration = {
  name: "hellotimber-catalogue",
  type: "light",
  colors: { "editor.background": PAPER, "editor.foreground": INK },
  fg: INK,
  bg: PAPER,
  settings: [
    { settings: { foreground: INK, background: PAPER } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: INK_2, fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control"],
      settings: { foreground: INK, fontStyle: "bold" },
    },
    {
      scope: ["string", "string.template", "constant.numeric", "constant.language"],
      settings: { foreground: INK_2 },
    },
    {
      scope: ["entity.name.function", "entity.name.type", "support.type", "entity.name.class"],
      settings: { foreground: INK, fontStyle: "bold" },
    },
    {
      scope: ["punctuation", "meta.brace", "keyword.operator"],
      settings: { foreground: INK_2, fontStyle: "" },
    },
  ],
};
