# Implementation Plans

Each plan is self-contained: an agent assigned a task needs only `AGENTS.md`,
`VISION.md`, the plan file, and (for phone behavior) `docs/specs/nokia-3310.md`.

> **For agentic workers:** execute plans task-by-task (one task = one agent
> assignment). Tasks use checkbox syntax — tick steps as you complete them and commit
> per task. If a plan contradicts the code or a contract in `VISION.md`, stop and
> report; do not improvise.

| #   | Plan                                                     | Builds                                                                           | Depends on                    | Status      |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- | ----------- |
| 01  | [phone-core](./01-phone-core.md)                         | `@hellotimber/phone-core`                                                        | —                             | done        |
| 02  | [phone-screen](./02-phone-screen.md)                     | `@hellotimber/phone-screen`                                                      | — (types from 01)             | done        |
| 03  | [phone-3d](./03-phone-3d.md)                             | `@hellotimber/phone-3d`                                                          | —                             | done        |
| 04  | [snake](./04-snake.md)                                   | `@hellotimber/snake`                                                             | —                             | done        |
| 05  | [website shell](./05-website-shell.md)                   | routes + router⇄phone bridge                                                     | 01, 02, 03                    | done        |
| 06  | [content & polish](./06-content-polish.md)               | portfolio content, sound, SEO, deploy                                            | 05 (04 for Snake menu entry)  | done        |
| 07  | [data-driven menu](./07-data-driven-menu.md)             | one menu tree as data; tree-resolved routing (fixes the SIM-services 404 hijack) | 01–06                         | done        |
| 08  | [messaging](./08-messaging.md)                           | authentic SMS + Chat backed by LLM contacts (claude-haiku-4-5)                   | 07                            | done        |
| 09  | [phone model v2](./09-phone-model-v2.md)                 | procedural 3310: per-key backlight, depress, no glTF                             | — (see plan header re Task 9) | done        |
| 10  | [phone model v3](./10-phone-model-v3-sourced.md)         | sourced CGTrader mesh (17 named key nodes) replaces the procedural model         | 09                            | done        |
| 11  | [object menu model](./11-object-menu-model.md)           | immutable OO menu graph, object applications, working Calculator                 | 01-10                         | done        |
| 12  | [LCD pixel authenticity](./12-lcd-pixel-authenticity.md) | reference standby/menu pixels + visible hierarchical shortcuts                   | 01-11                         | done        |
| 13  | [Nokia OS foundation](./13-nokia-os-foundation.md)       | `@hellotimber/nokia-os`: stock v6.39 firmware, painter and LCD goldens           | 01-12                         | in progress |

Plans 01–04 are parallel-safe: no shared files, no cross-package imports at runtime
(02 imports types from 01, which exist from 01's first task). Plan 09 is parallel-safe
with 07/08 except its final website task; 08 strictly follows 07.

**Update the Status column** (not started → in progress → done) as part of finishing
a task batch.
