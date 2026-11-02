import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { Nokia3310Sketch } from "../src/sketch";
import { KEY_NODES } from "../src/layout";
import { REGIONS } from "../src/sketch/outline.generated";

const render = (props: Parameters<typeof Nokia3310Sketch>[0] = {}) =>
  renderToString(createElement(Nokia3310Sketch, props));

describe("Nokia3310Sketch", () => {
  it("traces every key of the model", () => {
    for (const node of Object.values(KEY_NODES)) expect(REGIONS).toHaveProperty(node);
  });

  it("renders on the server, hidden from assistive tech, with the keypad lettered", () => {
    const html = render();
    expect(html).toContain('aria-hidden="true"');
    for (const legend of ["1", "5", "9", "0", "*", "#", "C"])
      expect(html).toContain(`>${legend}</text>`);
  });

  it("keeps its SVG ids apart when a page holds two sketches", () => {
    const html = renderToString(
      createElement("div", null, createElement(Nokia3310Sketch), createElement(Nokia3310Sketch)),
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
  });

  it("sizes to the stage camera, or to the fit like PhoneStage's", () => {
    // Without fit, the default camera sees ~11.5 units at the phone: 10 / 11.52 of the height.
    expect(render()).toMatch(/height:86\.8\d*cqh/);
    expect(render({ fit: 0.95 })).toMatch(/height:min\(95cqh, *[\d.]+cqw\)/);
  });

  it("paints the LCD the stage's colour", () => {
    expect(render({ screenBgColor: "#abcdef" })).toContain('fill="#abcdef"');
  });
});
