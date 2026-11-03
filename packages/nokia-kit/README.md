# @hellotimber/nokia-kit

The parts a Nokia 3310-style firmware is built from, in three layers:

- `ui`: the stock widgets and their painter (`ui/display/widgets`), the fonts, sprites and
  timelines cropped from the v6.39 goldens (`ui/resources`, generated), text entry and T9
  (`ui/text`), and the sound sequencer.
- `system`: boot, standby, lights, clock and alerts, keyguard, security, the settings registry and
  the call sounds.
- `apps/*`: one module per application (calculator, games).

An app may import its own files, `system` and `ui`; `system` imports `ui`; `ui` imports only
itself, phone-core and phone-screen (`tests/layers.test.ts`). The shared phone state comes from
`@hellotimber/phone-services`. `@hellotimber/nokia-os` composes these parts into the stock v6.39
firmware.

## Usage

Modules are imported by path (`"exports": { "./*": "./src/*.ts" }` plus the directory indexes
`ui/display/widgets`, `ui/resources`, `ui/text`, `ui/text/t9`; TypeScript source, no build):

```ts
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintWidget } from "@hellotimber/nokia-kit/ui/display/widgets";

// Paint one stock screen onto an 84x48 framebuffer.
const fb = new Framebuffer();
paintWidget(fb, { kind: "placeholder", label: "Writing" });

// The English T9 dictionary is its own entry, so a host can load it lazily.
const { englishT9 } = await import("@hellotimber/nokia-kit/t9-english");
console.log(englishT9.size);
```

Never hand-edit `src/**/generated/**`: `@hellotimber/nokia-os`'s generators write them from its
committed goldens (`vp run @hellotimber/nokia-os#regenerate`).

## Tests

`vp run @hellotimber/nokia-kit#test`.
