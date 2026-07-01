# Plan 08 — Authentic SMS: Write messages, Inbox/Outbox, LLM-backed contacts

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** plan 07 (menu tree as website data — this plan adds nodes/apps to it).
**Ground truth:** `docs/specs/nokia-3310.md` §2 (editor counter, envelope status icon),
§5 Menu 2 (Messages) & Menu 3 (Chat), §6 (text entry), §9 (160-char SMS with countdown).

## Goal

Messaging becomes the site's authenticity centerpiece. **Look**: as close as possible to
the real 3310 — Write messages (Menu 2-1) is the multi-tap editor with the 160-character
countdown top-right; NaviKey opens an **Options** list (`Send`, `Clear text`, `Exit`);
`Send` → a `To:` contact picker; an envelope "Sending message" beat; the sent message
lands in **Outbox** (2-3 — the 3310 says Outbox, never "Sent items"). **Function**: the
message goes to a "contact" persona answered by a cheap LLM
(**`claude-haiku-4-5`** — $1/$5 per MTok; a full exchange costs well under a tenth of a
cent). The reply arrives seconds later exactly like a real SMS: standby shows the envelope
icon + **"1 message received"** with softkey `Read`; the message is in **Inbox** (2-2).
**Chat (Menu 3)** becomes what it really was on the 3310 — a live conversation view with
`>` their lines and `<` yours — backed by the "Lachlan" persona.

Everything works with **no API key** too (canned replies), so dev, CI, and forks never
break.

## Architecture

```
packages/phone-core     editor Options menu + char limit; dynamic list items;
                        standby notice; app chaining (ctx.open) — generic features only
packages/phone-screen   renders: editor countdown, standby notice line + envelope icon
website/src/content/contacts.ts   personas (id, name, system prompt, canned replies)
website/src/messages/store.ts     threads + outbox/inbox state, localStorage, subscribe
website/src/routes/api/sms.ts     POST → Anthropic claude-haiku-4-5 (server-only key)
website/src/phone/apps/sms.ts     write-message / sms-to / sms-sending apps + arrival
website/src/phone/apps/chat.ts    chat session app (>/< lines, write/Send loop)
```

The phone stays router- and network-ignorant: apps call plain injected callbacks
(`sendSms(contactId, text): Promise<string>`); the website owns fetch, delays, and the
store. phone-core gains only **generic** capabilities (options menu, char limit, notice,
dynamic lists, app chaining) — nothing SMS-specific.

## Contract changes (update VISION.md in Task 1, before any code)

```ts
// phone-core ScreenModel — two changed members:
| { kind: "editor"; title: string; text: string; cursor: number;
    mode: "abc" | "Abc" | "123"; limit?: number }            // NEW: countdown basis
| { kind: "standby"; carrier: string; clock?: string; signal: 0|1|2|3|4;
    battery: 0|1|2|3|4;
    notice?: { text: string; softkey: string } }             // NEW: "1 message received"

// phone-core MenuNode list items may be lazy (re-read every render):
| { type: "list"; id: string; label: string;
    items: Item[] | (() => Item[]) }                          // NEW union arm

// phone-core Phone — one new method:
setNotice(n: { text: string; softkey: string; path?: string } | null): void;
// standby renders it; NaviKey navigates to `path` (default: clears); C clears.

// phone-core AppFactory ctx — app chaining:
type AppFactory = (ctx: { exit(): void; open(appId: string): void }) => PhoneApp;
// open() = exit this app and immediately launch `appId` on the same nav stack.

// phone-core EditorOptions — options menu + limit:
interface EditorOptions {
  title: string; initial?: string; charLimit?: number;
  onAccept?: (text: string) => void;                 // legacy: navi accepts (no menu)
  menu?: { id: string; label: string }[];            // navi opens Options list instead
  onMenu?: (id: string, text: string, ctx: { exit(): void; open(appId: string): void }) => void;
}
```

`modelUrl`-style website knobs: `website/src/content/contacts.ts` shape:

```ts
export interface Contact {
  id: string; // kebab, stable — thread key
  name: string; // list label + chat nickname
  system: string; // persona system prompt (told: reply like an SMS, ≤160 chars,
  // stay in character, never reveal being an AI unless asked)
  canned: string[]; // no-API-key fallback replies, cycled per thread
}
```

## The server route (Task 7 reference)

`POST /api/sms` (TanStack Start server handler, same pattern as `sitemap.xml.ts`), body
`{ contactId: string, text: string }`. Server loads the thread history from the request
body (`history: {who:"me"|"them"; text:string}[]`, client-supplied, capped server-side).

- Validate: known `contactId`; `text.length <= 160`; `history` capped to last **12**
  entries; reject others with 400. Soft per-instance rate limit: in-memory
  `Map<ip, timestamps>` allowing ≤ 10 requests/min (best-effort on serverless — fine).
- With `ANTHROPIC_API_KEY` set (Vercel env var — see `docs/content-handoff.md`):

  ```ts
  import Anthropic from "@anthropic-ai/sdk"; // new website dependency (this plan adds it)
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 120,
    system: `${contact.system}\nReply as one SMS: plain text, max 160 characters.`,
    messages: [
      ...history.map(
        (m) => ({ role: m.who === "me" ? "user" : "assistant", content: m.text }) as const,
      ),
      { role: "user", content: text },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  reply = (block?.text ?? "").slice(0, 160) || contact.canned[0];
  ```

- Without a key (or on any API error): return the next canned reply — never a 5xx to the
  handset. Response: `{ reply: string }`.
- Cost note: ~400 input + ~60 output tokens per exchange on `claude-haiku-4-5`
  ($1/$5 per MTok) ≈ $0.0007 — no budget concern at portfolio traffic.

## Conventions for every task

- Repo root; `mise exec --` prefix. After each task: `mise exec -- vp check --fix` +
  the named test command. TDD where a failing test is specified.
- Contract-touching tasks update VISION.md **first** (Task 1 does it all at once).
- Commit per task: `feat(phone-core): …` / `feat(phone-screen): …` / `feat(website): …`.

## Tasks

### Task 1 — VISION.md contract updates

- [x] Apply every change in "Contract changes" above to VISION.md's contract blocks.
- [x] Commit: `docs: messaging contract additions (editor menu, notice, lazy lists, ctx.open)`

### Task 2 — phone-core: editor Options menu + char limit (TDD)

- [x] Failing tests in `packages/phone-core/tests/editor.test.ts`: with
      `menu: [{id:"send",label:"Send"},{id:"clear",label:"Clear text"},{id:"exit",label:"Exit"}]`,
      pressing navi renders `{kind:"list", title:"Options", …}` over the draft (draft
      preserved); up/down move; navi on `Send` calls `onMenu("send", draft, ctx)`; C
      closes Options back to the editor; `clear` empties the text; `exit` calls
      `ctx.exit()`. With `charLimit: 160` the editor ScreenModel carries `limit: 160`
      and input beyond the limit is ignored. Without `menu`, legacy `onAccept` behavior
      is unchanged (regression guard for the welcome-note editor).
- [x] Implement in `packages/phone-core/src/editor.ts`.
- [x] `mise exec -- vp run @hellotimber/phone-core#test` green.
- [x] Commit: `feat(phone-core): editor options menu + character limit`

### Task 3 — phone-core: lazy list items, setNotice, ctx.open (TDD)

- [x] Failing tests: (a) a list node with `items: () => [...]` re-reads the thunk on
      every render (mutate backing array → next render reflects it; selection clamps if
      the list shrinks); (b) `phone.setNotice({text:"1 message received", softkey:"Read",
path:"menu/messages/inbox"})` → standby screen carries `notice`; navi while
      noticed navigates to the path and clears it; C clears in place; `setNotice(null)`
      clears; notice survives menu round-trips (it's standby state, not screen state);
      (c) an app calling `ctx.open("other")` exits and the `other` app's `render()` is
      live next tick, on the same nav stack (C from it pops to where the first app was
      launched).
- [x] Implement in `packages/phone-core/src/machine.ts` (+ `types.ts`).
- [x] `mise exec -- vp run @hellotimber/phone-core#test` green.
- [x] Commit: `feat(phone-core): lazy list items, standby notice, app chaining`

> **Deviation:** widening the `AppFactory` ctx made two ctx object literals in
> `website/tests/snake-app.test.ts` fail typecheck; added a no-op `open` to each
> (minimal website-side accommodation only — no Task 5–10 features). `ctx.open()` is
> a voluntary handoff like `ctx.exit()` (no `onExit`), keeps the launching node's
> path, and is a no-op for unregistered appIds.

### Task 4 — phone-screen: countdown + notice rendering (TDD)

- [x] Failing tests in `packages/phone-screen/tests/`: editor screens with
      `limit: 160` and 12 chars of text render `148` right-aligned on the top row next
      to the mode indicator (spec §2: counter + `Abc`/`123` sit top-right; counter =
      `limit - text.length`); standby with `notice` renders the **envelope icon**
      (already in `src/icons`) + the notice text in the content area and the notice
      `softkey` as the softkey label (replacing `Menu`).
- [x] Implement in `packages/phone-screen/src/render/editor.ts` + `render/standby.ts`.
- [x] `mise exec -- vp run @hellotimber/phone-screen#test` green.
- [x] Commit: `feat(phone-screen): SMS countdown + message-received standby notice`

> **Deviation:** while noticed, the standby render suppresses the carrier line and the
> clock (the notice + envelope take over the content area, matching the real phone's
> message-received screen); signal/battery bars stay.

### Task 5 — website: contact personas

- [x] Write `website/src/content/contacts.ts` with the `Contact` interface above and
      3–4 SAMPLE personas (flagged `// SAMPLE DATA` like the other content modules):
      `lachlan` (the portfolio owner — friendly, plugs real projects; used by Chat),
      plus e.g. `recruiter-rachel` and `y2k-support` for flavor. Every `canned` entry
      ≤160 chars. Each persona's `system` states: in-character, SMS style, ≤160 chars,
      it's the year 2000 and this is a Nokia 3310.
- [x] Test in `website/tests/contacts.test.ts`: ids kebab + unique; canned non-empty,
      all ≤160; every persona `system` mentions the 160 limit.
- [x] Add the new contacts to the Phone book → Search list and to the handoff doc's
      sample-data checklist (`docs/content-handoff.md`).
- [x] `mise exec -- vp run website#test` green.
- [x] Commit: `feat(website): LLM contact personas (sample data)`

> **Deviation:** the menu-tree test "standby ▲ reaches the phone book name list"
> asserted the Search list equals exactly the phonebook labels; it now asserts
> phonebook labels + persona names (toMatchObject requires exact array length).
> Also exported a `contactById(id)` helper from contacts.ts (used by Tasks 6–8).

### Task 6 — website: message store

- [ ] Write `website/src/messages/store.ts`: state
      `{ threads: Record<contactId, { who: "me"|"them"; text: string; at: number }[]>, unread: number }`;
      API `sendRecorded(contactId, text)`, `receiveRecorded(contactId, text)`,
      `markAllRead()`, `inboxItems()` / `outboxItems()` (newest first, mapped to
      `{id,label,body}` items for the tree's lazy lists — label = contact name + first
      words, body = full text + timestamp line), `subscribe(cb)`. Persist to
      localStorage `hellotimber.messages` (same pattern as `settings.ts`); seed Inbox
      from the existing `content/messages.ts` sample inbox on first run.
- [ ] Tests: persistence round-trip (mock storage), inbox/outbox item mapping, unread
      counting, seeding happens exactly once.
- [ ] Wire the tree (from plan 07): `messages/inbox` and `messages/outbox` list nodes
      get `items: () => inboxItems() / outboxItems()`.
- [ ] `mise exec -- vp run website#test` green.
- [ ] Commit: `feat(website): message store with persisted threads`

### Task 7 — website: `/api/sms` server route

- [ ] Add `@anthropic-ai/sdk` to `website/package.json` dependencies (pin via
      `pnpm-workspace.yaml` catalog if a second consumer ever appears; plain dep for now)
      — `mise exec -- vp install`. **This is the one new dependency this plan adds.**
- [ ] Write `website/src/routes/api/sms.ts` per "The server route" above, with the LLM
      call in a small injectable `generateReply(deps, contact, history, text)` exported
      for tests.
- [ ] Tests (`website/tests/sms-api.test.ts`, node env): validation rejections (unknown
      contact, >160 text, oversized history), canned fallback when the client factory
      returns null (no key) and when the SDK call throws, reply truncation to 160,
      history mapped to alternating roles with the new text last.
- [ ] `mise exec -- vp run website#test` green; `mise exec -- vp run website#build` green.
- [ ] Commit: `feat(website): /api/sms — claude-haiku-4-5 contact replies with canned fallback`

### Task 8 — website: the SMS flow apps

- [ ] Write `website/src/phone/apps/sms.ts` registering the three apps below in
      `buildApps()`.
- [ ] **`write-message`** (replaces the current bare editor registration): the Task 2
      editor with `charLimit: 160`, `menu: [Send, Clear text, Exit]`; `onMenu("send")`
      stashes the draft and `ctx.open("sms-to")`.
- [ ] **`sms-to`**: picker over `contacts` titled `To:`; on pick, stash the contact and
      `ctx.open("sms-sending")`; C backs out to the editor (draft intact —
      `ctx.open("write-message")` with the stashed draft as `initial`).
- [ ] **`sms-sending`**: renders `{kind:"confirm", text:"Sending message", softkey:""}`
      for ~1.2 s of ticks, then `"Message sent"` for ~0.8 s, then exits. On entry it
      fires the actual send: `sendRecorded(...)` → `fetch("/api/sms")` → after a
      2–8 s randomized delay, `receiveRecorded(...)`, play the message-alert tone
      (existing `website/src/phone/audio.ts`, respecting settings/mute), and
      `phone.setNotice({ text: "1 message received", softkey: "Read", path:
"menu/messages/inbox" })`. Failures still deliver the canned reply (the API never
      5xxs by design; network errors fall back client-side too).
- [ ] Tests: drive a real phone through compose → Options → Send → To: → sending →
      sent (fake timers, fetch mocked); assert outbox + inbox items, the notice, and
      that navi-on-notice lands the phone at `menu/messages/inbox`.
- [ ] `mise exec -- vp run website#test` green.
- [ ] Commit: `feat(website): full Write-messages → To: → sending → reply flow`

### Task 9 — website: Chat (Menu 3) goes live

- [ ] Write `website/src/phone/apps/chat.ts`: the `chat` tree node becomes
      `{type:"app", appId:"chat"}`. The app renders the `lachlan` thread as a scrollable
      reader-style screen titled with the nickname, lines prefixed `>` (them) / `<` (me)
      per spec §5 Menu 3; seed the thread from the existing testimonial `chat` content
      lines on first run; navi = `Write` → `ctx.open("chat-compose")` (editor,
      `charLimit: 160`, menu `[Send, Exit]`) → send via the same `/api/sms` path to the
      `lachlan` persona; the reply appends to the thread (no standby notice needed —
      you're in the session; play the alert tone only).
- [ ] Tests: seeding, `>`/`<` prefixing, compose→send→reply appends in order.
- [ ] Update the chat panel (plan 07 registry) copy to explain the live chat.
- [ ] `mise exec -- vp run website#test` green.
- [ ] Commit: `feat(website): live Chat session backed by the lachlan persona`

### Task 10 — end-to-end verification + docs

- [ ] `mise exec -- vp run website#dev` (no `ANTHROPIC_API_KEY` → canned mode) and in a
      real browser (headed for WebGL; the `[role=status]` mirror also narrates): compose
      via keyboard multi-tap, counter counts down from 160, Options → Send → To: →
      pick a contact → "Sending message" → "Message sent" → Outbox shows it → within
      ~8 s the alert beeps, standby (hold-Escape) shows envelope + "1 message received" + `Read`; Enter opens Inbox; the reply reads correctly; reload → threads persist.
      Then Chat: `>`/`<` transcript, Write → send → reply appends.
- [ ] With a real key in `.env` (`ANTHROPIC_API_KEY=…`), repeat one exchange and confirm
      an in-character LLM reply ≤160 chars. Add the env var to the Vercel project
      (documented in `docs/content-handoff.md` — already noted).
- [ ] Update `docs/plans/README.md` status for plan 08 → done.
- [ ] Commit: `feat(website): verify SMS + chat end to end; mark plan 08 done`

## Done means

All 10 tasks committed; `vp run -r test`, `vp run website#build`, `vp check --fix` green;
phone-core/phone-screen tests pass standalone with **zero** SMS/network/website concepts
in them (only the generic contract features); the handset flow matches spec §5 Menu 2/3
labels and §2 counter/envelope placement; the site is fully usable with no API key.
