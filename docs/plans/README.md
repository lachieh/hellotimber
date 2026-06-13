# Implementation Plans

Each plan is self-contained: an agent assigned a task needs only `AGENTS.md`,
`VISION.md`, the plan file, and (for phone behavior) `docs/specs/nokia-3310.md`.

> **For agentic workers:** execute plans task-by-task (one task = one agent
> assignment). Tasks use checkbox syntax — tick steps as you complete them and commit
> per task. If a plan contradicts the code or a contract in `VISION.md`, stop and
> report; do not improvise.

| #   | Plan                                       | Builds                                | Depends on                   | Status      |
| --- | ------------------------------------------ | ------------------------------------- | ---------------------------- | ----------- |
| 01  | [phone-core](./01-phone-core.md)           | `@hellotimber/phone-core`             | —                            | not started |
| 02  | [phone-screen](./02-phone-screen.md)       | `@hellotimber/phone-screen`           | — (types from 01)            | not started |
| 03  | [phone-3d](./03-phone-3d.md)               | `@hellotimber/phone-3d`               | —                            | done        |
| 04  | [snake](./04-snake.md)                     | `@hellotimber/snake`                  | —                            | done        |
| 05  | [website shell](./05-website-shell.md)     | routes + router⇄phone bridge          | 01, 02, 03                   | not started |
| 06  | [content & polish](./06-content-polish.md) | portfolio content, sound, SEO, deploy | 05 (04 for Snake menu entry) | not started |

Plans 01–04 are parallel-safe: no shared files, no cross-package imports at runtime
(02 imports types from 01, which exist from 01's first task).

**Update the Status column** (not started → in progress → done) as part of finishing
a task batch.
