import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { WORDMARK } from "../src/wordmark";
import { describe, expect, it } from "vite-plus/test";
import { Nokia3310Callouts, Nokia3310Sketch } from "../src/sketch";
import { BOUNDS, INK, LINES, SILHOUETTE } from "../src/sketch/drawing";

const render = (props: Parameters<typeof Nokia3310Sketch>[0] = {}) =>
  renderToString(createElement(Nokia3310Sketch, props));

describe("Nokia3310Sketch", () => {
  it("spans the model's height, centred on the stage", () => {
    expect(BOUNDS.height).toBeCloseTo(10);
    expect(BOUNDS.y).toBeCloseTo(-5);
    expect(BOUNDS.x + BOUNDS.width / 2).toBeCloseTo(0, 1);
  });

  it("renders on the server, hidden from assistive tech, outlined, edged and printed", () => {
    const html = render();
    expect(html).toContain('aria-hidden="true"');
    for (const d of [SILHOUETTE, LINES, INK, WORDMARK]) expect(html).toContain(`d="${d}"`);
  });

  it("keeps its SVG ids apart when a page holds two sketches", () => {
    const html = renderToString(
      createElement(
        "div",
        null,
        createElement(Nokia3310Sketch, { wipe: 0.5 }),
        createElement(Nokia3310Sketch, { wipe: 0.5 }),
      ),
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

  it("dimensions the handset in millimetres, unless told not to", () => {
    expect(render()).toContain(">113</text>");
    expect(render()).toContain(">48</text>");
    expect(render({ dimensions: false })).not.toContain(">113</text>");
  });

  it("draws in the ink and on the paper it's given", () => {
    const html = render({ ink: "#123456", paper: "#fedcba" });
    expect(html).toContain('stroke="#123456"');
    expect(html).toContain('fill="#fedcba"');
  });

  it("is gone once the wipe has passed", () => {
    expect(render({ wipe: 1 })).toBe("");
  });

  it("outlines the LCD without filling it", () => {
    expect(render()).not.toMatch(/fill-opacity/);
  });
});

describe("Nokia3310Sketch loading", () => {
  const segments = (html: string) => (html.match(/data-segment/g) ?? []).length;

  it("leaves the LCD blank without progress", () => {
    expect(render()).not.toContain("Loading");
  });

  it("fills the bar with the progress", () => {
    const empty = render({ progress: 0 });
    expect(empty).toContain("Loading");
    expect(segments(empty)).toBe(0);
    expect(segments(render({ progress: 0.5 }))).toBe(5);
    expect(segments(render({ progress: 1 }))).toBe(10);
    expect(segments(render({ progress: 3 }))).toBe(10);
  });
});

describe("Nokia3310Callouts", () => {
  it("labels the parts it points at, and skips parts the drawing doesn't have", () => {
    const html = renderToString(
      createElement(Nokia3310Callouts, {
        callouts: [{ target: "screen", label: "84 × 48 px display" }],
      }),
    );
    expect(html).toContain("84 × 48 px display");
    expect(html).toContain('aria-hidden="true"');
  });
});
