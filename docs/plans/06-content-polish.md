# Plan 06 — Content & polish: portfolio content, sound, SEO, easter eggs, launch

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task. If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** plan 05 is **done** (routes, bridge, persistent stage, keyboard input, snake registered). Verify before starting: `website/src/phone/phone.ts` exports `getPhoneRuntime()`, `website/src/content/index.ts` exports `content`, `website/src/components/ContentPanel.tsx` exists, and the routes under `website/src/routes/_phone/` match plan 05's "Files at completion". If any is missing, STOP and report. Plan 04's `@hellotimber/snake` is assumed wired (plan 05 Task 9).

**Goal:** Turn the working shell into a launchable portfolio: a structured content model (single source for handset menus AND HTML panels — VISION's no-drift guarantee), WebAudio sound (key beeps + the Nokia tune), working Settings (keypad tones, backlight, welcome note), SEO/meta (per-route titles, sitemap.xml, JSON-LD), easter eggs (SIM-services 404, screensaver, `*#06#` IMEI), accessibility (aria-live LCD mirror, reduced motion), performance verification, CI, and an explicit content-handoff checklist. **All copy in this plan is fenced SAMPLE DATA** — obviously fake (e.g. "Acme Pixel Co.") — and the final task enumerates every field Lachlan must replace.

## Architecture

```
website/src/content/            the content model — ONE source of truth
  types.ts                      rich section types (ContactEntry, Role, …)
  phonebook.ts … divert.ts      one module per section, all SAMPLE DATA
  index.ts                      nokiaContent(): Nokia3310Content adapter
        │
        ├──▶ phone.ts  createPhone({ menu: withWorkingSettings(nokia3310Menu(content)) })
        └──▶ routes/_phone/**   panels render the SAME section modules as HTML

website/src/settings.ts         observable store ⇄ localStorage 'hellotimber.settings'
website/src/phone/audio.ts      WebAudio singleton (lazy, gesture-created)
website/src/phone/composer.ts   spec §8 composer-notation parser + the Nokia tune
website/src/phone/tones.ts      tone data (id/label/notation) — no WebAudio import
website/src/phone/apps/picker-app.ts   generic option-picker PhoneApp (settings/tones)
website/src/phone/screen-text.ts       ScreenModel → text for the aria-live mirror
website/src/phone/pixel-art.ts         string-art → Bitmap (screensaver frame)
website/src/seo.ts              pageHead() helper + SITEMAP_PATHS
website/src/routes/sitemap[.]xml.ts    server route serving the sitemap
.github/workflows/ci.yml        mise + vp install + vp run ready
```

Sound flow: phone-core emits `sound {kind:'key', id:'beep'}` on every key-down (plan 01 Task 9) → `phone.on("sound", handleSound)` → beep iff `settings.keypadTones && !settings.muted`. Tone previews go through the same `handleSound({kind:'tone', id})` entry point, called by the website-registered Tones picker app. Settings flow: handset picker/editor apps and HTML panel controls both call `updateSettings()`; `useSettings()` (useSyncExternalStore) drives React (backlight prop, panel state); the runtime reads `getSettings()` directly.

## Tech stack

Everything is already installed (plan 05): TanStack Start 1.168 / Router 1.170, React 19.2, Tailwind 4, three via catalog. This plan adds **zero new dependencies**. WebAudio is browser-native. Tests: Vitest via `vp test`, imports from **`vite-plus/test`** only; node env by default, `// @vitest-environment jsdom` per-file where DOM is needed.

## Files at completion

```
.github/workflows/ci.yml            NEW    (Task 10)
website/
├── public/
│   ├── favicon.svg                 NEW    green-pixel phone glyph
│   ├── manifest.json               rewritten
│   └── robots.txt                  + Sitemap line
├── src/
│   ├── content/
│   │   ├── types.ts                NEW    section types
│   │   ├── site.ts                 NEW    SiteMeta (canonical URL, name, …)
│   │   ├── phonebook.ts            NEW    contacts (email/GitHub/LinkedIn/CV)
│   │   ├── messages.ts             NEW    inbox SMS + write-message config
│   │   ├── chat.ts                 NEW    testimonials as chat lines
│   │   ├── call-register.ts        NEW    roles / projects / missed
│   │   ├── reminders.ts            NEW    "now" items
│   │   ├── clock.ts                NEW    timezone + availability
│   │   ├── profiles.ts             NEW    visitor modes (stretch stub)
│   │   ├── divert.ts               NEW    external profile links
│   │   └── index.ts                rewritten — adapter + re-exports
│   ├── settings.ts                 NEW    store ⇄ localStorage
│   ├── seo.ts                      NEW    pageHead() + SITEMAP_PATHS
│   ├── global.d.ts                 NEW    __BUILD_HASH__ declaration
│   ├── styles.css                  + focus/mobile/sr-only rules
│   ├── components/
│   │   └── SoundToggle.tsx         NEW    global mute button
│   ├── phone/
│   │   ├── phone.ts                rewritten — sound, settings menu, input(),
│   │   │                           screensaver, IMEI, reduced-motion boot
│   │   ├── audio.ts                NEW
│   │   ├── composer.ts             NEW
│   │   ├── tones.ts                NEW
│   │   ├── screen-text.ts          NEW
│   │   ├── pixel-art.ts            NEW
│   │   ├── keyboard.ts             modified — routes through runtime.input()
│   │   ├── PhoneStageHost.tsx      modified — backlight prop, runtime.input()
│   │   └── apps/picker-app.ts      NEW
│   └── routes/
│       ├── __root.tsx              modified — meta/description/icons
│       ├── sitemap[.]xml.ts        NEW    server route
│       ├── _phone.tsx              modified — ScreenMirror + SoundToggle
│       └── _phone/**               panels rewritten + head() per route
└── tests/
    ├── content.test.ts             NEW
    ├── settings.test.ts            NEW
    ├── composer.test.ts            NEW
    ├── picker-app.test.ts          NEW
    ├── pixel-art.test.ts           NEW
    └── screen-text.test.ts         NEW
docs/plans/README.md                status updated (Task 11)
```

## Contract deviations / assumptions

Deviations from VISION.md / plans 01–05, and interpretations of points they leave open (flag if any is wrong):

1. **Plan 05 completeness.** This plan assumes plan 05 shipped its full "Files at completion" set, including `website/src/phone/keyboard.ts` and the snake app registration in `phone.ts` (the plan-05 draft in this repo currently ends at its Task 7; its header promises keyboard + snake in Tasks 8–9). If `keyboard.ts` or the snake registration is absent when this plan executes, STOP and report before Tasks 5 and 7.
2. **Host-side menu patching is not a contract change.** `nokia3310Menu(content)` returns plain `MenuNode[]` data; the website replaces specific stub children (`tones/ringing-tone`, `tones/keypad-tones`, `tones/screen-saver`, `settings/phone-settings`) with `app`/`submenu` nodes **with the same ids**, so every path stays stable. phone-core is not modified.
3. **App→audio channel.** `AppFactory` ctx exposes only `exit()`; phone-core has no way for an app to emit a `sound` event. The phone's `sound` event therefore carries key beeps only; ringtone previews call the website's `handleSound({kind:'tone', id})` directly from the picker app — same payload shape, same audio path, no contract change.
4. **`editorApp(opts)`** is `{ title, onAccept?(text) }` per plan 01 Task 12. It has no initial-text option, so the Welcome note editor starts blank each time (accepted; the saved note is shown in the Settings panel).
5. **Welcome note applies from the next boot.** `welcomeText` is a `createScreenRenderer` construction opt (plan 02 deviation 1) and the renderer lives for the session. Saved welcome text is passed at runtime creation, i.e. it shows on the next page load — which is when boot happens anyway. Accepted.
6. **phone-3d reduced-motion gate is a package-internal edit.** The `PhoneStage` contract has no motion prop; Task 8 gates the idle sway inside phone-3d on `prefers-reduced-motion` (no API change; plan 03's file layout is unknown at time of writing, so that step locates the sway code by search and includes a STOP rule).
7. **Keyguard is not implemented by plan 01** (no keyguard task exists there). The keyguard hint panel copy ships only if a manual check shows `Menu` then `*` actually locks; otherwise the hint line is omitted (explicit verify-then-include step in Task 7).
8. **Server-route API assumption.** Installed `@tanstack/react-start` 1.168 is post-1.0, where server handlers live on regular file routes: `createFileRoute(...)({ server: { handlers: { GET } } })`. If `generate-routes`/typecheck rejects this shape, fall back to `createServerFileRoute().methods({ GET })` from `@tanstack/react-start/server` and report the drift.
9. **404 behavior.** The catch-all (`_phone/$.tsx`) steers the handset to `menu/sim-services` when the URL was shape-invalid; the bridge then rewrites the address bar to `/menu/sim-services`. Accepted — VISION names SIM services as the 404 experience. The catch-all carries `robots: noindex` meta and is excluded from the sitemap.
10. **Input funnel refactor.** Plan 05 wires `PhoneStageHost`/`keyboard.ts` straight to `phone.send()`. Task 7 reroutes both through `runtime.input()` (needed for `*#06#` detection and screensaver idle tracking). This modifies plan-05 files; behavior is unchanged for normal keys.
11. **Keypad tones are On/Off**, not the spec's best-guess `Off/Level 1–3` (spec §8 marks the level list UNVERIFIED; VISION's Settings row says "keypad tones" as a site setting). Flagged simplification.
12. **`vp run ready`** already exists as a root script (`vp check && vp run -r test && vp run -r build`) and is the launch gate plus the CI command.
13. **Deployment target is the one allowed open decision** (VISION "Assumptions"): Task 10 enumerates options and stops at "DECISION REQUIRED".
14. **Sample-data rule:** every fabricated value is annotated `// SAMPLE DATA — replace with real copy` and is obviously fake (Acme Pixel Co., example.com handles, `hellotimber.example` origin) so nothing fake can pass as real. Task 11 is the exhaustive replacement checklist.

## Conventions for every task

- All paths repo-relative. Integration code lives **only** in `website/src/` (AGENTS.md rule 5); Task 8 contains this plan's single, flagged phone-3d edit.
- Commands (repo root): test `mise exec -- vp run website#test` · build `mise exec -- vp run website#build` · dev `mise exec -- vp run website#dev` · route regen `mise exec -- vp run website#generate-routes` · lint/typecheck `mise exec -- vp check --fix` · full gate `mise exec -- vp run ready`.
- Tests import from `vite-plus/test`, never `vitest`. Website tests live in `website/tests/`.
- **Never edit `website/src/routeTree.gen.ts` by hand.**
- The pre-commit hook runs `vp check --fix`; if it rewrites files, `git add` and commit again.
- String-art convention: `#` = set pixel, `.` = clear (matches plan 02).

---

### Task 1: Content model — types, section modules, adapter

Replace plan 05's single sample blob with a structured model: one typed module per section, an adapter that produces phone-core's `Nokia3310Content`, and tests that pin the structural rules (SMS ≤160 chars, kebab ids, valid hrefs, sitemap paths reachable). The existing export `content` keeps its name and type so `phone.ts` keeps compiling untouched in this task.

**Files**

- Create: `website/src/content/types.ts`
- Create: `website/src/content/site.ts`
- Create: `website/src/content/phonebook.ts`
- Create: `website/src/content/messages.ts`
- Create: `website/src/content/chat.ts`
- Create: `website/src/content/call-register.ts`
- Create: `website/src/content/reminders.ts`
- Create: `website/src/content/clock.ts`
- Create: `website/src/content/profiles.ts`
- Create: `website/src/content/divert.ts`
- Rewrite: `website/src/content/index.ts`
- Test: `website/tests/content.test.ts`

**Steps**

- [ ] **Step 1: Write `website/src/content/types.ts`:**

  ```ts
  /**
   * The portfolio content model. STRUCTURE is final; the values in the section
   * modules are SAMPLE DATA until Lachlan supplies real copy (see Task 11).
   */

  /** Phone book entry: contact card on the handset, <address> link in HTML. */
  export interface ContactEntry {
    id: string; // kebab-case, stable — doubles as the phone list-item id
    label: string; // "Email", "GitHub", …
    value: string; // human-readable: "lachlan@…", "github.com/…"
    href: string; // mailto:/https:/site-relative link target
    rel?: string; // extra rel tokens for the HTML link, e.g. "me"
    download?: boolean; // true for the CV download
  }

  /** Messages → Inbox: a short about-me "SMS". */
  export interface SmsMessage {
    id: string;
    label: string; // sender/subject line in the handset list
    text: string; // body — MUST be ≤160 chars (tested)
    timestamp: string; // ISO 8601, rendered with <time>
  }

  /** Messages → Write messages: where the multi-tap contact form delivers. */
  export interface WriteMessageConfig {
    destinationEmail: string;
    subject: string;
  }

  /** Chat (Menu 3): one testimonial line. '>' them, '<' Lachlan. */
  export interface ChatMessage {
    who: "them" | "me";
    nickname: string; // the 3310 chat name
    text: string;
  }

  /** Call register → Received calls: a role held. */
  export interface Role {
    id: string;
    org: string;
    title: string;
    period: string; // human-readable, e.g. "2022–2024"
    periodStart: string; // ISO for <time dateTime>, e.g. "2022-03"
    summary: string;
  }

  /** Call register → Dialled numbers: a project shipped. */
  export interface Project {
    id: string;
    name: string;
    url?: string;
    blurb: string;
    year: string;
  }

  /** Call register → Missed calls: playful "ones that got away". */
  export interface MissedCall {
    id: string;
    label: string;
    note: string;
  }

  /** Reminders (Menu 10): a "now" item. */
  export interface NowItem {
    id: string;
    label: string;
    detail: string;
  }

  /** Clock (Menu 11). */
  export interface ClockInfo {
    timeZone: string; // IANA, e.g. "Australia/Brisbane"
    availability: string; // one line
  }

  /** Profiles (Menu 12) — visitor modes, stretch; copy only for now. */
  export interface ProfileMode {
    id: string;
    label: string;
    description: string;
  }

  /** Call divert (Menu 7): literal external redirect. */
  export interface DivertLink {
    id: string;
    label: string;
    href: string;
  }

  /** Site-wide metadata for SEO/JSON-LD. */
  export interface SiteMeta {
    url: string; // canonical origin, NO trailing slash
    name: string;
    jobTitle: string;
    description: string; // default meta description
  }
  ```

- [ ] **Step 2: Write `website/src/content/site.ts`:**

  ```ts
  import type { SiteMeta } from "./types";

  export const site: SiteMeta = {
    url: "https://hellotimber.example", // SAMPLE DATA — replace with real copy (the deployed origin)
    name: "Lachlan Heywood",
    jobTitle: "Software Engineer", // SAMPLE DATA — replace with real copy
    description:
      "Lachlan Heywood's portfolio: a working Nokia 3310 in three.js. Every menu on the phone is a page on the site.", // SAMPLE DATA — replace with real copy
  };
  ```

- [ ] **Step 3: Write `website/src/content/phonebook.ts`:**

  ```ts
  import type { ContactEntry } from "./types";

  export const phonebook: ContactEntry[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "email",
      label: "Email",
      value: "lachlan@example.com",
      href: "mailto:lachlan@example.com",
    },
    {
      id: "github",
      label: "GitHub",
      value: "github.com/example-handle",
      href: "https://github.com/example-handle",
      rel: "me",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      value: "linkedin.com/in/example-handle",
      href: "https://www.linkedin.com/in/example-handle",
      rel: "me",
    },
    {
      id: "cv",
      label: "CV",
      value: "Download CV (PDF)",
      href: "/cv.pdf", // file to be provided — see Task 11 handoff
      download: true,
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 4: Write `website/src/content/messages.ts`** (3–5 inbox SMS, each ≤160 chars — the test enforces both):

  ```ts
  import type { SmsMessage, WriteMessageConfig } from "./types";

  export const inbox: SmsMessage[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "hello",
      label: "Hello!",
      text: "Hi, I'm Lachlan. I build software for the web — and, apparently, phones. This whole site is a working Nokia 3310.",
      timestamp: "2000-09-01T09:03:00Z",
    },
    {
      id: "stack",
      label: "What I use",
      text: "Daily drivers: TypeScript, React, three.js, and an 84x48 pixel grid. I like hard boundaries and small packages.",
      timestamp: "2000-09-01T09:05:00Z",
    },
    {
      id: "work",
      label: "Work",
      text: "Currently at Acme Pixel Co. Before that: Globex Web Ltd. Full history under Call register.",
      timestamp: "2000-09-01T09:08:00Z",
    },
    {
      id: "say-hi",
      label: "Say hi",
      text: "Want to talk? Write messages sends me a real SMS-style note, or just email lachlan@example.com.",
      timestamp: "2000-09-01T09:12:00Z",
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];

  export const writeMessage: WriteMessageConfig = {
    destinationEmail: "lachlan@example.com", // SAMPLE DATA — replace with real copy
    subject: "Message from hellotimber", // SAMPLE DATA — replace with real copy
  };
  ```

- [ ] **Step 5: Write `website/src/content/chat.ts`:**

  ```ts
  import type { ChatMessage } from "./types";

  export const chatMessages: ChatMessage[] = [
    // SAMPLE DATA — replace with real copy (testimonials, with permission) ───
    { who: "them", nickname: "CTO@Acme", text: "Lachlan shipped the impossible. Twice." },
    { who: "me", nickname: "Lachlan", text: "The second one was easier." },
    {
      who: "them",
      nickname: "PM@Globex",
      text: "Writes code AND tickets. Would staff again, 10/10.",
    },
    {
      who: "them",
      nickname: "CTO@Acme",
      text: "Also he made our build 4 minutes faster and never mentioned it.",
    },
    { who: "me", nickname: "Lachlan", text: "I'm mentioning it now." },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 6: Write `website/src/content/call-register.ts`:**

  ```ts
  import type { MissedCall, Project, Role } from "./types";

  export const roles: Role[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "acme-pixel",
      org: "Acme Pixel Co.",
      title: "Senior Software Engineer",
      period: "2022–now",
      periodStart: "2022-03",
      summary: "Led the imaginary platform team. Shipped imaginary things at scale.",
    },
    {
      id: "globex-web",
      org: "Globex Web Ltd.",
      title: "Full-stack Engineer",
      period: "2019–2022",
      periodStart: "2019-01",
      summary: "Built the fictional checkout, twice, the second time correctly.",
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];

  export const projects: Project[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "this-site",
      name: "hellotimber",
      url: "https://github.com/example-handle/hellotimber",
      blurb: "A Nokia 3310 that is also a website. You are holding it.",
      year: "2026",
    },
    {
      id: "project-x",
      name: "Project X",
      url: "https://example.com/project-x",
      blurb: "A made-up data pipeline that processed made-up terabytes.",
      year: "2024",
    },
    {
      id: "tool-y",
      name: "tool-y",
      blurb: "A fictional CLI with 12 imaginary GitHub stars.",
      year: "2023",
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];

  export const missedCalls: MissedCall[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "rockstar",
      label: "Rockstar role 2018",
      note: "They wanted a ninja. I am at best a polite gardener.",
    },
    { id: "crypto", label: "That crypto startup", note: "Missed on purpose. No regrets." },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 7: Write `website/src/content/reminders.ts`:**

  ```ts
  import type { NowItem } from "./types";

  export const nowItems: NowItem[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    { id: "learning", label: "Learning", detail: "three.js internals and 5x7 pixel typography." },
    { id: "building", label: "Building", detail: "This phone. Snake high score: also mine." },
    {
      id: "reading",
      label: "Reading",
      detail: "The Nokia 3310 user guide, document 9357246, unironically.",
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 8: Write `website/src/content/clock.ts`:**

  ```ts
  import type { ClockInfo } from "./types";

  export const clock: ClockInfo = {
    timeZone: "Australia/Brisbane", // SAMPLE DATA — replace with real copy
    availability: "Generally reachable 9–5 AEST; email lands anytime.", // SAMPLE DATA — replace with real copy
  };
  ```

- [ ] **Step 9: Write `website/src/content/profiles.ts`** (stretch stub — copy only, no behavior):

  ```ts
  import type { ProfileMode } from "./types";

  /** Visitor modes are a VISION stretch goal; only the copy ships for now. */
  export const profileModes: ProfileMode[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    {
      id: "general",
      label: "General",
      description: "The default profile. Everything in original menu order.",
    },
    {
      id: "recruiter",
      label: "Recruiter",
      description: "(Stretch) Would foreground Call register and the CV.",
    },
    {
      id: "engineer",
      label: "Engineer",
      description: "(Stretch) Would foreground projects and this codebase.",
    },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 10: Write `website/src/content/divert.ts`:**

  ```ts
  import type { DivertLink } from "./types";

  export const diverts: DivertLink[] = [
    // SAMPLE DATA — replace with real copy ───────────────────────────────────
    { id: "github", label: "GitHub", href: "https://github.com/example-handle" },
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/example-handle" },
    { id: "x", label: "X", href: "https://x.com/example-handle" },
    // ── end SAMPLE DATA ──────────────────────────────────────────────────────
  ];
  ```

- [ ] **Step 11: Rewrite `website/src/content/index.ts`** — the adapter. The exported name and type of `content` are unchanged from plan 05, so `phone.ts` and the existing panels keep compiling:

  ```ts
  import type { ChatLine, Nokia3310Content } from "@hellotimber/phone-core";
  import { missedCalls, projects, roles } from "./call-register";
  import { chatMessages } from "./chat";
  import { clock } from "./clock";
  import { diverts } from "./divert";
  import { inbox, writeMessage } from "./messages";
  import { phonebook } from "./phonebook";
  import { profileModes } from "./profiles";
  import { nowItems } from "./reminders";
  import { site } from "./site";

  export type * from "./types";
  export {
    chatMessages,
    clock,
    diverts,
    inbox,
    missedCalls,
    nowItems,
    phonebook,
    profileModes,
    projects,
    roles,
    site,
    writeMessage,
  };

  /**
   * Adapter: the rich section modules → phone-core's Nokia3310Content.
   * This is the no-drift seam (VISION): nokia3310Menu(content) builds the
   * handset menus from EXACTLY the data the HTML panels render.
   */
  export function nokiaContent(): Nokia3310Content {
    return {
      phonebook: phonebook.map((c) => ({
        id: c.id,
        label: c.label,
        body: `${c.label}: ${c.value}`,
      })),
      inbox: inbox.map((m) => ({ id: m.id, label: m.label, body: m.text })),
      chat: chatMessages.map((m): ChatLine => ({ who: m.who, text: `${m.nickname}: ${m.text}` })),
      missedCalls: missedCalls.map((m) => ({ id: m.id, label: m.label, body: m.note })),
      receivedCalls: roles.map((r) => ({
        id: r.id,
        label: `${r.org} ${r.period}`,
        body: `${r.title}. ${r.summary}`,
      })),
      dialledNumbers: projects.map((p) => ({
        id: p.id,
        label: p.name,
        body: `${p.blurb} (${p.year})`,
      })),
      diverts: diverts.map((d) => ({ id: d.id, label: d.label, href: d.href })),
      reminders: nowItems.map((n) => ({ id: n.id, label: n.label, body: n.detail })),
      clockNote: `${clock.availability} (${clock.timeZone})`,
      // ringtones omitted: nokia3310Menu's defaults ("Nokia tune", "Ring ring",
      // "Grande valse") match the tone ids Task 4 ships.
    };
  }

  /** The one object both the handset menu and the HTML panels are built from. */
  export const content: Nokia3310Content = nokiaContent();
  ```

- [ ] **Step 12: Write the test** `website/tests/content.test.ts`:

  ```ts
  import { isValidPath, nokia3310Menu } from "@hellotimber/phone-core";
  import { describe, expect, it } from "vite-plus/test";
  import { content } from "../src/content";
  import { missedCalls, projects, roles } from "../src/content/call-register";
  import { diverts } from "../src/content/divert";
  import { inbox } from "../src/content/messages";
  import { phonebook } from "../src/content/phonebook";
  import { nowItems } from "../src/content/reminders";
  import { site } from "../src/content/site";

  const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  function ids(section: { id: string }[]): string[] {
    return section.map((s) => s.id);
  }

  describe("content model", () => {
    it("inbox is 3–5 SMS, each ≤160 chars with a parseable timestamp", () => {
      expect(inbox.length).toBeGreaterThanOrEqual(3);
      expect(inbox.length).toBeLessThanOrEqual(5);
      for (const m of inbox) {
        expect(m.text.length, m.id).toBeLessThanOrEqual(160);
        expect(Number.isFinite(Date.parse(m.timestamp)), m.id).toBe(true);
      }
    });

    it("every id is kebab-case and unique within its section", () => {
      for (const section of [phonebook, inbox, roles, projects, missedCalls, nowItems, diverts]) {
        const sectionIds = ids(section);
        expect(new Set(sectionIds).size).toBe(sectionIds.length);
        for (const id of sectionIds) expect(id).toMatch(KEBAB);
      }
    });

    it("every link target is mailto:, https://, or site-relative", () => {
      const hrefs = [...phonebook.map((c) => c.href), ...diverts.map((d) => d.href)];
      for (const href of hrefs) {
        expect(/^(mailto:|https:\/\/|\/)/.test(href), href).toBe(true);
      }
    });

    it("site.url is a bare https origin (no trailing slash)", () => {
      expect(site.url).toMatch(/^https:\/\/[^/]+$/);
    });

    it("the adapted content builds a menu where every sitemap path resolves", () => {
      const menu = nokia3310Menu(content);
      const required = [
        "menu/phone-book",
        "menu/phone-book/search",
        "menu/messages/inbox",
        "menu/messages/write",
        "menu/chat",
        "menu/call-register/received-calls",
        "menu/call-register/dialled-numbers",
        "menu/call-register/missed-calls",
        "menu/tones",
        "menu/settings",
        "menu/call-divert",
        "menu/games/snake",
        "menu/calculator",
        "menu/reminders",
        "menu/clock",
        "menu/profiles",
        "menu/sim-services",
      ];
      for (const path of required) expect(isValidPath(menu, path), path).toBe(true);
    });
  });
  ```

- [ ] **Step 13: Run & expect PASS:** `mise exec -- vp run website#test` (the old `content/index.ts` shape is gone; if any plan-05 file imported a removed name, fix the import — only `content` was public).
- [ ] **Step 14: Gates:** `mise exec -- vp check --fix` and `mise exec -- vp run website#build`.
- [ ] **Step 15: Commit:**

  ```sh
  git add website/src/content website/tests/content.test.ts
  git commit -m "feat(website): structured content model with fenced sample data"
  ```

---

### Task 2: Real panels — semantic HTML for every content section

Rewrite the plan-05 placeholder panels against the rich section modules: `<address>`, `<dl>`, `<time>`, external links with `rel="me noopener noreferrer"`. Tones/Settings panels are rewritten in Tasks 4–5 (they need audio/settings); games/calculator/sim-services/menu panels from plan 05 stay.

**Files**

- Rewrite: `website/src/routes/_phone/index.tsx`
- Rewrite: `website/src/routes/_phone/menu/phone-book.tsx`
- Rewrite: `website/src/routes/_phone/menu/messages/index.tsx`
- Rewrite: `website/src/routes/_phone/menu/messages/inbox.tsx`
- Rewrite: `website/src/routes/_phone/menu/messages/write.tsx`
- Rewrite: `website/src/routes/_phone/menu/chat.tsx`
- Rewrite: `website/src/routes/_phone/menu/call-register.tsx`
- Rewrite: `website/src/routes/_phone/menu/reminders.tsx`
- Rewrite: `website/src/routes/_phone/menu/clock.tsx`
- Rewrite: `website/src/routes/_phone/menu/call-divert.tsx`
- Rewrite: `website/src/routes/_phone/menu/profiles.tsx`

**Steps**

- [ ] **Step 1: Rewrite `website/src/routes/_phone/index.tsx`** (standby — the bio):

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/")({ component: StandbyPanel });

  function StandbyPanel() {
    return (
      <ContentPanel title="Lachlan Heywood">
        {/* SAMPLE DATA — replace with real copy (the bio) */}
        <p>
          Software engineer at Acme Pixel Co. (which is not a real company — this paragraph is a
          placeholder for Lachlan's real bio). I build web things with hard package boundaries and a
          soft spot for 84×48 displays.
        </p>
        {/* end SAMPLE DATA */}
        <p>
          This portfolio is a working Nokia 3310. Every menu on the phone is a page on this site,
          and every page is a menu on the phone. Start at the <Link to="/menu">menu</Link>, or drive
          the handset directly: arrow keys scroll, Enter is the NaviKey, Backspace is C.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 2: Rewrite `website/src/routes/_phone/menu/phone-book.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { phonebook } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/phone-book")({ component: PhoneBookPanel });

  function PhoneBookPanel() {
    return (
      <ContentPanel title="Phone book">
        <p>Contact details — the same entries the handset shows under Search.</p>
        <address className="not-italic">
          <ul>
            {phonebook.map((c) => {
              const external = c.href.startsWith("https://");
              return (
                <li key={c.id}>
                  <strong>{c.label}</strong>
                  {" — "}
                  <a
                    href={c.href}
                    {...(external && {
                      target: "_blank",
                      rel: c.rel ? `${c.rel} noopener noreferrer` : "noopener noreferrer",
                    })}
                    {...(c.download && { download: true })}
                  >
                    {c.value}
                  </a>
                </li>
              );
            })}
          </ul>
        </address>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 3: Rewrite `website/src/routes/_phone/menu/messages/index.tsx`:**

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";
  import { inbox } from "../../../../content";

  export const Route = createFileRoute("/_phone/menu/messages/")({ component: MessagesPanel });

  function MessagesPanel() {
    return (
      <ContentPanel title="Messages">
        <p>About me, delivered as SMS.</p>
        <ul>
          <li>
            <Link to="/menu/messages/inbox">Inbox</Link> — {inbox.length} short messages about me.
          </li>
          <li>
            <Link to="/menu/messages/write">Write messages</Link> — send me one, multi-tap and all.
          </li>
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 4: Rewrite `website/src/routes/_phone/menu/messages/inbox.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";
  import { inbox } from "../../../../content";

  export const Route = createFileRoute("/_phone/menu/messages/inbox")({ component: InboxPanel });

  function InboxPanel() {
    return (
      <ContentPanel title="Inbox">
        <ol>
          {inbox.map((m) => (
            <li key={m.id}>
              <p>
                <strong>{m.label}</strong>{" "}
                <time dateTime={m.timestamp}>{m.timestamp.slice(0, 10)}</time>
              </p>
              <p>{m.text}</p>
            </li>
          ))}
        </ol>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 5: Rewrite `website/src/routes/_phone/menu/messages/write.tsx`** (the form config comes from `writeMessage` — same destination the handset editor uses after Task 5):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";
  import { writeMessage } from "../../../../content";

  export const Route = createFileRoute("/_phone/menu/messages/write")({ component: WritePanel });

  function WritePanel() {
    const mailto = `mailto:${writeMessage.destinationEmail}?subject=${encodeURIComponent(writeMessage.subject)}`;
    return (
      <ContentPanel title="Write messages">
        <p>
          On the handset this opens a real multi-tap SMS editor — one key, many presses, 160
          characters of commitment. Accepting the message (NaviKey) hands it to your mail client.
        </p>
        <p>
          Prefer the easy way? <a href={mailto}>Email me directly</a>.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 6: Rewrite `website/src/routes/_phone/menu/chat.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { chatMessages } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/chat")({ component: ChatPanel });

  function ChatPanel() {
    return (
      <ContentPanel title="Chat">
        <p>
          Testimonials, rendered as a 3310 chat session: <code>&gt;</code> is them,{" "}
          <code>&lt;</code> is me.
        </p>
        <ul className="list-none pl-0">
          {chatMessages.map((line, i) => (
            <li key={i}>
              <code aria-hidden="true">{line.who === "them" ? ">" : "<"}</code>{" "}
              <strong>{line.nickname}:</strong> {line.text}
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 7: Rewrite `website/src/routes/_phone/menu/call-register.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { missedCalls, projects, roles } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/call-register")({
    component: CallRegisterPanel,
  });

  function CallRegisterPanel() {
    return (
      <ContentPanel title="Call register">
        <section aria-labelledby="received-calls">
          <h2 id="received-calls">Received calls — roles held</h2>
          <dl>
            {roles.map((r) => (
              <div key={r.id}>
                <dt>
                  <strong>{r.title}</strong>, {r.org}{" "}
                  <time dateTime={r.periodStart}>{r.period}</time>
                </dt>
                <dd>{r.summary}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="dialled-numbers">
          <h2 id="dialled-numbers">Dialled numbers — projects shipped</h2>
          <dl>
            {projects.map((p) => (
              <div key={p.id}>
                <dt>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {p.name}
                    </a>
                  ) : (
                    <strong>{p.name}</strong>
                  )}{" "}
                  <time dateTime={p.year}>{p.year}</time>
                </dt>
                <dd>{p.blurb}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="missed-calls">
          <h2 id="missed-calls">Missed calls — ones that got away</h2>
          <ul>
            {missedCalls.map((m) => (
              <li key={m.id}>
                <strong>{m.label}</strong> — {m.note}
              </li>
            ))}
          </ul>
        </section>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 8: Rewrite `website/src/routes/_phone/menu/reminders.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { nowItems } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/reminders")({ component: RemindersPanel });

  function RemindersPanel() {
    return (
      <ContentPanel title="Reminders">
        <p>What I'm doing now:</p>
        <dl>
          {nowItems.map((n) => (
            <div key={n.id}>
              <dt>
                <strong>{n.label}</strong>
              </dt>
              <dd>{n.detail}</dd>
            </div>
          ))}
        </dl>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 9: Rewrite `website/src/routes/_phone/menu/clock.tsx`** (no `new Date()` in render — it would mismatch on hydration; the time zone is named, not computed):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { clock } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/clock")({ component: ClockPanel });

  function ClockPanel() {
    return (
      <ContentPanel title="Clock">
        <p>
          My time zone: <strong>{clock.timeZone}</strong>.
        </p>
        <p>{clock.availability}</p>
        <p>The handset's standby clock shows your local time, just like a real SIM would not.</p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 10: Rewrite `website/src/routes/_phone/menu/call-divert.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { diverts } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/call-divert")({ component: CallDivertPanel });

  function CallDivertPanel() {
    return (
      <ContentPanel title="Call divert">
        <p>
          Divert this visit to one of my profiles elsewhere (selecting one on the handset opens it
          too):
        </p>
        <ul>
          {diverts.map((d) => (
            <li key={d.id}>
              <a href={d.href} target="_blank" rel="me noopener noreferrer">
                {d.label}
              </a>
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 11: Rewrite `website/src/routes/_phone/menu/profiles.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { profileModes } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/profiles")({ component: ProfilesPanel });

  function ProfilesPanel() {
    return (
      <ContentPanel title="Profiles">
        <p>Visitor modes that re-weight the content are a stretch goal. The lineup:</p>
        <dl>
          {profileModes.map((p) => (
            <div key={p.id}>
              <dt>
                <strong>{p.label}</strong>
              </dt>
              <dd>{p.description}</dd>
            </div>
          ))}
        </dl>
        <p>For now, every visitor gets General — the authentic default.</p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 12: Gates:** `mise exec -- vp run website#test`, `mise exec -- vp check --fix`, `mise exec -- vp run website#build` — all must pass. Spot-check in dev: `/menu/call-register` shows the three sections; `/menu/phone-book` links carry `rel="me noopener noreferrer"` on GitHub/LinkedIn (inspect element).
- [ ] **Step 13: Commit:**

  ```sh
  git add website/src/routes
  git commit -m "feat(website): semantic content panels from the section modules"
  ```

---

### Task 3: Settings store — localStorage `hellotimber.settings`

A tiny observable store, SSR-safe, persisted to `localStorage["hellotimber.settings"]`, with a `useSettings()` hook (useSyncExternalStore, so hydration is mismatch-free: server snapshot = defaults, client re-renders with stored values).

**Files**

- Create: `website/src/settings.ts`
- Test: `website/tests/settings.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/settings.test.ts`:

  ```ts
  // @vitest-environment jsdom
  import { beforeEach, describe, expect, it } from "vite-plus/test";
  import {
    DEFAULT_SETTINGS,
    getSettings,
    resetSettingsForTests,
    subscribeSettings,
    updateSettings,
  } from "../src/settings";

  beforeEach(() => {
    window.localStorage.clear();
    resetSettingsForTests();
  });

  describe("settings store", () => {
    it("returns defaults when nothing is stored", () => {
      expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it("updates persist to localStorage under hellotimber.settings", () => {
      updateSettings({ keypadTones: false, welcomeNote: "G'day" });
      const raw = window.localStorage.getItem("hellotimber.settings");
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toMatchObject({ keypadTones: false, welcomeNote: "G'day" });
    });

    it("stored partial JSON merges over defaults", () => {
      window.localStorage.setItem("hellotimber.settings", JSON.stringify({ backlight: false }));
      resetSettingsForTests();
      expect(getSettings()).toEqual({ ...DEFAULT_SETTINGS, backlight: false });
    });

    it("corrupt stored JSON falls back to defaults", () => {
      window.localStorage.setItem("hellotimber.settings", "{not json");
      resetSettingsForTests();
      expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it("notifies subscribers once per update and supports unsubscribe", () => {
      let calls = 0;
      const off = subscribeSettings(() => {
        calls += 1;
      });
      updateSettings({ muted: true });
      expect(calls).toBe(1);
      expect(getSettings().muted).toBe(true);
      off();
      updateSettings({ muted: false });
      expect(calls).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/settings.ts`): `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/settings.ts`:**

  ```ts
  import { useSyncExternalStore } from "react";

  /** Site settings, dressed as phone settings (VISION Menu 5/6). */
  export interface SiteSettings {
    /** Tones 5-6 — key beeps on/off (deviation 11: On/Off, not levels). */
    keypadTones: boolean;
    /** Settings → Phone settings → Lights — drives phone-3d backlightOn. */
    backlight: boolean;
    /** Settings → Phone settings → Welcome note — shown at boot (next load). */
    welcomeNote: string;
    /** Global mute — overrides everything (the SoundToggle button). */
    muted: boolean;
    /** Tones 5-1 — selected ringtone id (see src/phone/tones.ts). */
    ringtone: string;
    /** Tones 5-9 — idle screensaver on/off. */
    screenSaver: boolean;
  }

  export const DEFAULT_SETTINGS: SiteSettings = {
    keypadTones: true,
    backlight: true,
    welcomeNote: "Welcome!",
    muted: false,
    ringtone: "nokia-tune",
    screenSaver: true,
  };

  const STORAGE_KEY = "hellotimber.settings";
  const listeners = new Set<() => void>();
  let cached: SiteSettings | null = null;

  function load(): SiteSettings {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SiteSettings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  export function getSettings(): SiteSettings {
    cached ??= load();
    return cached;
  }

  export function updateSettings(patch: Partial<SiteSettings>): SiteSettings {
    cached = { ...getSettings(), ...patch };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // storage unavailable (private mode/quota) — settings stay in-memory
    }
    for (const listener of [...listeners]) listener();
    return cached;
  }

  export function subscribeSettings(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  /** React view of the store. Server snapshot = defaults (no hydration crash). */
  export function useSettings(): SiteSettings {
    return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
  }

  /** Test hook: drop the cache so the next read goes back to localStorage. */
  export function resetSettingsForTests(): void {
    cached = null;
  }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run website#test`
- [ ] **Step 5: Gates:** `mise exec -- vp check --fix`, `mise exec -- vp run website#build`.
- [ ] **Step 6: Commit:**

  ```sh
  git add website/src/settings.ts website/tests/settings.test.ts
  git commit -m "feat(website): persisted site settings store"
  ```

---

### Task 4: Sound — key beeps, composer parser, the Nokia tune

WebAudio singleton, created lazily and only on user-gesture-driven code paths (autoplay policy: phone-core `sound` events are emitted synchronously from key handling, which IS a gesture). Key beep = 1800 Hz square wave, 30 ms, low gain. Ringtones are stored in the spec §8 composer notation (`[duration][.][#][note][octave]`, `-` = rest) and parsed by a small tested parser; mapping: composer octave 1 = scientific octave 5 (`a1` = 880 Hz), which matches the canonical handset rendition of the Nokia tune (starts E6 ≈ 1318.5 Hz, ends A5 = 880 Hz).

**Files**

- Create: `website/src/phone/composer.ts`
- Create: `website/src/phone/tones.ts`
- Create: `website/src/phone/audio.ts`
- Create: `website/src/components/SoundToggle.tsx`
- Modify: `website/src/phone/phone.ts` (wire the `sound` event)
- Modify: `website/src/routes/_phone.tsx` (mount SoundToggle)
- Rewrite: `website/src/routes/_phone/menu/tones.tsx`
- Test: `website/tests/composer.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/composer.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { parseComposer } from "../src/phone/composer";
  import { TONES } from "../src/phone/tones";

  describe("parseComposer (spec §8 notation)", () => {
    it("parses pitch: composer octave 1 is scientific octave 5", () => {
      const [a1] = parseComposer("4a1", 180);
      expect(a1!.freq).toBeCloseTo(880, 1);
    });

    it("parses sharps and octaves", () => {
      const [fs1, e2, c3] = parseComposer("8#f1 8e2 8c3", 180);
      expect(fs1!.freq).toBeCloseTo(739.99, 1); // F#5
      expect(e2!.freq).toBeCloseTo(1318.51, 1); // E6
      expect(c3!.freq).toBeCloseTo(2093.0, 1); // C7
    });

    it("duration: number is the note fraction, dot adds 50%", () => {
      // 180 bpm → quarter = 333.33 ms
      const [quarter, eighth, dottedEighth, whole] = parseComposer("4a1 8a1 8.a1 1a1", 180);
      expect(quarter!.ms).toBeCloseTo(333.33, 1);
      expect(eighth!.ms).toBeCloseTo(166.67, 1);
      expect(dottedEighth!.ms).toBeCloseTo(250, 1);
      expect(whole!.ms).toBeCloseTo(1333.33, 1);
    });

    it("parses rests (the manual's example tokens '1-' and '8-')", () => {
      const notes = parseComposer("16.a2 16d2 8a2 1- 8-", 180);
      expect(notes).toHaveLength(5);
      expect(notes[0]!.freq).not.toBeNull(); // dotted 16th a2
      expect(notes[3]).toEqual({ freq: null, ms: expect.closeTo(1333.33, 1) });
      expect(notes[4]!.freq).toBeNull();
    });

    it("throws on malformed tokens", () => {
      expect(() => parseComposer("9a1", 180)).toThrow(/composer token/);
      expect(() => parseComposer("8h1", 180)).toThrow(/composer token/);
      expect(() => parseComposer("8a9", 180)).toThrow(/composer token/);
    });

    it("every shipped tone parses, and the Nokia tune is 13 notes", () => {
      for (const tone of TONES) {
        expect(() => parseComposer(tone.notation, tone.bpm), tone.id).not.toThrow();
      }
      const nokia = TONES.find((t) => t.id === "nokia-tune")!;
      const notes = parseComposer(nokia.notation, nokia.bpm).filter((n) => n.freq !== null);
      expect(notes).toHaveLength(13);
      expect(notes[0]!.freq).toBeCloseTo(1318.51, 1); // E6
      expect(notes.at(-1)!.freq).toBeCloseTo(880, 1); // A5
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/composer.ts`:**

  ```ts
  /**
   * Parser for the Nokia composer notation (docs/specs/nokia-3310.md §8):
   * token = [duration][.][#][note][octave], '-' instead of note+octave = rest.
   * Manual example verbatim: `16.a2 16d2 16#f2 16a1 16d2 16#f2 8a2 1- 8-`.
   * Pitch mapping: composer octave 1 = scientific octave 5 (a1 = 880 Hz) —
   * matches the handset's high piezo rendition.
   */
  export interface ComposerNote {
    /** Hz; null = rest. */
    freq: number | null;
    ms: number;
  }

  const NOTE_OFFSETS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const TOKEN_RE = /^(32|16|8|4|2|1)(\.?)(?:-|(#?)([a-g])([1-3]))$/;

  export function parseComposer(notation: string, bpm: number): ComposerNote[] {
    const quarterMs = 60_000 / bpm;
    return notation
      .trim()
      .split(/\s+/)
      .map((token) => {
        const m = TOKEN_RE.exec(token);
        if (m === null) throw new Error(`bad composer token: "${token}"`);
        const [, duration, dot, sharp, note, octave] = m;
        const ms = quarterMs * (4 / Number(duration)) * (dot === "." ? 1.5 : 1);
        if (note === undefined) return { freq: null, ms };
        const midi = 12 * (Number(octave) + 5) + NOTE_OFFSETS[note]! + (sharp === "#" ? 1 : 0);
        return { freq: 440 * 2 ** ((midi - 69) / 12), ms };
      });
  }
  ```

- [ ] **Step 4: Write `website/src/phone/tones.ts`** (data only — no WebAudio import, so the content layer and tests can use it). The labels deliberately match `nokia3310Menu`'s default ringtone list, whose kebab-cased ids are exactly these ids:

  ```ts
  /** A ringtone: composer notation + tempo. Ids match nokia3310Menu's
   *  default ringtone list ("Nokia tune" → "nokia-tune", …). */
  export interface ToneDef {
    id: string;
    label: string;
    notation: string;
    bpm: number;
  }

  export const TONES: readonly ToneDef[] = [
    {
      id: "nokia-tune",
      label: "Nokia tune",
      // Gran Vals (Tárrega), bars 13–16 — THE tune, 13 notes.
      notation: "8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1",
      bpm: 180,
    },
    {
      id: "ring-ring",
      label: "Ring ring",
      // Classic bell trill: two fast alternating high notes, pause, repeat.
      notation:
        "16c3 16d3 16c3 16d3 16c3 16d3 16c3 16d3 8- 16c3 16d3 16c3 16d3 16c3 16d3 16c3 16d3 2-",
      bpm: 200,
    },
    {
      id: "grande-valse",
      label: "Grande valse",
      // The same Gran Vals phrase at a statelier waltz tempo.
      notation: "8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1",
      bpm: 140,
    },
  ];
  ```

- [ ] **Step 5: Run & expect PASS** (composer tests): `mise exec -- vp run website#test`
- [ ] **Step 6: Write `website/src/phone/audio.ts`:**

  ```ts
  import { getSettings } from "../settings";
  import { parseComposer } from "./composer";
  import { TONES } from "./tones";

  /**
   * WebAudio singleton. The context is created LAZILY on first use, and every
   * entry point is reached from a user gesture (key handlers / button clicks),
   * which satisfies browser autoplay policy. SSR-safe: no-ops without window.
   */
  let ctx: AudioContext | null = null;
  let stopCurrentTone: (() => void) | null = null;

  function ensureContext(): AudioContext | null {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  /** Square-wave blip with 5 ms ramps (no clicks). */
  function scheduleNote(
    ac: AudioContext,
    out: AudioNode,
    freq: number,
    at: number,
    ms: number,
    gain: number,
  ): void {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const end = at + ms / 1000;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.005);
    g.gain.setValueAtTime(gain, Math.max(at + 0.005, end - 0.005));
    g.gain.linearRampToValueAtTime(0, end);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(end);
  }

  /** Keypad beep: 1800 Hz square, 30 ms, quiet (spec §8 "Key beeps"). */
  export function playKeyBeep(): void {
    const settings = getSettings();
    if (settings.muted || !settings.keypadTones) return;
    const ac = ensureContext();
    if (ac === null) return;
    scheduleNote(ac, ac.destination, 1800, ac.currentTime, 30, 0.04);
  }

  /** Play one ringtone by id (preview from the Tones menu/panel). */
  export function playTone(id: string): void {
    if (getSettings().muted) return;
    const tone = TONES.find((t) => t.id === id);
    const ac = ensureContext();
    if (tone === undefined || ac === null) return;
    stopTone();
    const master = ac.createGain();
    master.gain.value = 1;
    master.connect(ac.destination);
    stopCurrentTone = () => {
      master.disconnect();
      stopCurrentTone = null;
    };
    let at = ac.currentTime + 0.05;
    for (const note of parseComposer(tone.notation, tone.bpm)) {
      if (note.freq !== null) {
        // 90% of the slot sounds; 10% gap keeps repeated notes articulated.
        scheduleNote(ac, master, note.freq, at, note.ms * 0.9, 0.06);
      }
      at += note.ms / 1000;
    }
  }

  export function stopTone(): void {
    stopCurrentTone?.();
  }

  /** Sink for phone-core 'sound' events — and the same entry point the
   *  website-registered picker apps call for previews (deviation 3). */
  export function handleSound(sound: { kind: "key" | "tone"; id: string }): void {
    if (sound.kind === "key") playKeyBeep();
    else playTone(sound.id);
  }
  ```

- [ ] **Step 7: Wire the event in `website/src/phone/phone.ts`.** Add the import at the top:

  ```ts
  import { handleSound } from "./audio";
  ```

  and directly below the existing `phone.on("action", …)` block in `getPhoneRuntime()`, add:

  ```ts
  // Key beeps (and future phone-core tones) — settings/mute applied inside.
  phone.on("sound", handleSound);
  ```

- [ ] **Step 8: Write `website/src/components/SoundToggle.tsx`** (the global mute — visible at all times next to the stage):

  ```tsx
  import { useSettings, updateSettings } from "../settings";

  /** Global mute. aria-pressed=true means SOUND IS ON (it's a sound toggle). */
  export default function SoundToggle() {
    const { muted } = useSettings();
    return (
      <button
        type="button"
        className="sound-toggle"
        aria-pressed={!muted}
        onClick={() => updateSettings({ muted: !muted })}
      >
        {muted ? "🔇 Sound off" : "🔊 Sound on"}
      </button>
    );
  }
  ```

- [ ] **Step 9: Mount it in `website/src/routes/_phone.tsx`.** Add the import `import SoundToggle from "../components/SoundToggle";` and wrap the stage column so the toggle sits under the canvas — replace the `<ClientOnly …>…</ClientOnly>` block with:

  ```tsx
  <div>
    <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
      <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
        <PhoneStageHost />
      </Suspense>
      <SoundToggle />
    </ClientOnly>
  </div>
  ```

  (SoundToggle is inside `ClientOnly` because its pressed state comes from localStorage.) Append to `website/src/styles.css`:

  ```css
  .sound-toggle {
    margin-top: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 9999px;
    background: var(--surface);
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    color: var(--sea-ink);
  }
  ```

- [ ] **Step 10: Rewrite `website/src/routes/_phone/menu/tones.tsx`** — list the real tones with DOM preview buttons (button click = user gesture, so this may create the AudioContext):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { playTone, stopTone } from "../../../phone/audio";
  import { TONES } from "../../../phone/tones";

  export const Route = createFileRoute("/_phone/menu/tones")({ component: TonesPanel });

  function TonesPanel() {
    return (
      <ContentPanel title="Tones">
        <p>
          Monophonic ringtones, as nature intended. Preview them here, or pick one on the handset
          under Tones → Ringing tone (it previews there too).
        </p>
        <ul>
          {TONES.map((tone) => (
            <li key={tone.id}>
              <button type="button" onClick={() => playTone(tone.id)}>
                ▶ {tone.label}
              </button>
            </li>
          ))}
        </ul>
        <p>
          <button type="button" onClick={() => stopTone()}>
            ■ Stop
          </button>{" "}
          Keypad tones and the screensaver live here too — toggle them on the handset (Task 5) or
          under <a href="/menu/settings">Settings</a>.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 11: Gates:** `mise exec -- vp run website#test`, `mise exec -- vp check --fix`, `mise exec -- vp run website#build`.
- [ ] **Step 12: Manual verification** (`mise exec -- vp run website#dev`): clicking 3D keys beeps (after the first click — gesture-created context); `/menu/tones` ▶ buttons play the Nokia tune/Ring ring/Grande valse; the Sound off toggle silences everything; beep settings persist across reloads (devtools → Application → localStorage → `hellotimber.settings`).
- [ ] **Step 13: Commit:**

  ```sh
  git add website/src/phone website/src/components/SoundToggle.tsx website/src/routes website/src/styles.css website/tests/composer.test.ts
  git commit -m "feat(website): WebAudio key beeps, composer parser, Nokia tune"
  ```

---

### Task 5: Settings that actually work — on the handset AND in the panel

A generic option-picker `PhoneApp` powers Tones → Ringing tone / Keypad tones / Screen saver and Settings → Phone settings → Welcome note / Lights. The website patches `nokia3310Menu`'s stub nodes with same-id `app` nodes (deviation 2 — paths unchanged, phone-core untouched), registers the apps, and the Settings panel gets working DOM toggles backed by the same store. Backlight drives `<PhoneStage backlightOn>`.

**Files**

- Create: `website/src/phone/apps/picker-app.ts`
- Modify: `website/src/phone/phone.ts`
- Modify: `website/src/phone/PhoneStageHost.tsx`
- Rewrite: `website/src/routes/_phone/menu/settings.tsx`
- Test: `website/tests/picker-app.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/picker-app.test.ts` (drives the picker through a real phone-core machine — node env):

  ```ts
  import { createPhone } from "@hellotimber/phone-core";
  import type { MenuNode, Phone } from "@hellotimber/phone-core";
  import { describe, expect, it } from "vite-plus/test";
  import { pickerApp } from "../src/phone/apps/picker-app";

  function pickerPhone(opts: { selected?: () => number; onPick: (i: number) => void }): Phone {
    const menu: MenuNode[] = [
      { type: "app", id: "keypad-tones", label: "Keypad tones", appId: "picker" },
    ];
    const phone = createPhone({
      menu,
      bootMs: 0,
      apps: {
        picker: pickerApp({ title: "Keypad tones", options: ["On", "Off"], ...opts }),
      },
    });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.navigate("menu/keypad-tones");
    return phone;
  }

  describe("pickerApp", () => {
    it("renders a list screen with the current selection preselected", () => {
      const phone = pickerPhone({ selected: () => 1, onPick: () => {} });
      expect(phone.screen).toEqual({
        kind: "list",
        title: "Keypad tones",
        items: ["On", "Off"],
        selected: 1,
        softkey: "OK",
      });
    });

    it("up/down move with wraparound", () => {
      const phone = pickerPhone({ onPick: () => {} });
      phone.pressKey("down");
      expect(phone.screen).toMatchObject({ selected: 1 });
      phone.pressKey("down"); // wraps
      expect(phone.screen).toMatchObject({ selected: 0 });
      phone.pressKey("up"); // wraps back
      expect(phone.screen).toMatchObject({ selected: 1 });
    });

    it("navi picks the highlighted option and exits to the carousel", () => {
      const picks: number[] = [];
      const phone = pickerPhone({ onPick: (i) => picks.push(i) });
      phone.pressKey("down");
      phone.pressKey("navi");
      expect(picks).toEqual([1]);
      expect(phone.path).toBe("menu");
    });

    it("C cancels without picking", () => {
      const picks: number[] = [];
      const phone = pickerPhone({ onPick: (i) => picks.push(i) });
      phone.pressKey("c");
      expect(picks).toEqual([]);
      expect(phone.path).toBe("menu");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/apps/picker-app.ts`:**

  ```ts
  import type { AppFactory, KeyEvent, PhoneApp, ScreenModel } from "@hellotimber/phone-core";

  export interface PickerOpts {
    title: string;
    options: string[];
    /** Re-read at every launch so the picker opens on the current value. */
    selected?: () => number;
    onPick: (index: number) => void;
  }

  /**
   * A one-shot option picker (Tones/Settings submenus): ▲▼ move with wrap,
   * NaviKey picks + exits, C cancels. Scroll on key-down (snappy, like the
   * real list UI); pick/cancel on key-up (mirrors phone-core list behavior).
   */
  export function pickerApp(opts: PickerOpts): AppFactory {
    return (ctx) => {
      const count = opts.options.length;
      let selected = Math.min(Math.max(opts.selected?.() ?? 0, 0), count - 1);
      const app: PhoneApp = {
        onKey(e: KeyEvent): void {
          if (e.type === "down") {
            if (e.key === "up") selected = (selected + count - 1) % count;
            else if (e.key === "down") selected = (selected + 1) % count;
            return;
          }
          if (e.key === "navi") {
            opts.onPick(selected);
            ctx.exit();
          } else if (e.key === "c") {
            ctx.exit();
          }
        },
        tick(): void {},
        render(): ScreenModel {
          return {
            kind: "list",
            title: opts.title,
            items: opts.options,
            selected,
            softkey: "OK",
          };
        },
      };
      return app;
    };
  }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run website#test`

> _(Continued below: Task 5 Steps 5–8 wire the picker into the menu and add the Settings panel; Tasks 6–11 add SEO, easter eggs, accessibility, performance, CI, and the content-handoff checklist.)_

- [ ] **Step 5: Wire the picker + Settings panel** — see plan 05's `phone.ts` patch points. In `website/src/phone/phone.ts`, after `nokia3310Menu(content)` builds the tree, patch the stub nodes (deviation 2 — same ids) and register the apps:

  ```ts
  import { pickerApp } from "./apps/picker-app";
  import { editorApp } from "@hellotimber/phone-core";
  import { getSettings, updateSettings } from "../settings";
  import { TONES } from "./tones";

  // …inside getPhoneRuntime(), replacing the bare `nokia3310Menu(content)`:
  const menu = withWorkingSettings(nokia3310Menu(content));

  function withWorkingSettings(tree: MenuNode[]): MenuNode[] {
    return patchNode(tree, {
      "tones/keypad-tones": {
        type: "app",
        id: "keypad-tones",
        label: "Keypad tones",
        appId: "keypad-tones",
      },
      "tones/ringing-tone": {
        type: "app",
        id: "ringing-tone",
        label: "Ringing tone",
        appId: "ringing-tone",
      },
      "tones/screen-saver": {
        type: "app",
        id: "screen-saver",
        label: "Screen saver",
        appId: "screen-saver",
      },
      "settings/phone-settings/welcome-note": {
        type: "app",
        id: "welcome-note",
        label: "Welcome note",
        appId: "welcome-note",
      },
    });
  }

  // patchNode: depth-first replace by full path. Local helper in phone.ts.
  function patchNode(
    nodes: MenuNode[],
    swaps: Record<string, MenuNode>,
    prefix = "menu",
  ): MenuNode[] {
    return nodes.map((n) => {
      const path = `${prefix}/${n.id}`;
      if (swaps[path]) return swaps[path];
      if (n.type === "submenu") return { ...n, children: patchNode(n.children, swaps, path) };
      return n;
    });
  }

  const apps = {
    ...existingApps, // write-message editor + snake from plan 05
    "keypad-tones": pickerApp({
      title: "Keypad tones",
      options: ["On", "Off"],
      selected: () => (getSettings().keypadTones ? 0 : 1),
      onPick: (i) => updateSettings({ keypadTones: i === 0 }),
    }),
    "ringing-tone": pickerApp({
      title: "Ringing tone",
      options: TONES.map((t) => t.label),
      selected: () =>
        Math.max(
          0,
          TONES.findIndex((t) => t.id === getSettings().ringtone),
        ),
      onPick: (i) => {
        updateSettings({ ringtone: TONES[i].id });
        handleSound({ kind: "tone", id: TONES[i].id }); // preview on pick
      },
    }),
    "screen-saver": pickerApp({
      title: "Screen saver",
      options: ["On", "Off"],
      selected: () => (getSettings().screensaver ? 0 : 1),
      onPick: (i) => updateSettings({ screensaver: i === 0 }),
    }),
    "welcome-note": editorApp({
      title: "Welcome note",
      onAccept: (text: string) => updateSettings({ welcomeText: text.trim() }),
    }),
  };
  ```

  Pass the live backlight value to the stage from `PhoneStageHost.tsx`:

  ```tsx
  import { useSettings } from "../settings";
  // …inside PhoneStageHost:
  const settings = useSettings();
  return (
    <PhoneStage
      screenCanvas={runtime.renderer.canvas}
      screenVersion={version}
      backlightOn={settings.backlight}
      onKey={(k, a) => runtime.input(k, a)}
    />
  );
  ```

- [ ] **Step 6: Rewrite the Settings panel** `website/src/routes/_phone/menu/settings.tsx` with working DOM controls bound to the same store:

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import { ContentPanel } from "../../../components/ContentPanel";
  import { useSettings, updateSettings } from "../../../settings";
  import { pageHead } from "../../../seo";

  export const Route = createFileRoute("/_phone/menu/settings")({
    head: () =>
      pageHead({
        section: "Settings",
        description: "Phone settings: keypad tones, backlight, welcome note.",
      }),
    component: SettingsPanel,
  });

  function SettingsPanel() {
    const s = useSettings();
    return (
      <ContentPanel title="Settings">
        <fieldset className="space-y-3 border-0 p-0">
          <label className="flex items-center justify-between gap-4">
            <span>Keypad tones</span>
            <input
              type="checkbox"
              checked={s.keypadTones}
              onChange={(e) => updateSettings({ keypadTones: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Backlight</span>
            <input
              type="checkbox"
              checked={s.backlight}
              onChange={(e) => updateSettings({ backlight: e.target.checked })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Welcome note</span>
            <input
              type="text"
              maxLength={40}
              value={s.welcomeText}
              placeholder="(shown on next boot)"
              onChange={(e) => updateSettings({ welcomeText: e.target.value })}
              className="rounded border border-current/30 bg-transparent px-2 py-1"
            />
          </label>
        </fieldset>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 7: Verify** — `mise exec -- vp run website#dev`. `Menu → Tones → Keypad tones`: list preselected at current value; pick Off → keys no longer beep. Toggle Backlight in the panel → 3D screen dims/brightens live. `Menu → Settings → Phone settings → Welcome note`: type a word, OK, reload → shows during boot.
- [ ] **Step 8: Commit:**

  ```bash
  git add website/src/phone/apps/picker-app.ts website/tests/picker-app.test.ts website/src/phone/phone.ts website/src/phone/PhoneStageHost.tsx website/src/routes/_phone/menu/settings.tsx
  git commit -m "feat(website): working settings — keypad tones, backlight, welcome note"
  ```

---

### Task 6: SEO & meta — per-route head, favicon, sitemap, JSON-LD

Every route gets a real `<title>`/description; a server route emits `sitemap.xml` from the canonical path list; the index carries a JSON-LD `Person`. This is what makes the gimmick crawlable (VISION goal 2).

**Files**

- Create: `website/src/seo.ts`, `website/src/content/site.ts`, `website/src/routes/sitemap[.]xml.ts`, `website/public/favicon.svg`
- Modify: `website/src/routes/__root.tsx`, `website/public/robots.txt`, `website/public/manifest.json`, every route under `website/src/routes/_phone/**`
- Test: `website/tests/seo.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/seo.test.ts` (node env):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { pageHead, SITEMAP_PATHS, personJsonLd } from "../src/seo";

  describe("seo", () => {
    it("builds a titled head with description meta", () => {
      const head = pageHead({ section: "Phone book", description: "Get in touch." });
      expect(head.meta?.find((m) => "title" in m)).toEqual({
        title: "Lachlan Heywood — Phone book",
      });
      expect(head.meta?.find((m) => m.name === "description")).toEqual({
        name: "description",
        content: "Get in touch.",
      });
    });
    it("home head omits the dash suffix", () => {
      expect(pageHead({ description: "Portfolio." }).meta?.find((m) => "title" in m)).toEqual({
        title: "Lachlan Heywood",
      });
    });
    it("sitemap paths are absolute, unique, and start with /", () => {
      expect(SITEMAP_PATHS.length).toBeGreaterThan(10);
      expect(new Set(SITEMAP_PATHS).size).toBe(SITEMAP_PATHS.length);
      for (const p of SITEMAP_PATHS) expect(p.startsWith("/")).toBe(true);
    });
    it("Person JSON-LD has the expected shape", () => {
      const ld = personJsonLd();
      expect(ld["@type"]).toBe("Person");
      expect(typeof ld.name).toBe("string");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/content/site.ts`** (SAMPLE DATA — canonical site facts):

  ```ts
  export interface SiteMeta {
    name: string;
    origin: string; // canonical origin, no trailing slash
    tagline: string;
    sameAs: string[]; // social profile URLs for JSON-LD
  }

  // SAMPLE DATA — replace with real copy
  export const site: SiteMeta = {
    name: "Lachlan Heywood",
    origin: "https://hellotimber.example", // SAMPLE DATA — replace with real domain
    tagline: "Engineer. This portfolio is a working Nokia 3310.",
    sameAs: [
      "https://github.com/example", // SAMPLE DATA
      "https://www.linkedin.com/in/example", // SAMPLE DATA
    ],
  };
  ```

- [ ] **Step 4: Write `website/src/seo.ts`:**

  ```ts
  import { site } from "./content/site";

  export interface PageHeadInput {
    section?: string; // omit for home
    description: string;
  }

  /** Build a TanStack Start route `head()` return value. */
  export function pageHead(input: PageHeadInput) {
    const title = input.section ? `${site.name} — ${input.section}` : site.name;
    return {
      meta: [
        { title },
        { name: "description", content: input.description },
        { property: "og:title", content: title },
        { property: "og:description", content: input.description },
        { property: "og:type", content: "website" },
      ],
    };
  }

  /** Canonical, indexable paths — the phone sitemap (VISION table). Catch-all + 404 excluded. */
  export const SITEMAP_PATHS: string[] = [
    "/",
    "/menu",
    "/menu/phone-book",
    "/menu/messages",
    "/menu/messages/inbox",
    "/menu/messages/write",
    "/menu/chat",
    "/menu/call-register",
    "/menu/tones",
    "/menu/settings",
    "/menu/call-divert",
    "/menu/games",
    "/menu/games/snake",
    "/menu/calculator",
    "/menu/reminders",
    "/menu/clock",
    "/menu/profiles",
    "/menu/sim-services",
  ];

  export function personJsonLd(): Record<string, unknown> {
    return {
      "@context": "https://schema.org",
      "@type": "Person",
      name: site.name,
      url: site.origin,
      description: site.tagline,
      sameAs: site.sameAs,
    };
  }
  ```

- [ ] **Step 5: Write `website/src/routes/sitemap[.]xml.ts`** (server route — deviation 8 names the fallback):

  ```ts
  import { createFileRoute } from "@tanstack/react-router";
  import { SITEMAP_PATHS } from "../seo";
  import { site } from "../content/site";

  function renderSitemap(): string {
    const urls = SITEMAP_PATHS.map(
      (p) => `  <url><loc>${site.origin}${p === "/" ? "" : p}</loc></url>`,
    ).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  export const Route = createFileRoute("/sitemap[.]xml")({
    server: {
      handlers: {
        GET: () =>
          new Response(renderSitemap(), {
            headers: { "content-type": "application/xml; charset=utf-8" },
          }),
      },
    },
  });
  ```

  > If `generate-routes`/typecheck rejects the `server.handlers` shape, STOP and switch to `createServerFileRoute().methods({ GET })` from `@tanstack/react-start/server` (deviation 8), then report the drift.

- [ ] **Step 6: Write `website/public/favicon.svg`** (green-pixel phone glyph):

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect width="16" height="16" fill="#43523d"/>
    <rect x="5" y="1" width="6" height="14" fill="#c7f0d8"/>
    <rect x="6" y="3" width="4" height="5" fill="#43523d"/>
    <rect x="6" y="10" width="1" height="1" fill="#43523d"/>
    <rect x="8" y="10" width="1" height="1" fill="#43523d"/>
    <rect x="6" y="12" width="1" height="1" fill="#43523d"/>
    <rect x="8" y="12" width="1" height="1" fill="#43523d"/>
  </svg>
  ```

- [ ] **Step 7: Update `website/src/routes/__root.tsx`** — set the default head from `site` and inject JSON-LD. In the root route `head()`: `title: site.name`, a description meta from `site.tagline`, link the favicon `{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }`; render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()) }} />` inside `RootDocument`'s `<head>`. Replace plan 05's hardcoded "Lachlan Heywood" title with `site.name` (single source).
- [ ] **Step 8: Update `website/public/robots.txt`** (append `Sitemap: https://hellotimber.example/sitemap.xml`) and rewrite `website/public/manifest.json`:

  ```json
  {
    "name": "Lachlan Heywood",
    "short_name": "hellotimber",
    "icons": [{ "src": "/favicon.svg", "type": "image/svg+xml", "sizes": "any" }],
    "theme_color": "#43523d",
    "background_color": "#c7f0d8",
    "display": "standalone",
    "start_url": "/"
  }
  ```

- [ ] **Step 9: Add `head:` to every `\_phone/**`route** using`pageHead`. Per-route values:
  - `_phone/index.tsx` → `pageHead({ description: site.tagline })`
  - `_phone/menu/index.tsx` → `{ section: "Menu", description: "Browse the phone menu." }`
  - `menu/phone-book.tsx` → `{ section: "Phone book", description: "Contact details: email, GitHub, LinkedIn, CV." }`
  - `menu/messages/index.tsx` → `{ section: "Messages", description: "About me, in SMS form." }`
  - `menu/messages/inbox.tsx` → `{ section: "Inbox", description: "Short intros." }`
  - `menu/messages/write.tsx` → `{ section: "Write message", description: "Send a message." }`
  - `menu/chat.tsx` → `{ section: "Chat", description: "What people say." }`
  - `menu/call-register.tsx` → `{ section: "Call register", description: "Work history and projects." }`
  - `menu/tones.tsx` → `{ section: "Tones", description: "Sound settings and ringtones." }`
  - `menu/settings.tsx` → added in Task 5 Step 6
  - `menu/call-divert.tsx` → `{ section: "Call divert", description: "External profiles." }`
  - `menu/games/index.tsx` → `{ section: "Games", description: "Snake II and more." }`
  - `menu/games/snake.tsx` → `{ section: "Snake II", description: "Play Snake." }`
  - `menu/calculator.tsx` → `{ section: "Calculator", description: "A working 3310 calculator." }`
  - `menu/reminders.tsx` → `{ section: "Reminders", description: "What I'm doing now." }`
  - `menu/clock.tsx` → `{ section: "Clock", description: "My local time and availability." }`
  - `menu/profiles.tsx` → `{ section: "Profiles", description: "Visitor modes." }`
  - `menu/sim-services.tsx` → `{ section: "SIM services", description: "No service." }`
  - `_phone/$.tsx` (catch-all) → `head: () => ({ meta: [{ name: "robots", content: "noindex" }, { title: "Lachlan Heywood — No service" }] })` (NOT pageHead — must be noindex; deviation 9)
- [ ] **Step 10: Verify** `mise exec -- vp run website#build`, then dev: view-source on `/menu/phone-book` shows the section title + description; GET `/sitemap.xml` returns valid XML; view-source on `/` shows the JSON-LD `Person`.
- [ ] **Step 11: Commit:**

  ```bash
  git add website/src/seo.ts website/src/content/site.ts website/src/routes/sitemap\[.\]xml.ts website/public/favicon.svg website/public/robots.txt website/public/manifest.json website/src/routes/__root.tsx website/src/routes/_phone website/tests/seo.test.ts
  git commit -m "feat(website): SEO — per-route head, sitemap.xml, JSON-LD, favicon"
  ```

---

### Task 7: Easter eggs — input funnel, `*#06#` IMEI, screensaver, SIM 404

Reroute all input through `runtime.input()` so the website can watch the key stream for `*#06#` (a fun build-hash "IMEI") and reset a screensaver idle timer. The 404 catch-all steers the handset to SIM services.

**Files**

- Create: `website/src/phone/pixel-art.ts`, `website/src/global.d.ts`
- Modify: `website/src/phone/phone.ts` (add `input()`, screensaver, IMEI), `website/src/phone/keyboard.ts`, `website/src/phone/PhoneStageHost.tsx`, `website/src/routes/_phone/menu/sim-services.tsx`, `website/src/routes/_phone/$.tsx`, `website/vite.config.ts`
- Test: `website/tests/pixel-art.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/pixel-art.test.ts` (node env):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { artToBitmap } from "../src/phone/pixel-art";

  describe("artToBitmap", () => {
    it("converts string-art rows to a one-byte-per-pixel Bitmap", () => {
      const bmp = artToBitmap([".#.", "#.#", ".#."]);
      expect(bmp.width).toBe(3);
      expect(bmp.height).toBe(3);
      expect(bmp.pixels.length).toBe(9);
      expect([...bmp.pixels]).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0]);
    });
    it("pads ragged rows to the widest row with clear pixels", () => {
      const bmp = artToBitmap(["##", "#"]);
      expect(bmp.width).toBe(2);
      expect([...bmp.pixels]).toEqual([1, 1, 1, 0]);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/pixel-art.ts`:**

  ```ts
  import type { Bitmap } from "@hellotimber/phone-core";

  /** string-art rows ('#' set, anything else clear) → Bitmap (one byte/pixel). */
  export function artToBitmap(rows: string[]): Bitmap {
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    const height = rows.length;
    const pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const row = rows[y];
      for (let x = 0; x < width; x++) pixels[y * width + x] = row[x] === "#" ? 1 : 0;
    }
    return { width, height, pixels };
  }

  // SAMPLE screensaver picture — a tiny pixel scene (drawn centered on 84×48).
  export const SCREENSAVER_ART: string[] = [
    ".....######.......######........",
    "....#......#.....#......#.......",
    "....#.####.#.....#.####.#.......",
    "....#......#.....#......#.......",
    ".....######.......######........",
    "........#############...........",
    ".......#.............#..........",
    "......#...............#.........",
    ".......#############.#..........",
  ];
  ```

- [ ] **Step 4: Write `website/src/global.d.ts`:**

  ```ts
  /** Injected by vite define — short build hash for the *#06# IMEI gag. */
  declare const __BUILD_HASH__: string;
  ```

- [ ] **Step 5: Define the build hash in `website/vite.config.ts`** — add to `defineConfig` (deterministic; no `Date.now()`):

  ```ts
  define: { __BUILD_HASH__: JSON.stringify(process.env.BUILD_HASH ?? "devbuild") },
  ```

- [ ] **Step 6: Add the input funnel to `website/src/phone/phone.ts`** — wrap `phone.send` so the runtime observes keys, detects `*#06#`, and tracks idle for the screensaver. Inside `getPhoneRuntime()`, after `phone` is created, add `input()` and screensaver state; export `input`, `screensaverFrame`, `isScreensaver()`, and a `showImei` flag the SIM panel reads:

  ```ts
  import { artToBitmap, SCREENSAVER_ART } from "./pixel-art";
  import { getSettings } from "../settings";

  let recent = "";
  let idleSinceMs = 0;
  let screensaverOn = false;
  let showImei = false;
  const SCREENSAVER_IDLE_MS = 30_000;
  const screensaverFrame = artToBitmap(SCREENSAVER_ART);

  function input(key: PhoneKey, action: "down" | "up"): void {
    if (screensaverOn && action === "down") {
      screensaverOn = false;
      idleSinceMs = lastTickMs;
      return;
    }
    idleSinceMs = lastTickMs;
    if (action === "down") {
      recent = (recent + (key.length === 1 ? key : "")).slice(-5);
      if (recent === "*#06#") {
        showImei = true;
        phone.navigate("menu/sim-services");
      }
    }
    phone.send({ type: action, key });
  }
  // In the rAF tick loop (plan 05 Task 3): track lastTickMs; if
  // getSettings().screensaver && now - idleSinceMs > SCREENSAVER_IDLE_MS → screensaverOn = true.
  // When screensaverOn, PhoneStageHost renders screensaverFrame via the renderer custom path.
  ```

  > If `getPhoneRuntime()` exposes no place to hook the rAF loop or `lastTickMs`, locate the existing `requestAnimationFrame` tick (plan 05 Task 3) and add the screensaver check there. If the structure differs materially, STOP and report.

- [ ] **Step 7: Route input through the funnel.** In `website/src/phone/keyboard.ts` and `PhoneStageHost.tsx`, replace direct `phone.send(...)` calls with `runtime.input(key, action)` (deviation 10 — unchanged for normal keys).
- [ ] **Step 8: SIM-services panel shows the IMEI** — in `website/src/routes/_phone/menu/sim-services.tsx`, render `<p className="font-mono text-xs opacity-70">IMEI {__BUILD_HASH__}</p>` below "No service."
- [ ] **Step 9: Catch-all → SIM services** — confirm `website/src/routes/_phone/$.tsx` (plan 05) navigates the handset to `menu/sim-services` for unknown URLs and renders "No service". If not, add `useEffect(() => runtime.phone.navigate("menu/sim-services"), [])`.
- [ ] **Step 10: Verify** dev: type `* # 0 6 #` → SIM services shows `IMEI devbuild`; Settings → Screen saver On, idle 30 s → pixel scene, any key dismisses; visit `/nonexistent` → SIM services, address bar rewrites to `/menu/sim-services`.
- [ ] **Step 11: Commit:**

  ```bash
  git add website/src/phone/pixel-art.ts website/src/global.d.ts website/src/phone/phone.ts website/src/phone/keyboard.ts website/src/phone/PhoneStageHost.tsx website/src/routes/_phone/menu/sim-services.tsx website/src/routes/_phone/\$.tsx website/vite.config.ts website/tests/pixel-art.test.ts
  git commit -m "feat(website): easter eggs — *#06# IMEI, screensaver, SIM-services 404"
  ```

---

### Task 8: Accessibility & responsiveness — aria-live LCD mirror, reduced motion, mobile

The handset's screen text is mirrored into a visually-hidden `aria-live` region so screen readers track navigation; `prefers-reduced-motion` skips the boot animation and the 3D idle sway; the mobile layout stacks panel under canvas and stays fully usable without WebGL.

**Files**

- Create: `website/src/phone/screen-text.ts`
- Create: `website/src/components/ScreenMirror.tsx`
- Modify: `website/src/routes/_phone.tsx` (mount `ScreenMirror`)
- Modify: `website/src/styles.css` (`.sr-only`, focus rings, mobile grid)
- Modify: `packages/phone-3d/src/PhoneStage.tsx` (gate idle sway on reduced motion — this plan's single phone-3d edit, deviation 6)
- Modify: `website/src/phone/phone.ts` (reduced-motion → `bootMs: 0`)
- Test: `website/tests/screen-text.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/screen-text.test.ts` (node env):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { screenToText } from "../src/phone/screen-text";

  describe("screenToText", () => {
    it("describes the standby screen", () => {
      expect(screenToText({ kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 })).toBe(
        "Standby. LACHLAN. Press Menu.",
      );
    });
    it("reads a list with the current selection", () => {
      expect(
        screenToText({
          kind: "list",
          title: "Tones",
          items: ["Ringing tone", "Keypad tones"],
          selected: 1,
          softkey: "Select",
        }),
      ).toBe("Tones. Keypad tones, 2 of 2. Select.");
    });
    it("reads the menu carousel item", () => {
      expect(
        screenToText({
          kind: "menu-carousel",
          label: "Games",
          menuNumber: 8,
          total: 13,
          iconId: "games",
        }),
      ).toBe("Menu. Games, 8 of 13.");
    });
    it("falls back gracefully for custom app screens", () => {
      expect(
        screenToText({
          kind: "custom",
          appId: "snake",
          frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
        }),
      ).toBe("snake.");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/screen-text.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";

  /** A short spoken description of the current screen for an aria-live region. */
  export function screenToText(s: ScreenModel): string {
    switch (s.kind) {
      case "off":
        return "Phone off.";
      case "boot":
        return "Starting up.";
      case "standby":
        return `Standby. ${s.carrier}.${s.clock ? ` ${s.clock}.` : ""} Press Menu.`;
      case "menu-carousel":
        return `Menu. ${s.label}, ${s.menuNumber} of ${s.total}.`;
      case "list":
        return `${s.title}. ${s.items[s.selected] ?? ""}, ${s.selected + 1} of ${s.items.length}. ${s.softkey}.`;
      case "reader":
        return `${s.title}. ${s.lines.join(" ")}`;
      case "editor":
        return `${s.title}. ${s.text || "empty"}. ${s.mode}.`;
      case "confirm":
        return `${s.text}. ${s.softkey}.`;
      case "custom":
        return `${s.appId}.`;
    }
  }
  ```

- [ ] **Step 4: Write `website/src/components/ScreenMirror.tsx`** (subscribes to the phone, no canvas):

  ```tsx
  import { useEffect, useState } from "react";
  import { getPhoneRuntime } from "../phone/phone";
  import { screenToText } from "../phone/screen-text";

  /** Visually-hidden, polite live region that mirrors the handset screen for AT. */
  export function ScreenMirror() {
    const [text, setText] = useState("");
    useEffect(() => {
      const { phone } = getPhoneRuntime();
      setText(screenToText(phone.screen));
      return phone.subscribe((snap) => setText(screenToText(snap.screen)));
    }, []);
    return (
      <p className="sr-only" aria-live="polite" role="status">
        {text}
      </p>
    );
  }
  ```

- [ ] **Step 5: Mount it in `website/src/routes/_phone.tsx`** — render `<ScreenMirror />` inside the layout (it is client-only safe because `getPhoneRuntime` is guarded; place it inside the same `ClientOnly` subtree as the stage, or render it unconditionally since it produces only text — prefer inside `ClientOnly` to avoid SSR constructing the runtime).
- [ ] **Step 6: Add CSS to `website/src/styles.css`:**

  ```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .phone-layout a:focus-visible,
  .phone-layout button:focus-visible,
  .phone-layout input:focus-visible {
    outline: 2px solid #2456c8;
    outline-offset: 2px;
  }
  @media (max-width: 767px) {
    .phone-layout {
      grid-template-columns: 1fr; /* canvas above panel; panel fully usable */
    }
  }
  ```

- [ ] **Step 7: Reduced motion — boot skip.** In `website/src/phone/phone.ts`, when constructing the phone, set `bootMs` to `0` if the user prefers reduced motion:

  ```ts
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = createPhone({ /* …menu, apps, carrier, clock… */ bootMs: reduceMotion ? 0 : 2500 });
  ```

- [ ] **Step 8: Reduced motion — idle sway (the single phone-3d edit, deviation 6).** Open `packages/phone-3d/src/PhoneStage.tsx`. Find the `useFrame` that applies idle rotation/sway. Gate it on a reduced-motion check so the phone sits still for those users:

  ```tsx
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame((state) => {
    if (reduceMotion) return; // hold still
    // …existing sway/tilt code…
  });
  ```

  > If `PhoneStage.tsx` is laid out differently (plan 03's exact structure was unknown when this plan was written), locate the idle-motion `useFrame` by searching for `useFrame` in `packages/phone-3d/src/`, apply the same early-return gate, and keep the pointer-follow tilt if it is in a separate `useFrame` (tilt may stay — it responds to user input, not idle motion). If you cannot identify the idle-motion code unambiguously, STOP and report.

- [ ] **Step 9: Verify** — `mise exec -- vp run website#dev`. With a screen reader (or the browser a11y inspector), navigate the menu: the live region announces each screen. In OS settings enable "reduce motion", reload → no boot animation, phone holds still. Resize to mobile width → panel sits below the canvas and every link/control is reachable. Run Lighthouse (Chrome devtools) on `/menu/phone-book`: **Accessibility ≥ 95** (fix any flagged contrast/label issues before committing).
- [ ] **Step 10: Commit:**

  ```bash
  git add website/src/phone/screen-text.ts website/src/components/ScreenMirror.tsx website/src/routes/_phone.tsx website/src/styles.css packages/phone-3d/src/PhoneStage.tsx website/src/phone/phone.ts website/tests/screen-text.test.ts
  git commit -m "feat(website): a11y — aria-live screen mirror, reduced motion, mobile layout"
  ```

---

### Task 9: Performance — verify the three.js chunk is lazy and within budget

Confirm the heavy 3D bundle only loads inside the `_phone` layout (it already uses `lazy()` per plan 05 / integration-notes §3) and that the chunk is a reasonable size. No webfonts are used (the LCD font is hand-drawn pixels in phone-screen), so there is nothing to preload.

**Files**

- Modify: none expected (verification task; only act if the budget fails)

**Steps**

- [ ] **Step 1: Build and inspect chunks:** `mise exec -- vp run website#build`. In the build output, identify the chunk containing three / @react-three. Confirm it is a **separate** chunk (a `lazy()` split point), not part of the main entry.
- [ ] **Step 2: Check the gzip size** reported for that chunk. Budget: **three/R3F chunk < 700 KB gzipped**. Record the actual number in the commit message.
- [ ] **Step 3: If it is NOT split** (three appears in the main entry chunk), the `lazy()` import in `routes/_phone.tsx` was lost — STOP and report; the fix belongs to plan 05's pattern, not here.
- [ ] **Step 4: If over budget,** apply only safe wins: ensure `@react-three/drei` is imported by named import (tree-shakeable) not `import * as`, and that nothing in `website/src` imports `three` at the top level outside the lazy subtree. Re-build and re-measure. Do not add new dependencies.
- [ ] **Step 5: Confirm no webfont requests** — the design uses the pixel LCD font (rendered to canvas) and system fonts for HTML panels. Verify the Network tab shows no `.woff`/`.woff2` requests on first load.
- [ ] **Step 6: Commit** (docs-only if no code changed — record the measured numbers):

  ```bash
  git commit --allow-empty -m "chore(website): verify lazy 3D chunk <Xkb gz, no webfonts (perf budget)"
  ```

---

### Task 10: CI & deployment

A GitHub Actions workflow runs the full gate on every push. Deployment target is the one **open decision** (VISION "Assumptions"); this task sets up CI and stops at the decision point.

**Files**

- Create: `.github/workflows/ci.yml`

**Steps**

- [ ] **Step 1: Write `.github/workflows/ci.yml`:**

  ```yaml
  name: CI
  on:
    push:
      branches: [master]
    pull_request:
  jobs:
    ready:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: jdx/mise-action@v3
          with:
            install: true # installs tools from .config/mise.toml (node + vite-plus)
        - run: mise exec -- vp install
        - run: mise exec -- vp run ready
  ```

- [ ] **Step 2: Verify locally** that the exact CI command passes: `mise exec -- vp run ready` (= `vp check && vp run -r test && vp run -r build`). It must be green before committing.
- [ ] **Step 3: Commit:**

  ```bash
  git add .github/workflows/ci.yml
  git commit -m "ci: run vp run ready on push and PR via mise"
  ```

- [ ] **Step 4: DECISION REQUIRED — deployment target.** Do NOT implement a deploy step yet. Record the options for Lachlan (all support TanStack Start SSR):
  - **Cloudflare (Pages/Workers):** add the TanStack Start Cloudflare target + `wrangler`; cheapest edge SSR. Follow-up: `wrangler.toml` + a `deploy` job using `cloudflare/wrangler-action`.
  - **Vercel:** zero-config TanStack Start preset; connect the repo in the Vercel dashboard; no workflow file needed (or use the Vercel CLI in CI).
  - **Netlify:** TanStack Start Netlify adapter + `netlify.toml`; connect repo.
    Once chosen, the follow-up task is: add the target's adapter/config + a deploy job to `ci.yml` gated on `master`. Leave this as the project's single tracked open item.

---

### Task 11: Content handoff — replace all sample data, final gate

Everything fabricated in this repo is annotated `// SAMPLE DATA — replace with real copy`. This task is the exhaustive checklist so Lachlan (or an agent given his copy) can swap in real content and ship.

**Files**

- Modify: every file listed below (with Lachlan's real copy)
- Modify: `docs/plans/README.md` (mark plan 06 done)

**Steps**

- [ ] **Step 1: Find every sample block** — `grep -rn "SAMPLE DATA" website/src` — and replace the values in each. The fields, by file:
  - `website/src/content/site.ts` — real `name`, `origin` (the deployed domain), `tagline`, `sameAs` profile URLs.
  - `website/src/content/phonebook.ts` — real email, GitHub, LinkedIn, CV download URL (drop the file in `website/public/` and point at it).
  - `website/src/content/messages.ts` — real "about me" inbox blurbs (each ≤160 chars) + the contact-form destination email.
  - `website/src/content/chat.ts` — real testimonials (nickname + text per line) or remove the menu entry if none.
  - `website/src/content/call-register.ts` — real roles (org/title/period), projects (name/url/blurb), and the playful "missed calls" list.
  - `website/src/content/reminders.ts` — current "now" items.
  - `website/src/content/clock.ts` — real timezone + availability line.
  - `website/src/content/profiles.ts` — keep the stub or define real visitor modes (stretch).
  - `website/src/content/divert.ts` — real external profile links.
- [ ] **Step 2: Replace the favicon/OG** if desired (`website/public/favicon.svg` is a generic phone glyph — fine to keep).
- [ ] **Step 3: Decide the deployment target** (Task 10 Step 4) and wire the deploy job.
- [ ] **Step 4: Confirm no sample data remains** — `grep -rn "SAMPLE DATA" website/src` returns nothing; `grep -rn "example" website/src/content` finds no leftover `example.com`/`/example` handles.
- [ ] **Step 5: Full gate** — `mise exec -- vp run ready` is green (check + all package tests + build).
- [ ] **Step 6: Definition of done** — boot animation plays; standby reads the real carrier line; every menu route is reachable by keypad AND by URL AND crawlable (view-source shows the panel content); Snake is playable with a persisting top score; sound works and respects Settings; Lighthouse a11y ≥ 95; `/sitemap.xml` lists the real origin.
- [ ] **Step 7: Update `docs/plans/README.md`** — set plan 06 Status to **done**.
- [ ] **Step 8: Commit:**

  ```bash
  git add website/src/content docs/plans/README.md
  git commit -m "feat(website): real portfolio content — replace sample data"
  ```

---

## Done

When all tasks are ticked: the portfolio is a working Nokia 3310 whose menus carry real, crawlable, accessible content; sound and settings work; Snake is playable; CI is green; and the only open item is the deployment-target decision (Task 10 Step 4).
