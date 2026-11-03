# hellotimber website

The TanStack Start app composes the homepage firmware (`src/home/firmware.ts`), the section
content records (`src/content/`), the canvas renderer and the 3D handset. The phone stage lives
once in `src/routes/_home.tsx`; each section's page is server-rendered, crawlable and
screen-reader reachable. The stock firmware runs in the emulator at `/exp/nokia-emulator`.

Run from the monorepo root with mise Node 22:

```sh
mise exec -- vp install
mise exec -- vp run website#dev
mise exec -- vp check
mise exec -- vp run -r --no-cache test
mise exec -- vp run website#build
```

If a host shell hook overrides Node, use the absolute `mise which node` executable for
`node_modules/vite-plus/bin/vp`, with its directory first on PATH and `SHELL=/bin/sh`.
On a busy shared machine, `VITEST_MAX_WORKERS=2` limits test contention without changing tests.

## Deployment readiness

No deployment is performed by the plans. After approval to merge and deploy:

1. Content and profile/project URLs are sourced from Lachlan's public GitHub profile and history or supplied directly by him. There is no public email or CV yet.
2. Set `ANTHROPIC_API_KEY` in the Vercel project for live persona replies. Without it, SMS and
   Chat use the recorded canned responses. A live-model reply still needs an environment check.
3. Set `BUILD_HASH` to the deployed revision when building, for a stable per-build IMEI.
4. Build from `main` using the existing Nitro/Vercel integration (`website/vite.config.ts`);
   do not add a `vercel.json`. Verify the project's environment settings before release.
5. Smoke-test standby, each section route, a Contact link, Chat, Snake II, a deep link and
   mobile after deployment.

The homepage phone's EEPROM and persona history persist under `hellotimber.home/…`, the
emulator's under `hellotimber.exp.nokia-emulator/…`. Only master mute belongs to
`hellotimber.settings`. Lights is a
session-only output gate and follows the firmware's timeout when enabled.

The plan 32 record (homepage firmware, section routes, emulator) is in
`docs/plans/32-catalogue-homepage-emulator-and-writing.md`.
