import type { PhoneKey } from "@hellotimber/phone-core";
import type { TextPageModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

/** Instructions: `More` pages through the text and cycles to the first page; C leaves (P12). */
export function textPages(options: {
  readonly pages: readonly (readonly string[])[];
  readonly softkey: string;
}): Widget {
  if (options.pages.length === 0) throw new Error("Text pages need at least one page.");
  let page = 0;
  return {
    render: (): TextPageModel => ({
      kind: "text-page",
      lines: options.pages[page]!,
      softkey: options.softkey,
    }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi") page = (page + 1) % options.pages.length;
      else if (key === "c") flow.back();
    },
  };
}
