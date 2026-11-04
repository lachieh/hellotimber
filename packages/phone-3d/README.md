# @hellotimber/phone-3d

A Nokia 3310 as react-three-fiber components — **fully procedural, no model
assets**. The body is a beveled extrusion of the 3310 silhouette; all 17 keys are
individually meshed, pressable, and printed (the original keypad legends redrawn as SVG paths
painted into one atlas); the green backlight lights every key, legend,
and the LCD; the 84×48 canvas-textured screen sits in real bezel geometry.

The package is host-agnostic: you hand it any `HTMLCanvasElement` as the screen
texture source and it reports physical key presses via callback. It knows nothing
about what's on the screen or what the keys mean. There is nothing to serve —
no glTF, no decoders, no static assets.

## Install (outside this repo)

```sh
npm install react react-dom three @react-three/fiber @react-three/drei
# then add this package (peer deps above are required)
```

## Usage

```tsx
import { PhoneStage, type Nokia3310Key } from "@hellotimber/phone-3d";
import { useEffect, useMemo, useState } from "react";

function MyPhone() {
  // Any 84×48 canvas works — drive it however you like
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 84;
    c.height = 48;
    c.getContext("2d")!.fillRect(0, 0, 84, 48);
    return c;
  }, []);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setVersion((v) => v + 1), 100); // after redrawing
    return () => clearInterval(id);
  }, []);

  return (
    <PhoneStage
      className="phone"
      screenCanvas={canvas}
      screenVersion={version}
      onKey={(key: Nokia3310Key, action) => console.log(key, action)}
    />
  );
}
```

`<PhoneStage>` creates its own R3F `<Canvas>` (lights, resize handling, and a light held still
in the world while the device turns, read from its orientation sensor if it has one: the phone
itself stays put on the screen). To compose into an existing scene, render `<Nokia3310 {...props}/>`
inside your own `<Canvas>` instead.

## Server-rendered sketch and the form entrance

`@hellotimber/phone-3d/sketch` exports `<Nokia3310Sketch fit? screenBgColor? ink? paper?
dimensions?/>`: the phone as a technical drawing (an even contour, finer detail lines, shading
lines down its right side, and dimension lines giving its 113 mm height and 48 mm width; line
weights stay in screen pixels at any scale), as pure SVG with no three.js import, so it renders
on the server. `ink` and `paper` set its line and ground colours (the paper hides the 3D phone
beneath it). It is
traced from the model's front view (`vp run @hellotimber/phone-3d#sketch-outline` regenerates
`src/sketch/outline.generated.ts` after a model change) and framed exactly like the stage's flat
phone. Place it absolutely over `<PhoneStage form onFormStart={…}>` (same `fit`) and fade it out
on `onFormStart`: the 3D phone starts flat at the sketch's outline and leaps out of it over
`FORM_MS`.

To stage the entrance yourself, pass `<PhoneStage pose={() => …}>`: it reads a `FormPose`
(`depth`, `lift`, `spread`, `tiltX`, `tiltY`, `settled`) every frame instead of `formPose`
(exported, so a host can delay or re-time it). The sketch's `wipe` (0–1) turns it into the phone
beneath, top to bottom: a fine rule sweeps down across the figure, the drawing gone above it.

`<Nokia3310Callouts fit? callouts={[{ target: "screen", label: "Display" }]}/>` draws leader
lines from parts of the front view (`CalloutTarget`) to labels beside the phone, framed like the
sketch so they point at the formed 3D phone. `HANDSET` gives the real handset's size and weight.

## Props (`Nokia3310Props`)

| Prop            | Type                                                  | Required | Notes                                                               |
| --------------- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `screenCanvas`  | `HTMLCanvasElement`                                   | yes      | Texture source; native 84×48 recommended (NearestFilter upscales)   |
| `screenVersion` | `number`                                              | yes      | Bump after drawing — triggers a texture re-upload on the next frame |
| `onKey`         | `(key: Nokia3310Key, action: "down" \| "up") => void` | no       | Fired by pointer interaction with the key meshes (see below)        |
| `backlightOn`   | `boolean`                                             | no       | The display LEDs. Default `true`; off = dim LCD, no green glow      |
| `keypadLightOn` | `boolean`                                             | no       | The keypad LEDs (legend + NaviKey glow). Default: `backlightOn`     |
| `pressedKeys`   | `ReadonlySet<Nokia3310Key>`                           | no       | Visually depress keys from outside (e.g. keyboard input)            |
| `screenBgColor` | `string`                                              | no       | The LCD's background; pass your screen renderer's background color  |

Mouse and pen presses fire `"down"` at once. A touch may be the start of a page scroll
(hosts can set `touch-action: pan-y` on the canvas), so its `"down"` waits until the
finger has rested about 110 ms within 10 px, or lifts; a touch that moves further or is
cancelled by the browser first fires nothing. Every `"down"` is followed by one `"up"`.

The LCD is drawn the way an early backlit monochrome panel looks: the
background is `screenBgColor` lit from three LEDs along the top edge (a
top-down gradient with three soft hotspots; flat and dim when
`backlightOn` is off), and the canvas's ink pixels (those farther from
`screenBgColor` than half the farthest colour's distance) float just above it
with a soft drop shadow. The canvas's background pixels are never drawn, so
`screenBgColor` must match the background your renderer paints.

The real phone drives its two LED lines separately (the keypad stays dark under
keyguard while the display lights). A host maps its light events to the two
props; a host that passes only `backlightOn` gets a keypad that follows it.

`PhoneStage` additionally accepts `className` (applied to the canvas wrapper div —
size it with CSS; the canvas tracks its container). With `fit` (0–1), the camera moves so the phone, centred,
at rest spans that fraction of the canvas's limiting side; without it
the camera keeps its fixed distance.

`Nokia3310Key` is `"power" | "navi" | "c" | "up" | "down" | "0"–"9" | "*" | "#"`.
The power target doubles as the earpiece grille on the front face (the real
button lives on the phone's top edge).

## Demo

```sh
vp install
cd packages/phone-3d && vp dev
```

Test pattern screen, key-press log, display and keypad light toggles. Hold a digit key on your
keyboard to see `pressedKeys` depress the 3D keys.

## Tests

```sh
vp run @hellotimber/phone-3d#test
```

Pure logic only (layout geometry invariants, legend atlas, key union, materials,
the backlight lightmap, the ink and shadow masks, the pointer press gesture)
— 3D rendering is verified through the demo, since jsdom has no WebGL.
