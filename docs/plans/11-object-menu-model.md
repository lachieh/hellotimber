# Plan 11 - Object-oriented menu model and native Calculator

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 01-10 complete.
**Ground truth:** `docs/specs/nokia-3310.md` sections 5-6 and Calculator in section 5.
**Status:** done.

## Goal

Replace the duplicated, stringly menu representation with one immutable object model
owned by `@hellotimber/phone-core`. The same `PhoneMenu<WebMetadata>` object graph must
drive firmware navigation, URL resolution, sitemap generation, HTML panels, SEO metadata,
and application launch.

The model must make these concepts explicit:

- nested menu levels;
- one-based menu order (the Nokia menu number and shortcut position);
- URL slug, separate from application identity and graphic identity;
- a required graphic on top-level entries only;
- standard reader/list/action behavior as concrete menu-entry classes;
- non-standard behavior as reusable `PhoneApplication` definition objects;
- a fresh `PhoneApplicationSession` for every launch;
- complete Calculator behavior for Menu 9.

This is a public-contract rewrite. Update `VISION.md` before implementation. Do not keep
the old `MenuNode`/`appId`/`apps` API as permanent compatibility surface: all consumers are
inside this monorepo and migrate in this plan.

## Why this plan exists

The current tree solved routing drift in plan 07, but its representation now has several
sources of accidental complexity:

1. `MenuNode` in phone-core and `SiteNode` in the website duplicate the same union.
2. `id` simultaneously means identity, URL slug, path segment, React key, and default icon.
3. Array position silently controls menu order, display number, and digit shortcuts.
4. `iconId` is legal only on submenu DTOs, although every top-level entry needs a graphic.
5. App menu entries contain an `appId` string, while factories live in a separate string
   registry. Calculator demonstrates the failure mode: it is declared as an app but has no
   factory, so selecting it is a silent no-op.
6. SMS and Chat expose internal transition IDs (`sms-to`, `sms-sending`, `chat-compose`) in
   the global app registry even though those stages belong to one application flow.
7. Core and website each implement recursive path traversal, and tests repeat it again.
8. `web.panel` is an untyped string; a typo silently falls back to `GenericPanel`.

The fix is not "more builders around the same DTO." The fix is an immutable domain model
with explicit invariants and behavior boundaries.

## Accepted decisions

These decisions were confirmed before this plan was written:

1. The OO model is the public phone-core model, not a website-only authoring adapter.
2. Dedicated application classes represent behavior families. Ordinary category containers
   remain standard submenus: Games is a `SubmenuEntry`; Snake is a `SnakeApplication`.
   Messages is a `SubmenuEntry`; Write messages is an `SmsApplication`.
3. Calculator becomes a working application in this plan rather than a placeholder.
4. `ScreenModel` remains a plain discriminated union. OOP stops before the rendering seam.
5. Existing URL slugs and menu ordering do not change.
6. No new dependency is required.

## Package boundaries (unchanged)

```
website ---------------------> phone-core
   |                              |
   |                              | ScreenModel types only
   +--------------------------> phone-screen
   |
   +--------------------------> phone-3d
   |
   +--------------------------> snake
```

- phone-core stays pure TypeScript: no DOM, React, TanStack, website, phone-screen runtime,
  localStorage, timers, or network imports.
- phone-core carries website metadata only as opaque generic data.
- concrete SMS, Chat, Snake, picker, and Calculator definitions live in `website/src/phone`.
- phone-screen still receives only `ScreenModel` DTOs and has no runtime dependency on the
  menu classes or application definitions.
- only the website composes content, applications, router, storage, network, audio, and UI.

## Target architecture

```
PhoneMenu<WebMetadata>                         aggregate root
|
+-- TopLevelEntry<WebMetadata>[]               carousel slots; graphic required
|   |
|   +-- entry: MenuEntry<WebMetadata>           semantic entry; owns slug/order/label
|       |
|       +-- SubmenuEntry                       owns MenuLevel children
|       +-- ListEntry                          owns MenuListSource
|       +-- ReaderEntry                        owns reader body
|       +-- ActionEntry                        owns host action DTO
|       +-- ApplicationEntry                   owns PhoneApplication definition
|
+-- resolve(path)                              core + router source of truth
+-- paths()                                    sitemap source of truth
+-- walk(visitor)                              exhaustive projections
+-- entries                                    canonical sorted, read-only topology
```

Application lifecycle:

```
ApplicationEntry
      |
      v
PhoneApplication (immutable reusable definition, safe at module/SSR scope)
      |
      | createSession(context) on every launch
      v
PhoneApplicationSession (mutable per-launch state)
      |
      +-- onKey(event)
      +-- tick(dtMs)
      +-- render() -> ScreenModel
      +-- onDeactivate(reason)?
```

Data flow:

```
website/src/content/menu.ts
        |
        | one PhoneMenu<WebMetadata> object graph
        |
        +--> phone-core Machine -----------------> ScreenModel
        |
        +--> resolve(path) ----------------------> route loader DTO
        |
        +--> paths() + metadata -----------------> sitemap / SEO
        |
        +--> resolved entry metadata ------------> HTML panel registry
```

The router and server must never receive class instances in loader data. Resolve against the
class graph on the server, then return a plain serializable projection (title, description,
indexing, panel ID, and slug chain).

## Core domain contract

Task 1 must put the final public contract in `VISION.md`. Names may be adjusted only if the
task discovers a concrete TypeScript constraint; any adjustment must update this plan and
VISION before code.

```ts
export class MenuSlug {
  readonly value: string;
  constructor(value: string); // kebab-case only
  toString(): string;
}

export class MenuOrder {
  readonly value: number;
  constructor(value: number); // positive integer, one-based
}

export class MenuGraphic {
  readonly id: string;
  constructor(id: string); // non-empty identifier; renderer registry key
}

export abstract class MenuEntry<Metadata = unknown> {
  readonly slug: MenuSlug;
  readonly order: MenuOrder;
  readonly label: string;
  readonly metadata: Metadata | undefined;

  abstract accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result;
}

export class SubmenuEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly children: MenuLevel<Metadata>;
}

export class ListEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly source: MenuListSource;
}

export class ReaderEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly body: string;
}

export class ActionEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly action: { kind: "href"; value: string };
}

export class ApplicationEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly application: PhoneApplication;
}

export interface MenuEntryVisitor<Metadata, Result> {
  visitSubmenu(entry: SubmenuEntry<Metadata>): Result;
  visitList(entry: ListEntry<Metadata>): Result;
  visitReader(entry: ReaderEntry<Metadata>): Result;
  visitAction(entry: ActionEntry<Metadata>): Result;
  visitApplication(entry: ApplicationEntry<Metadata>): Result;
}

export class MenuLevel<Metadata = unknown> implements Iterable<MenuEntry<Metadata>> {
  constructor(entries: readonly MenuEntry<Metadata>[]);
  readonly entries: readonly MenuEntry<Metadata>[]; // canonical order
  bySlug(slug: string): MenuEntry<Metadata> | undefined;
  byOrder(order: number): MenuEntry<Metadata> | undefined;
}

export class TopLevelEntry<Metadata = unknown> {
  readonly entry: MenuEntry<Metadata>;
  readonly graphic: MenuGraphic;
}

export class PhoneMenu<Metadata = unknown> {
  constructor(entries: readonly TopLevelEntry<Metadata>[]);
  readonly entries: readonly TopLevelEntry<Metadata>[];
  resolve(path: string): readonly MenuEntry<Metadata>[] | null;
  paths(): readonly string[];
  isValidPath(path: string): boolean;
  walk<Result>(visitor: MenuEntryVisitor<Metadata, Result>): readonly Result[];
}
```

### Model invariants

Construction fails immediately with a descriptive error when any invariant is broken:

- slug is empty, not kebab-case, or duplicated among siblings;
- order is not a positive integer, is duplicated, or sibling orders are not contiguous;
- label or graphic ID is empty;
- a top-level entry has no graphic;
- the same semantic entry object is reused in two locations;
- the topology contains a cycle;
- a static or dynamic list snapshot contains duplicate/invalid item IDs;
- an application entry has no application definition.

`MenuLevel` defensively copies and sorts its constructor input once. All downstream consumers
use this canonical order. Mutating the original input array after construction cannot change
the menu. Freeze only owned topology arrays/objects; metadata, application definitions, list
sources, and typed arrays are opaque dependencies and must not be recursively frozen.

The class hierarchy is intentionally closed. Consumers may implement visitors, but adding
new entry subclasses outside phone-core is unsupported because existing visitors could not be
exhaustive.

### Order and shortcuts

`MenuOrder` is the one source of truth for:

- carousel position and displayed menu number;
- submenu row order;
- digit shortcut lookup;
- parent selection restoration after deep-link navigation;
- generic HTML panel order;
- sitemap traversal order.

Preserve current shortcut semantics in this plan: one digit (1-9) selects one entry at each
level. Explicit orders 10-13 are displayed and traversed normally but are not direct digit
shortcut targets. The authentic ambiguity between top-level 11 and submenu 1-1 remains an
open spec question and is not guessed during this structural rewrite.

### Slugs and URLs

Menu-entry `id` becomes `slug`. Keep every existing value exactly:

```
phone-book, messages, chat, call-register, tones, settings, call-divert,
games, calculator, reminders, clock, profiles, sim-services
```

All existing nested slugs remain unchanged too. Paths stay:

```
standby | menu | menu/<slug>/<slug>/...
```

Application class names, application IDs, graphics, labels, and metadata never influence the
URL. App handoffs retain the original launching `ApplicationEntry`, nav stack, and path.

### Top-level graphics

`TopLevelEntry` is a presentation slot, not another semantic/path entry. It contributes only
the required `MenuGraphic` to carousel rendering. Traversal sees exactly one semantic entry
below each slot. Nested entries cannot carry a graphic. `ScreenModel` continues to expose the
graphic as the existing string `iconId`, so phone-screen and its icon registry do not change.

## Application contract and lifecycle

```ts
export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

export abstract class PhoneApplication {
  readonly id: string; // diagnostics/custom ScreenModel identity; never a URL segment
  abstract createSession(context: ApplicationContext): PhoneApplicationSession;
}

export interface ApplicationContext {
  exit(): void;
  open(application: PhoneApplication): void;
}

export interface PhoneApplicationSession {
  onKey(event: KeyEvent): void;
  tick(dtMs: number): void;
  render(): ScreenModel;
  onDeactivate?(reason: DeactivationReason): void;
}
```

Definitions are immutable and reusable. Sessions contain mutable per-launch state. A menu
imported by SSR may construct definitions, but definition constructors must not read browser
globals, start timers, subscribe, fetch, seed randomness, access storage, or create a game.
Those effects happen only in `createSession()` or through injected dependency ports.

The machine stores:

```ts
{
  origin: ApplicationEntry<unknown>;
  definition: PhoneApplication;
  session: PhoneApplicationSession;
  activationToken: object;
  stack: NavFrame[];
}
```

Each launch gets a unique token. `context.exit()` and `context.open()` verify that both the
session and token are still active. Closures from a stale async activation are permanent
no-ops and cannot exit or replace a later activation of the same definition.

`onDeactivate(reason)` runs at most once for every successfully created session:

- `exit`: `context.exit()` returns to the containing menu;
- `replace`: `context.open(otherDefinition)` performs an in-place app handoff;
- `navigate`: external `navigate()` or machine navigation leaves the app;
- `power-off`: power shuts the phone down.

If `createSession()` throws, the launching entry renders the existing `App error` reader and
the phone remains navigable. Exceptions from key, tick, render, or deactivation remain
contained; a bad app cannot break power or navigation.

`PhoneConfig` becomes:

```ts
export interface PhoneConfig<Metadata = unknown> {
  menu: PhoneMenu<Metadata>;
  carrier?: string;
  clock?: () => string | undefined;
  bootMs?: number;
}
```

Remove `MenuNode`, `AppFactory`, `PhoneApp`, `PhoneConfig.apps`, string `appId`, and string
`ctx.open(appId)` from the final public surface. Rename/update `EditorApplication` rather than
leaving `editorApp()` as a factory-shaped exception.

## List model

List rows are not menu entries and do not receive URL slugs or menu order. Preserve stable
row IDs through this separate interface:

```ts
export interface MenuListItem {
  id: string;
  label: string;
  body: string;
}

export interface MenuListSource {
  read(): readonly MenuListItem[];
}

export class StaticMenuListSource implements MenuListSource {
  /* defensive copy */
}
export class DynamicMenuListSource implements MenuListSource {
  /* injected reader */
}
```

Every `read()` is converted to an immutable snapshot and validated for unique non-empty IDs.
Navigation tracks the selected item ID plus its last index. If a live list prepends/reorders,
selection follows the ID. If that item disappears, clamp the previous index. Once a row is
opened, its reader retains that immutable snapshot until the user backs out; incoming message
changes must not rewrite the open reader beneath them. Automatic store subscriptions are not
added in this plan; current render/tick invalidation behavior is preserved.

## Website metadata

Core sees metadata only as `unknown`. The website defines:

```ts
export type PanelId =
  | "phone-book"
  | "messages"
  | "inbox"
  | "write"
  | "chat"
  | "call-register"
  | "tones"
  | "settings"
  | "call-divert"
  | "games"
  | "snake"
  | "calculator"
  | "reminders"
  | "clock"
  | "profiles"
  | "sim-services";

export type WebMetadata =
  | { indexing: "index"; description: string; panel?: PanelId }
  | { indexing: "noindex"; description?: string; panel?: PanelId };
```

`PANELS` must use `satisfies Record<PanelId, ComponentType<PanelProps>>`, so a missing or
misspelled bespoke panel is a type error. Metadata remains optional for valid stub paths;
missing metadata means generic panel plus noindex, matching current behavior.

## Concrete website applications

Concrete application definitions are grouped by behavior, not by menu category:

```
website/src/phone/applications/
|-- calculator.ts
|-- chat.ts
|-- editor.ts (only website configuration around core EditorApplication, if needed)
|-- picker.ts
|-- sms.ts
+-- snake.ts
```

- `SmsApplication` privately owns compose, recipient, and sending stage definitions. Draft
  and selected recipient belong to one flow object; internal stages are not globally named.
- `ChatApplication` privately owns session and compose stage definitions.
- `SnakeApplication` owns persistent game state at definition scope intentionally, while each
  activation session owns tick accumulation and transient input state.
- `PickerApplication` is reusable for keypad tones, ringing tone, screen saver, and lights.
- `EditorApplication` is the generic core implementation used by welcome note and SMS/Chat.
- `CalculatorApplication` is a native definition/session, described below.

Injected dependencies stay as ports. Async SMS replies may outlive the UI session and still
record/notify; stale application contexts may not navigate the phone after deactivation.

## Calculator behavior (Menu 9)

The Calculator is a single `ApplicationEntry` at slug `calculator`, order 9, graphic
`calculator`, path `menu/calculator`.

### Input and display

- Initial display is `0`.
- Digits append to the active operand; typing after a result starts a new calculation unless
  an operator was selected from that result.
- `#` inserts a decimal point. On an empty operand it produces `0.`. A second decimal point
  is ignored.
- `*` starts at `+`; consecutive `*` presses before another digit replace it with `-`, then
  `*`, then `/`, then cycle to `+`.
- Selecting an operator after a complete `left op right` expression evaluates that expression
  first and carries the result into the next operation.
- NaviKey opens `Options`: `Equals`, `Exchange rate`, `To home`, `To foreign`.
- `Equals` evaluates without `eval`. Currency options open a standard reader saying
  `Not available` and C returns to Options; currency conversion is not invented without an
  exchange-rate configuration requirement.
- Short C deletes the last digit/decimal of the active operand. C on an empty/default display
  exits to the carousel's Calculator position.
- Hold C for the existing core long-press threshold clears all calculator state to `0` and
  swallows that key release.
- C closes Options or the unavailable reader before affecting calculator input.
- The URL remains `menu/calculator` for input, Options, result, and unavailable readers.

### Arithmetic and errors

- Implement `+`, `-`, multiplication, and division with explicit functions; never `eval`.
- Division by zero and non-finite output show `Error`.
- At most 12 significant decimal digits are retained before display formatting. Strip trailing
  fractional zeros, normalize `-0` to `0`, and prevent JavaScript artifacts such as
  `0.30000000000000004`.
- The visible result must fit the calculator's defined display limit (14 characters including
  sign/decimal). Results that cannot fit show `Error`.
- Any digit after `Error` starts a fresh calculation; C clears it; other keys are safe no-ops
  or start a valid operator flow from zero.
- Equals consumes the current expression. Repeated Equals without new input is a no-op; do not
  guess repeated-operation behavior absent an authenticity source.
- Re-entering Calculator starts a fresh session at `0`; no persistence is required.

Render Calculator input/result with existing standard `ScreenModel` variants. Do not add a
calculator-specific renderer kind merely to satisfy the OO goal: behavior is the object;
screen output remains data.

## Compatibility and non-goals

- Keep every current URL, top-level label, child label, and menu order.
- Keep the 13 existing icon IDs and phone-screen bitmaps unchanged.
- Keep list rows non-routable.
- Keep app-internal states out of URLs.
- Keep router echo suppression unchanged.
- Do not add animated menu graphics.
- Do not implement currency conversion.
- Do not redesign panels or content copy beyond typing their IDs.
- Do not move Nokia-specific content into phone-core.
- Do not preserve old class/DTO aliases after all in-repo consumers migrate.

## Characterization and acceptance tests

Before changing behavior, add golden tests that pin:

```
Domain invariants
|-- slug/order/graphic validation
|-- canonical order at every level
|-- no cycles/reused entries
|-- defensive copies
+-- exhaustive visitors

Firmware parity
|-- all existing valid paths
|-- exact 13-menu order/labels/graphics
|-- submenu order/labels
|-- carousel/menu numbers
|-- one-digit-per-level shortcuts
|-- deep-link stack restoration
+-- action/list/reader behavior

Application lifecycle
|-- fresh session per launch
|-- independent sessions across two Phone instances
|-- same-path object handoff
|-- stale context no-op
|-- exactly-once deactivation reasons
+-- exception containment

Website integration
|-- SSR-safe menu import
|-- path/URL round trips
|-- sitemap/indexing parity
|-- complete typed panel registry
|-- route loader returns serializable DTOs
+-- no package-boundary imports

Calculator
|-- digits/decimal/operator cycling
|-- all four operations
|-- chaining and Equals
|-- C delete/exit/hold-clear
|-- Options/currency placeholders
|-- precision/overflow/divide-by-zero/Error recovery
+-- URL and back-stack behavior
```

## Conventions for every task

- Run from repo root with `mise exec --`.
- Write the failing test first wherever a task specifies TDD.
- After each task run `mise exec -- vp check --fix` plus the named test command.
- Contract-changing tasks must also run `mise exec -- vp run website#build` before commit.
- Never edit `website/src/routeTree.gen.ts` by hand.
- Do not add dependencies.
- Commit per task with the existing `feat(phone-core):`, `feat(website):`, `test:`, or
  `docs:` style.

## Tasks

### Task 1 - Public contracts and architecture documentation

**Files:** `VISION.md`, `packages/phone-core/README.md`, this plan if reality requires a
contract correction.

- [x] Update VISION's `MenuNode`, `PhoneApp`, `AppFactory`, and `PhoneConfig` blocks to the
      class contracts in this plan.
- [x] Document opaque generic metadata, top-level graphic slots, explicit order/slug,
      reusable application definitions, per-launch sessions, object-based handoff, activation
      tokens, and deactivation reasons.
- [x] Update architecture prose: the Nokia content graph remains website-owned, while the
      generic model classes are phone-core-owned.
- [x] Fix the already-stale phone-core README example that imports removed `nokia3310Menu`.
      Replace it with a minimal standalone `PhoneMenu` example.
- [x] Verify docs formatting: `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define object menu and application contracts`.

### Task 2 - Golden characterization tests before the rewrite

**Files:** existing phone-core tests, `website/tests/menu-tree.test.ts`,
`website/tests/site-tree.test.ts`, and a small fixture/snapshot file only if inline expected
values become unreadable.

- [x] Add tests that enumerate every current menu path, top-level graphic, label, sibling
      position, and indexable path in canonical order.
- [x] Pin path reconstruction and parent selection for deep links.
- [x] Pin current one-digit-per-level shortcut behavior, including explicit regression tests
      that orders 10-13 are not direct digit targets.
- [x] Pin app flow traces for SMS, Chat, Snake, picker, and editor: launch path, handoff path,
      exit destination, forced navigation, and power-off.
- [x] Pin exact current ScreenModel outputs for representative submenu, list, reader, action,
      app, and app-error states.
- [x] Run `mise exec -- vp run -r test` and expect PASS before structural code changes.
- [ ] Commit: `test: characterize menu paths and app lifecycle`.

### Task 3 - phone-core immutable menu domain (TDD)

**Files:** new `packages/phone-core/src/menu.ts`, update `src/index.ts`, new
`tests/menu-model.test.ts` and `tests/menu-types.test.ts`.

- [x] Write failing tests for `MenuSlug`, `MenuOrder`, `MenuGraphic`, every concrete entry,
      `MenuLevel`, `TopLevelEntry`, `PhoneMenu`, and visitor exhaustiveness.
- [x] Cover every invariant listed under "Model invariants," including cycles and reused entry
      instances across branches.
- [x] Prove constructor arrays are defensively copied and canonical ordering is used regardless
      of declaration order.
- [x] Prove `PhoneMenu<WebMetadata>` retains metadata types without `any` while heterogeneous
      application definitions coexist.
- [x] Implement the model in one module unless splitting becomes necessary for readability;
      do not create one tiny file per class.
- [x] Export the classes from the package barrel.
- [x] Keep the old DTO machine compiling during this additive task; no adapter is public API.
- [x] Run `mise exec -- vp run @hellotimber/phone-core#test`.
- [ ] Commit: `feat(phone-core): immutable object menu domain`.

### Task 4 - phone-core list sources and stable snapshots (TDD)

**Files:** `packages/phone-core/src/menu.ts`, `tests/menu-model.test.ts`.

- [x] Add failing tests for static/dynamic source validation, defensive snapshots, duplicate
      row IDs, and repeated dynamic reads.
- [x] Implement `StaticMenuListSource` and `DynamicMenuListSource`.
- [x] Keep this task additive. Machine selection/snapshot behavior changes during the vertical
      cutover in Task 7, where old and new representations cannot drift.
- [x] Do not add store subscriptions or browser concepts.
- [x] Run `mise exec -- vp run @hellotimber/phone-core#test`.
- [ ] Commit: `feat(phone-core): stable object-backed list sources`.

### Task 5 - Application definitions, sessions, and lifecycle (TDD)

**Files:** new `packages/phone-core/src/application.ts`, update `types.ts`, `editor.ts`,
`index.ts`, and direct application/editor tests.

- [x] Write failing direct tests for fresh sessions, object-based `open`, and the lifecycle
      contract. Machine activation-token/path/deactivation tests belong to the Task 7 cutover.
- [x] Implement `PhoneApplication`, `PhoneApplicationSession`, `ApplicationContext`, and
      `DeactivationReason`.
- [x] Replace `editorApp()` with `EditorApplication`, preserving all multi-tap behavior,
      Options behavior, character limits, and tests.
- [x] Keep the existing machine/app registry operational in this additive task. Do not add a
      second public registry API; the vertical machine cutover is Task 7.
- [x] Run `mise exec -- vp run @hellotimber/phone-core#test` and
      `mise exec -- vp run website#test`.
- [ ] Commit: `feat(phone-core): object application sessions and lifecycle`.

### Task 6 - Website application definitions and Calculator (TDD)

**Files:** create `website/src/phone/applications/`, migrate or replace files under
`website/src/phone/apps/`, update website app tests, add `website/tests/calculator-app.test.ts`.

- [x] Implement pure, SSR-safe application definition classes for picker, Snake, SMS, Chat,
      and website-configured editor use.
- [x] Encapsulate SMS/Chat internal stages as private application definitions; remove global
      knowledge of internal stage IDs from callers.
- [x] Preserve async reply behavior independently of UI-session deactivation while ensuring
      stale contexts cannot navigate.
- [x] Preserve intentional Snake game persistence at definition scope and transient tick state
      at session scope.
- [x] Write Calculator tests for every behavior in "Calculator behavior" before implementation.
- [x] Implement `CalculatorApplication` without `eval` and without a new ScreenModel kind.
- [x] Keep existing factory modules operational until Task 7, but do not duplicate their logic
      inside the new definitions: extract shared session logic where a temporary bridge is
      required. Calculator becomes live at the Task 7 vertical cutover.
- [x] Prove importing application definitions in node/SSR starts no effects and touches no
      browser globals.
- [x] Run `mise exec -- vp run website#test`, `mise exec -- vp run -r test`, and
      `mise exec -- vp run website#build`.
- [ ] Commit: `feat(website): object applications and Calculator session`.

### Task 7 - Vertical cutover to PhoneMenu (TDD/parity gate)

**Files:** `packages/phone-core/src/machine.ts`, `paths.ts`, `types.ts`, `index.ts`, all core
fixtures/tests; `website/src/content/menu.ts`, content types, `phone/phone.ts`, menu tests.

- [x] Rewrite core path resolution, stack building, carousel rendering, entry selection, and
      shortcut lookup against `PhoneMenu`/visitors and canonical `MenuOrder`.
- [x] Refactor app mode to retain origin entry, definition, session, activation token, and
      stack. Add machine tests for stale-context protection, independent Phone instances,
      same-path handoff, exactly-once deactivation reasons, and exception containment.
- [x] Update list/item frames to retain selected row ID plus fallback index; cover
      prepend/reorder stability, removal fallback, and open-reader snapshot stability.
- [x] Change `PhoneConfig.menu` to `PhoneMenu<Metadata>` and remove the factory registry from
      active machine code.
- [x] Build `siteMenu` as `PhoneMenu<WebMetadata>` using constructors with explicit slug/order
      on every entry and a graphic on each of the 13 top-level slots.
- [x] Reference concrete application definition objects directly from `ApplicationEntry`.
- [x] Port static lists to `StaticMenuListSource` and Inbox/Outbox to
      `DynamicMenuListSource`.
- [x] Preserve every golden path, label, order, icon, ScreenModel, and shortcut assertion from
      Task 2. Any parity break requires STOP/report unless it is the explicitly approved
      Calculator fix or lifecycle contract change.
- [x] Remove the Calculator exemption from `website/tests/menu-tree.test.ts`; selecting Menu 9
      must now launch `CalculatorApplication`.
- [x] Prove the full menu can be imported and traversed in a node environment.
- [x] Run `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- [ ] Commit: `feat(phone-core): run firmware on PhoneMenu object graph`.

### Task 8 - Router, SEO, and panel visitors

**Files:** replace `website/src/phone/site-tree.ts` with focused website projection helpers
only if needed; update dynamic route, SEO, sitemap, GenericPanel, panel props/registry, and
their tests.

- [x] Define `PanelId` and discriminated `WebMetadata`; type `PANELS` exhaustively.
- [x] Replace website recursive walkers with `PhoneMenu.resolve()`, `paths()`, and a metadata
      projection visitor. Do not duplicate tree traversal in website tests.
- [x] Make route loaders return plain serializable DTOs, never menu/application class objects.
- [x] Preserve `/menu` special handling, noindex behavior, canonical descriptions, generic
      stub panels, and SIM-services 404 behavior.
- [x] Assert all old sitemap/indexable paths are byte-for-byte unchanged and in canonical order.
- [x] Assert every valid path resolves and unknown paths still become real 404/standby fallback
      through the existing bridge behavior.
- [x] Run `mise exec -- vp run website#test` and `mise exec -- vp run website#build`.
- [ ] Commit: `feat(website): derive routes and panels from PhoneMenu visitors`.

### Task 9 - Remove the old DTO/registry architecture

**Files:** phone-core public types/paths/README/tests; website content types, `phone.ts`, old
app modules, old site-tree helpers, tests, and comments.

- [x] Delete `MenuNode`, `AppFactory`, `PhoneApp`, old path walkers over DTO arrays,
      `PhoneConfig.apps`, `buildApps()`, `APP_IDS`, string app IDs in menu content, and all
      temporary migration bridges.
- [x] Remove the duplicated `SiteNode` union and `toMenuNodes()` conversion.
- [x] Delete superseded app factory functions/files after all concrete definitions own their
      behavior.
- [x] Search the repo for `MenuNode|SiteNode|AppFactory|PhoneApp|appId|APP_IDS|toMenuNodes|buildApps`.
      Remaining hits must be intentional history in old plan files or updated migration prose;
      no active source/test/README references may remain.
- [x] Confirm phone-core has no forbidden runtime imports and still works standalone.
- [x] Run `mise exec -- vp run -r test`, `mise exec -- vp run website#build`, and
      `mise exec -- vp check --fix`.
- [ ] Commit: `refactor(phone-core): remove legacy menu DTO and app registry`.

### Task 10 - Full integration QA and documentation closeout

**Files:** this plan, `docs/plans/README.md`, README/docs only where behavior changed.

- [x] Run uncached full verification: `mise exec -- vp run -r test`.
- [x] Run `mise exec -- vp check --fix` and `mise exec -- vp run website#build`.
- [x] Browser QA with the persistent stage: boot; inspect all 13 carousel graphics/numbers;
      navigate representative nested paths; deep-link; browser back/forward; open/exit SMS,
      Chat, Snake, pickers, welcome editor, and Calculator; verify no canvas remount.
- [x] Calculator QA: `0.1 + 0.2 = 0.3`; all operators; decimal rejection; operator cycling;
      C delete, C exit, held-C clear; divide by zero; overflow; Options placeholders; back path.
- [x] SSR/build QA: route and sitemap generation must import the menu without browser-global
      errors or application side effects.
- [x] Verify URL and sitemap parity against Task 2's golden list.
- [x] Update this plan with any deviations and evidence; mark all completed boxes only after
      gates pass.
- [x] Change plan 11 status in `docs/plans/README.md` from `not started` to `done`.
- [ ] Commit: `docs: mark object menu model complete`.

## Completion evidence

- Uncached recursive verification passes 466 tests across all five workspaces.
- Scoped `vp check --fix` passes formatting, lint, and typechecking for all changed source,
  test, and documentation files. User-owned untracked todo assets were intentionally excluded.
- The client, SSR, and Nitro production builds pass. The existing large-chunk advisory remains.
- Browser QA exercised all 13 carousel positions in order through the accessible screen mirror,
  Calculator (`0.1 + 0.2 = 0.3` and unavailable currency options), SMS, Chat, Snake, picker,
  editor, deep links, back/forward, persistent canvas identity, 404/SIM services, noindex, and
  mobile/desktop overflow. Headless Chromium could not create WebGL, so exact graphic identity
  is covered by the golden menu/icon renderer tests rather than a 3D screenshot.
- An adversarial review found and fixed creation-time application context handling, direct action
  path retention, reentrant subscriber ordering, and negative fractional Calculator formatting.

## Done means

- one immutable `PhoneMenu<WebMetadata>` graph drives phone, routes, sitemap, SEO, and panels;
- order, slug, and top-level graphics are explicit and validated;
- behavior families are reusable application definition objects with fresh sessions;
- no string application registry or silent missing app remains;
- Calculator works on the handset at `/menu/calculator`;
- existing paths, menu order, labels, graphics, and non-Calculator behavior remain stable;
- phone-core stays standalone, pure TypeScript, zero runtime dependencies;
- all tests, checks, build, and browser gates pass;
- VISION and package README match the shipped contracts.
