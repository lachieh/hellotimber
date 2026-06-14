# @hellotimber/phone-3d

A Nokia 3310 as react-three-fiber components: a realistic glTF model, 17 pressable
keys (transparent raycast hotspots over the fused keypad), an 84×48 canvas-textured
screen overlaid on the model's screen face, and a green backlight.

The package is host-agnostic: you hand it any `HTMLCanvasElement` as the screen
texture source and it reports physical key presses via callback. It knows nothing
about what's on the screen or what the keys mean.

## Model asset (required)

The component loads a Draco-compressed glTF model that the **host must serve as a
static asset**. By default it fetches `/models/nokia-3310.glb` and the Draco decoder
from `/draco/` — override with the `modelUrl` / `dracoPath` props. This package ships
a copy of both under `public/` for its own demo; a host app should copy
`public/models/nokia-3310.glb` and `public/draco/*` into its own served `public/`
(or point the props at wherever it serves them).

**Model credit:** "Nokia 3310 Retro Electronics Challenge" by shaderbytes
(Sketchfab), used under the Sketchfab Standard License (commercial use, no
attribution required — credited here as good practice). Optimized for the web with
`gltf-transform` (Draco geometry + WebP textures, ~142 KB).

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

`<PhoneStage>` creates its own R3F `<Canvas>` (lights, resize handling, idle sway,
pointer tilt). To compose into an existing scene, render `<Nokia3310 {...props}/>`
inside your own `<Canvas>` instead.

## Props (`Nokia3310Props`)

| Prop            | Type                                                  | Required | Notes                                                               |
| --------------- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `screenCanvas`  | `HTMLCanvasElement`                                   | yes      | Texture source; native 84×48 recommended (NearestFilter upscales)   |
| `screenVersion` | `number`                                              | yes      | Bump after drawing — triggers a texture re-upload on the next frame |
| `onKey`         | `(key: Nokia3310Key, action: "down" \| "up") => void` | no       | Fired by pointer interaction with key meshes                        |
| `backlightOn`   | `boolean`                                             | no       | Default `true`; off dims the screen and kills the green glow        |
| `pressedKeys`   | `ReadonlySet<Nokia3310Key>`                           | no       | Visually depress keys from outside (e.g. keyboard input)            |

`PhoneStage` additionally accepts `className` (applied to the canvas wrapper div —
size it with CSS; the canvas tracks its container).

`Nokia3310Key` is `"power" | "navi" | "c" | "up" | "down" | "0"–"9" | "*" | "#"`.

## Demo

```sh
vp install
cd packages/phone-3d && vp dev
```

Test pattern screen, key-press log, backlight toggle. Hold a digit key on your
keyboard to see `pressedKeys` in action.

## Tests

```sh
vp run @hellotimber/phone-3d#test
```

Pure logic only (layout table, key union, materials) — 3D rendering is verified
through the demo, since jsdom has no WebGL.
