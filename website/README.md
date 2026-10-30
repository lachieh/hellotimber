# hellotimber website

The TanStack Start app composes the stock Nokia firmware, portfolio SIM, canvas renderer
and 3D handset. The phone stage lives once in `src/routes/_phone.tsx`; route panels remain
server-rendered, crawlable and screen-reader reachable.

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

No deployment is performed by plan 31. After approval to merge and deploy:

1. Confirm the deployed build includes plan 31's toolkit-call handoff; project links now
   use the same telephone/network port as phone-book links.
2. Content and profile/project URLs are sourced from Lachlan's public GitHub profile and history or supplied directly by him. There is no public email or CV yet.
3. Set `ANTHROPIC_API_KEY` in the Vercel project for live persona replies. Without it, SMS and
   Chat use the recorded canned responses. A live-model reply still needs an environment check.
4. Set `BUILD_HASH` to the deployed revision when building, for a stable per-build IMEI.
5. Build from `main` using the existing Nitro/Vercel integration (`website/vite.config.ts`);
   do not add a `vercel.json`. Verify the project's environment settings before release.
6. Smoke-test standby, a contact call, SMS/Chat, a deep link and mobile after deployment.

Browser EEPROM persists under `nokia-os/…`. Only master mute belongs to
`hellotimber.settings`; persona history belongs to `hellotimber.threads`. Lights is a
session-only output gate and follows the firmware's timeout when enabled.

The full QA record, screenshots, known deep-boot messaging limitation and plan 18c follow-ups
are in `docs/plans/31-portfolio-on-stock-firmware.md`.
