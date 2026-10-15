# Implementation Plans

Each plan is self-contained: an agent assigned a task needs only `AGENTS.md`,
`VISION.md`, the plan file, and (for phone behavior) `docs/specs/nokia-3310.md`.

> **For agentic workers:** execute plans task-by-task (one task = one agent
> assignment). Tasks use checkbox syntax — tick steps as you complete them and commit
> per task. If a plan contradicts the code or a contract in `VISION.md`, stop and
> report; do not improvise.

| #   | Plan                                                                            | Builds                                                                                                | Depends on                                | Status      |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| 01  | [phone-core](./01-phone-core.md)                                                | `@hellotimber/phone-core`                                                                             | —                                         | done        |
| 02  | [phone-screen](./02-phone-screen.md)                                            | `@hellotimber/phone-screen`                                                                           | — (types from 01)                         | done        |
| 03  | [phone-3d](./03-phone-3d.md)                                                    | `@hellotimber/phone-3d`                                                                               | —                                         | done        |
| 04  | [snake](./04-snake.md)                                                          | `@hellotimber/snake`                                                                                  | —                                         | done        |
| 05  | [website shell](./05-website-shell.md)                                          | routes + router⇄phone bridge                                                                          | 01, 02, 03                                | done        |
| 06  | [content & polish](./06-content-polish.md)                                      | portfolio content, sound, SEO, deploy                                                                 | 05 (04 for Snake menu entry)              | done        |
| 07  | [data-driven menu](./07-data-driven-menu.md)                                    | one menu tree as data; tree-resolved routing (fixes the SIM-services 404 hijack)                      | 01–06                                     | done        |
| 08  | [messaging](./08-messaging.md)                                                  | authentic SMS + Chat backed by LLM contacts (claude-haiku-4-5)                                        | 07                                        | done        |
| 09  | [phone model v2](./09-phone-model-v2.md)                                        | procedural 3310: per-key backlight, depress, no glTF                                                  | — (see plan header re Task 9)             | done        |
| 10  | [phone model v3](./10-phone-model-v3-sourced.md)                                | sourced CGTrader mesh (17 named key nodes) replaces the procedural model                              | 09                                        | done        |
| 11  | [object menu model](./11-object-menu-model.md)                                  | immutable OO menu graph, object applications, working Calculator                                      | 01-10                                     | done        |
| 12  | [LCD pixel authenticity](./12-lcd-pixel-authenticity.md)                        | reference standby/menu pixels + visible hierarchical shortcuts                                        | 01-11                                     | done        |
| 13  | [Nokia OS foundation](./13-nokia-os-foundation.md)                              | `@hellotimber/nokia-os`: stock v6.39 firmware, painter and LCD goldens                                | 01-12                                     | done        |
| 14  | [menu tree depth](./14-menu-depth-and-stock-widgets.md)                         | whole v6.39 menu tree incl. game menus; stock widgets; rows window; settings store                    | 13                                        | done        |
| 15  | [storage and settings](./15-storage-and-settings.md)                            | host storage port, EEPROM records, security code, boot gates, factory restore                         | 13, 14                                    | done        |
| 16  | [Tones and sound](./16-tones-and-sound.md)                                      | sound port, sequencer; keypad, warning, game tones; tone previews (Composer: 27)                      | 13, 14, 15, 23                            | done        |
| 17  | [Profiles](./17-profiles.md)                                                    | Activate, active profile behind Tones, standby name and icon, power-key list, Rename                  | 15, 16 (18 for Rename)                    | done        |
| 18  | [Messages I: text entry and SMS](./18-messages-and-chat.md)                     | multi-tap entry, editor/prompts, Welcome note, Write/Send/Save, Inbox/Outbox, network port            | 14, 15                                    | in progress |
| 18b | [Messages II: T9](./18b-t9-predictive-text.md)                                  | T9 predictive text, open-list English dictionary, Matches, Insert word, user words                    | 18                                        | not started |
| 18c | [Messages III: Chat and content](./18c-chat-templates-pictures-info-service.md) | stock T9 Chat, Templates/Smileys, pictures/gallery, Info topics, Service command editor, card receipt | 18, 18b (19 for Search/cards; 17 gallery) | not started |
| 19  | [Phone book](./19-phone-book.md)                                                | SIM card port, standby ▼ name list, Search, Add/Edit/Erase, tones, b'card, Speed dials                | 14, 15, 16, 18                            | not started |
| 20  | [Calculator](./20-calculator.md)                                                | stock calculator: entry, `*` operators, Options, 9-character arithmetic, exchange rate                | 14, 15, 16                                | in progress |
| 21  | [Clock and Reminders](./21-clock-and-reminders.md)                              | clock and date settings, alarm and wake, stopwatch, countdown, reminders; alert seams                 | 14, 15, 16, 18 (17 seams)                 | not started |
| 22  | [Calls I](./22-call-register-divert-and-dialling.md)                            | standby number entry, DTMF, calls in and out, call lists, durations, network call port                | 14, 15, 16, 23 (17-21 seams)              | not started |
| 22b | Calls II: services and costs                                                    | Call divert, Call waiting, SS/USSD at standby, redial, own number, call costs                         | 22                                        | not started |
| 23  | [Games I: Snake II](./23-games-snake-ii.md)                                     | Snake II gameplay and the scores it writes (menu, widgets: 14)                                        | 14 (15 for persistence)                   | done        |
| 24  | [Games II](./24-games-space-impact-bantumi-pairs.md)                            | Space impact (8 levels, seeds, scores) and the shared game seams 24b/24c build on                     | 14, 15, 16, 23                            | not started |
| 24b | Games III: Bantumi                                                              | Bantumi against the phone (deterministic search), 5-bar Level page, endings                           | 24 (Tasks 1-3)                            | not started |
| 24c | Games IV: Pairs II                                                              | Time trial and Puzzle: seeded boards, 7-bar Level pages, two top scores                               | 24 (Tasks 1-3)                            | not started |
| 25  | [Keyguard and backlight](./25-keyguard-and-backlight.md)                        | keyguard, LEDs on the light tick, host lights port, phone-3d keypad light and LCD look                | 13, 14, 15, 16, 23                        | not started |
| 26  | Languages                                                                       | Русский, Български, Українська UI (Cyrillic screens and notes)                                        | 14, 15                                    | not started |
| 27  | [Composer](./27-composer.md)                                                    | Tones › Composer: note editor, Play, Tempo, Save; saved tones as Ringing tones 36-42                  | 16, 18 (17 label seam)                    | not started |
| 28  | [Game SDK and user games](./28-game-sdk-and-user-games.md)                      | game SDK, shell services, 2048, sandboxed user JS/Wasm games, extra games in Games                    | 13, 14, 15, 16, 23                        | not started |

Plans 01–04 are parallel-safe: no shared files, no cross-package imports at runtime
(02 imports types from 01, which exist from 01's first task). Plan 09 is parallel-safe
with 07/08 except its final website task; 08 strictly follows 07.

Plans 14-25 are the follow-ups listed in plan 13 ("Follow-up plans"); their files are written
when they are scheduled. Portfolio integration of `@hellotimber/nokia-os` is not sequenced.

**Update the Status column** (not started → in progress → done) as part of finishing
a task batch.
