# Implementation Plans

Each plan is self-contained: an agent assigned a task needs only `AGENTS.md`,
`VISION.md`, the plan file, and (for phone behavior) `docs/specs/nokia-3310.md`.

> **For agentic workers:** execute plans task-by-task (one task = one agent
> assignment). Tasks use checkbox syntax — tick steps as you complete them and commit
> per task. If a plan contradicts the code or a contract in `VISION.md`, stop and
> report; do not improvise.

| #   | Plan                                                     | Builds                                                                             | Depends on                    | Status      |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- | ----------- |
| 01  | [phone-core](./01-phone-core.md)                         | `@hellotimber/phone-core`                                                          | —                             | done        |
| 02  | [phone-screen](./02-phone-screen.md)                     | `@hellotimber/phone-screen`                                                        | — (types from 01)             | done        |
| 03  | [phone-3d](./03-phone-3d.md)                             | `@hellotimber/phone-3d`                                                            | —                             | done        |
| 04  | [snake](./04-snake.md)                                   | `@hellotimber/snake`                                                               | —                             | done        |
| 05  | [website shell](./05-website-shell.md)                   | routes + router⇄phone bridge                                                       | 01, 02, 03                    | done        |
| 06  | [content & polish](./06-content-polish.md)               | portfolio content, sound, SEO, deploy                                              | 05 (04 for Snake menu entry)  | done        |
| 07  | [data-driven menu](./07-data-driven-menu.md)             | one menu tree as data; tree-resolved routing (fixes the SIM-services 404 hijack)   | 01–06                         | done        |
| 08  | [messaging](./08-messaging.md)                           | authentic SMS + Chat backed by LLM contacts (claude-haiku-4-5)                     | 07                            | done        |
| 09  | [phone model v2](./09-phone-model-v2.md)                 | procedural 3310: per-key backlight, depress, no glTF                               | — (see plan header re Task 9) | done        |
| 10  | [phone model v3](./10-phone-model-v3-sourced.md)         | sourced CGTrader mesh (17 named key nodes) replaces the procedural model           | 09                            | done        |
| 11  | [object menu model](./11-object-menu-model.md)           | immutable OO menu graph, object applications, working Calculator                   | 01-10                         | done        |
| 12  | [LCD pixel authenticity](./12-lcd-pixel-authenticity.md) | reference standby/menu pixels + visible hierarchical shortcuts                     | 01-11                         | done        |
| 13  | [Nokia OS foundation](./13-nokia-os-foundation.md)       | `@hellotimber/nokia-os`: stock v6.39 firmware, painter and LCD goldens             | 01-12                         | done        |
| 14  | [menu tree depth](./14-menu-depth-and-stock-widgets.md)  | whole v6.39 menu tree incl. game menus; stock widgets; rows window; settings store | 13                            | done        |
| 15  | [storage and settings](./15-storage-and-settings.md)     | host storage port, EEPROM records, security code, boot gates, factory restore      | 13, 14                        | not started |
| 16  | Tones and sound sequencer                                | tone sequencer, keypad/warning tones, ringing tones, Composer                      | 13, 15                        | not started |
| 17  | Profiles                                                 | profile activation and personalisation; power-key profile list                     | 15, 16                        | not started |
| 18  | Messages and Chat                                        | stock text entry, messages, Chat (`menu/03-chat.sub` asserted)                     | 14, 15                        | not started |
| 19  | Phone book                                               | SIM/phone memory, Search, Add name, Edit, Erase, Speed dials                       | 14, 15                        | not started |
| 20  | Calculator restyle                                       | stock calculator screens (`menu/09-calculator.sub` asserted)                       | 14                            | not started |
| 21  | Clock and Reminders                                      | alarm, clock/date settings, stopwatch, countdown, reminders                        | 14, 15                        | not started |
| 22  | Call register and Call divert                            | standby number entry and dialling; call lists, durations and costs, divert flows   | 14, 15                        | not started |
| 23  | [Games I: Snake II](./23-games-snake-ii.md)              | Snake II gameplay and the scores it writes (menu, widgets: 14)                     | 14 (15 for persistence)       | in progress |
| 24  | Games II: Space Impact, Bantumi, Pairs II                | gameplay and the scores it writes (menus: 14)                                      | 14                            | not started |
| 25  | Keyguard and backlight                                   | keyguard, backlight/keypad LED timing, phone-3d signal                             | 13                            | not started |

Plans 01–04 are parallel-safe: no shared files, no cross-package imports at runtime
(02 imports types from 01, which exist from 01's first task). Plan 09 is parallel-safe
with 07/08 except its final website task; 08 strictly follows 07.

Plans 14-25 are the follow-ups listed in plan 13 ("Follow-up plans"); their files are written
when they are scheduled. Portfolio integration of `@hellotimber/nokia-os` is not sequenced.

**Update the Status column** (not started → in progress → done) as part of finishing
a task batch.
