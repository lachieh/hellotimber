# @hellotimber/nokia-os

A strict reproduction of the stock Nokia 3310 firmware (v6.39, PPM E, English) on the generic
`@hellotimber/phone-core` kernel, painted with `@hellotimber/phone-screen`'s LCD toolkit. Every
pixel and timing step is checked against emulator captures of the real firmware.

What it covers today (plans 13 and 14): the boot sequence, standby, the 12-entry main-menu
carousel with its animated icons, and the whole v6.39 menu tree (279 nodes, depth 6) in order,
with hidden menu numbers, both presentations (row lists with the stateful circular window, and
one-item pages with a current value), each level's soft key and opening selection, and the stock
shortcut digits (menu numbers, delayed opening, `Invalid shortcut`). Leaves open stock widgets:
option lists (single choice, unset, multi-select), timed, static and progress notes, confirm
queries, info pages and screens, input prompts (first screen), level bars, text pages, and the
four game splashes. Choices persist in an EEPROM over a host storage port and pages show them
(plan 15); the security code guards Phone security, Change security code, Restore factory
settings and Clear timers, and gates the power-on with Phone security On. Snake II is playable
(plan 23; see "Snake II"). The buzzer, the tone generator and the vibrator reach the host through a
sound port (plan 16; see "Sound"); the display and keypad LEDs through a lights port, and the
keyguard locks the keypad (plan 25; see "Lights and the keyguard"). Multi-tap text entry, the
Welcome note editor, Write messages, Inbox and Outbox work over a host network port (plan 18; see
"Text entry and SMS"), and Write messages writes in T9 with an English dictionary built from an
open word list (plan 18b; see "T9 predictive text"). The SIM card's phone book (names, Service
Nos., speed dials, assigned tones, Send b'card) works over the SIM a host inserts (plan 19; see
"The phone book"). The Clock and Reminders run on the host's clock: Clock settings, Date setting,
Auto update, the alarm, the countdown timer, the stopwatch and the reminder memory, with their
alerts at standby (plan 21; see "Clock, alarm, timers and Reminders"). Leaves that are whole
applications open a marked
placeholder (a dotted border the firmware never draws) naming the plan that owns them; see "Leaf
ownership".

## Usage

```ts
import { createStockPhone, createSyntheticNetwork, paintStockScreen } from "@hellotimber/nokia-os";
import { createScreenRenderer } from "@hellotimber/phone-screen";

const pad = (n: number) => String(n).padStart(2, "0");
const phone = createStockPhone({
  carrier: "Telstra", // every character must exist in the stock font; otherwise this throws
  clock: () => {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`; // "07:59"
  },
  date: () => {
    const now = new Date();
    return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`; // "13.10.2026"
  },
  boot: "animated", // or "skip" (tests, reduced motion; the security code is still asked for)
  storage: window.localStorage, // the EEPROM; default: a fresh in-memory storage per phone
  sim: "sim-1", // the inserted SIM card, an id or a whole StockSimCard (default "sim-1", empty)
  network: createSyntheticNetwork(), // SMS in and out (the default; see "Text entry and SMS")
  // T9 English (see "T9 predictive text"); without it Write messages is multi-tap.
  t9: { english: (await import("@hellotimber/nokia-os/t9-english")).englishT9 },
});

const renderer = createScreenRenderer({ paint: paintStockScreen, scale: 6 });
document.body.append(renderer.canvas);
phone.subscribe(({ screen }) => renderer.render(screen));

const loop = () => {
  phone.tick(Math.floor(performance.now()));
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

phone.send({ type: "down", key: "power" }); // the phone starts switched off;
setTimeout(() => phone.send({ type: "up", key: "power" }), 1000); // a long press turns it on
```

`missingStockGlyphs(text, font)` lists the characters a stock font cannot draw, so a host can
validate an operator name before calling `createStockPhone`.

With `@hellotimber/phone-3d`, pass `renderer.canvas` as the screen texture source, forward the
model's key callbacks to `phone.send(...)`, and drive its lights from the lights port (see
"Lights and the keyguard"). nokia-os never imports phone-3d.

## Demo

```sh
mise exec -- vp run @hellotimber/nokia-os#demo   # http://localhost:5173
```

Arrows ▲/▼, Enter Navi, Backspace or Escape C (hold it to return to standby), digits, `*`,
`#`, and `P` power (as long as it is held; the Power button holds 1 s while the phone is off and
taps while it is on, so at standby it opens the profile list). The buttons do the same. In Snake II the digits steer (2/4/6/8,
and 1/3/7/9 relative), ▲/▼ and `*`/`#` turn, Enter or Escape suspend the game. The demo validates
the operator name, can skip the boot, moves the host clock on (**Host clock**: +1 min, +10 min,
+1 h, Reset; the status line shows it and the times of the last alerts), and shows the phone's path, screen kind and application in
a status line with the EEPROM records stored and the active profile (its name, the standby line
and the silent icon when shown). The phone's EEPROM is the page's localStorage:
settings survive a reload, and **Erase EEPROM** removes every `nokia-os/` record and restarts the
virgin phone (a malformed record shows its error beside the button). The SIM select restarts the
phone with `SIM 1` or `SIM 2`: with Phone security On, a SIM the phone has not seen asks for the
security code (`12345`) at power-on. **Factory settings** restarts the phone over the factory
state (the virgin phone is nearly silent; see "Sound"). The demo plays the sound port through
WebAudio once a key or click has started audio (a **Mute** box silences it), lights a `VIBRA` lamp
and shakes the LCD while the vibrator runs (the lamp only with reduced motion), and lists the last
eight sound events (`atMs output state`) under the status line, so a headless run can check sound
without hearing it. An `LCD` and a `KEYS` lamp show the lights port (the LCD dims while the display
LEDs are off) and the last eight lights events are listed too. The phone's network is a synthetic
one: a **Receive SMS** form (sender and text, time-stamped by the browser's clock) delivers a
message, and the messages the phone sent are listed beside it. A **Chat partner** answers every
Chat line sent to its number (`Hi <name>, you said "<line>"`), as a host's chat contact would. The T9 English dictionary loads as
a chunk of its own after the page and restarts the phone with it (the status line shows `T9:
English (30000 words)`); unticking **T9 English dictionary** restarts the phone without one, as a
host that leaves it out (Write messages is then multi-tap). The **SIM phone book** select
restarts the phone with an empty SIM (the SIM select's), a sample SIM (a handful of invented names
and two service numbers) or a full one (50 names); the status line shows the SIM's id and its
names and free locations, and ▼ at standby opens the list. The **SIM content** select restarts the
phone with a sample SIM (plan 30: three messages, one unread from a named sender; Menu 14 with a
text page, and a list whose `Office` asks to call; an IMEI and a preloaded Welcome note); the status
line then reads each screen as plain text (`text: …`, `describeStockScreen`). In dev it also lays any committed golden over the LCD, as an overlay or as a pixel
difference; the list groups the goldens by top-level menu (`tree/05-tones`) and kind (`menu`,
`probe`, `game`).

## Asset policy

Everything the painter draws comes from committed goldens. Fonts are harvested from the text in
golden images (plan-owned runs and glyph resolutions in `scripts/resource-inputs/`). Icons, boot frames and status
art are cropped from goldens, and timelines come from golden timing rows. Nothing is copied from
the capture corpus's extracted firmware assets.

## Golden and tree data pipeline

The capture corpus (`nokia-3310/`, emulator captures of the real firmware) is gitignored and is
never committed. Three scripts turn it into committed, generated data. Never edit their output;
change the script or its input tables and run it again (each run twice gives no diff):

```sh
REF=/path/to/nokia-3310
# 1. Import captures into goldens/ (84×48 '#'/'.' text grids with timings, plus one index per
#    plan, goldens/index/<NN>.json).
mise exec -- vp run @hellotimber/nokia-os#import-captures $REF
# 2. Generate the stock menu tree (src/firmware/generated/stock-tree.ts) from tree.json and the
#    corpus OCR, plus the harvester's text runs (scripts/generated/tree-text-runs.ts).
mise exec -- vp run @hellotimber/nokia-os#import-tree $REF
# 3. Derive fonts, icons, boot frames, status art, widget sprites and widget timelines, and
#    Snake II's pictures, mazes and timings, into src/resources/generated/ (`regenerate` runs
#    every generator that needs no $REF; resolve a conflict in generated files with it).
mise exec -- vp run @hellotimber/nokia-os#regenerate
# 4. Test: pixel and timing acceptance against every asserted golden, the tree coverage guard,
#    and freshness checks.
mise exec -- vp run @hellotimber/nokia-os#test
```

Each plan's capture set, `scripts/capture-sets/<NN>-<slug>.ts` (the menu tree's by rule in
`scripts/tree-capture-set.ts`: one golden per submenu, option-list signature, leaf response and
probe), decides which captures become goldens and whether each is `asserted` or `pending:<plan>`,
and the importer indexes them in `goldens/index/<NN>.json`. Tree goldens declare a `scenario` and
the nodes they `covers`; `tests/support/drive.ts` derives their key presses from the generated
tree. Each plan's `tests/acceptance/<NN>-<slug>.test.ts` drives the phone on a virtual 1 ms clock
through a scenario for every asserted golden of its index and fails if one has none; timelines
are compared after aligning on the first changed frame, by the fidelity standard of `AGENTS.md`
(settled pixels exact; a change within 34 ms of the golden's, or 10 % of the time since the
trigger up to 100 ms, plus 2 % drift across a long sequence; partial draws under 34 ms neither
required nor forbidden). Its `knownGaps` list the
asserted goldens nokia-os cannot reproduce, each with its reason (they run as expected failures).
The coverage guard (`tests/acceptance/coverage-guard.test.ts`) collects every plan's file and
proves that every tree node and option choice is covered by an asserted golden, a golden pending
for the plan that owns the node, or a same-as subtree equal to its model. Tests never read the
corpus.

**Firmware features.** The generated tree binds to behaviour through feature modules,
`src/firmware/features/<slug>.ts` (one per menu area or behaviour, registered in
`features/index.ts` and composed by `src/firmware/stock.ts`): the screens each implements by tree
node, the leaves it leaves to a later plan's placeholder, the generic widgets' tables (prompt
layouts, note styles and ends, query results, setter levels), its settings (virgin and factory
values, aliases) and its EEPROM records. The demo's controls are panels the same way
(`demo/panels/`).

## Clock, alarm, timers and Reminders

**The clock contract (D1).** The host's `clock` (`HH:MM`, 24-hour) and `date` (`DD.MM.YYYY`) are
the phone's real-time clock. nokia-os reads them on every tick and never reads a wall clock of its
own. A value that does not parse (`24:00`, `9:5`, `31.02.2026`, `undefined`) counts as no time:
standby shows no clock, the Clock pages show `--:--` and `--.--.----`, Alarm clock, Date setting
and Reminders › Add new say `Clock needs to be set first`, and alarms and reminders stay dormant.
Nothing throws. The phone's time is the host's plus a signed minute offset kept in the EEPROM
(the internal `clock` record): Set the time and Date setting move the offset, never the host, and
Auto update `On` clears it at power-on (`Date and time updated` when that changed the time;
`Confirm first` asks `Update date and time of the phone?` at standby). With no offset the phone
shows the host's strings exactly. A host that wants a fixed zone formats its strings in that zone:

```ts
const brisbane = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Brisbane",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hourCycle: "h23",
});
const part = (type: string) =>
  brisbane.formatToParts(new Date()).find((p) => p.type === type)!.value;
createStockPhone({
  clock: () => `${part("hour")}:${part("minute")}`, // "07:59"
  date: () => `${part("day")}.${part("month")}.${part("year")}`, // "13.10.2026"
});
```

Clock settings › Hide clock (the entry then reads `Show clock`) and Time format (12-hour: `hh:mm`
and an am/pm mark on standby, `10:10 am` on the page) are kept in the EEPROM; Restore factory
settings shows the clock and sets 24-hour, and keeps the alarm, the offset and the reminders.

**Minute edges and alerts (D2, D3).** On the first tick whose phone time is a new minute, the
alarm rings if the minute is its time (or its snooze's), and every reminder whose date and time
have come (a jump over its minute included) alerts, the later-added first. Setting the time, the
date or the alarm fires nothing by itself; a backwards jump re-fires nothing. v6.39 shows no
alert over anything: an alert that falls due away from standby waits until the phone next shows
standby (Snake II pauses to its menu), and alerts show one at a time, through phone-core's opt-in
`PhoneConfig.interruption`. The alarm rings with `Alarm!` and its time blinking (Snooze: `Snooze
active`, it rings again 5 minutes later rounded up to a minute; untouched for a minute it snoozes
itself; any other key stops it, and it is a one-shot). A reminder shows its text with `Snooze`
(`Alarm postponed for 10 min`, then it alerts again 10 minutes later; any other key ends it).
The countdown's `Countdown time up` steps its bells until a key. Each alert plays its captured
program on the sound port (its volume climbing as Ringing volume Ascending does).

**Wake (D4).** While the phone is off, the alarm's minute switches it on without the boot
(phone-core's opt-in `PhoneConfig.wake`): the ringing alarm, then `Activate phone for calls?`
(Yes: the normal power-on; No: off again). The emulator cannot run while off, so this flow is
composed from captured screens and the firmware's strings and is UNVERIFIED (D12).

**Timers (D5).** The countdown and the stopwatch run on kernel time with nominal durations (the
emulator's timer unit runs ≈2.9 % fast, an artefact). The countdown shows the time left rounded
up to a minute and its standby icon; the stopwatch (Start, Stop, Options › Start, Reset, Exit)
keeps running while the phone is elsewhere, redraws every 100 ms and blinks its standby
indicator. Both are RAM: a power-off loses them. Standby's `StandbyIndicators` gain `alarm`,
`timer` and `stopwatch`.

**Reminders.** Up to 10 reminders (35 characters, with or without an alarm date and time) live in
the EEPROM's internal `reminders` record; Restore keeps them. The virgin EEPROM holds the
firmware's junk reminder, dormant (D8): it keeps View all and Erase listed until Erase › All.
There is no host API to add reminders: a host's only route would be writing that internal record
into the storage before the phone starts, which is not a supported contract. Reminder Send asks
for the `Phone number:` (Search: the phone book's names); the Smart Messaging transmission after it
is a placeholder.

## Storage, settings and the security code

**Storage port.** `StockPhoneConfig.storage` is the Web Storage subset (`getItem`, `setItem`,
`removeItem`), so `window.localStorage` fits as it is; `createMemoryStorage()` makes the default
in-memory one. nokia-os writes only keys starting with `STOCK_STORAGE_PREFIX` (`"nokia-os/"`),
every change at once, as the phone's EEPROM does. A host erases the phone by removing those keys.

```ts
import { createStockPhone, STOCK_STORAGE_PREFIX } from "@hellotimber/nokia-os";

const phone = createStockPhone({ carrier: "Telstra", storage: window.localStorage });

function eraseEeprom(): void {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(STOCK_STORAGE_PREFIX)) window.localStorage.removeItem(key);
  }
}
```

**Records and versions.** Each feature owns one record (`settings`, `security`; later plans add
theirs), stored as `{"version":n,...}` JSON with sorted keys. A record decodes older versions;
malformed JSON, a non-object or an unknown newer version makes `createStockPhone` throw, naming
the storage key. Stale content in a well-formed record (a setting that no longer exists, an index
out of range) is dropped. A failing `setItem` keeps the value in memory and the phone goes on.

**Virgin and factory.** Empty storage is the virgin EEPROM the goldens show: unset tone lists,
Snake II level 175 and `Top score: 45`, Phone security `Off`. The settings record stores only
what the phone has changed since. Restore factory settings (Settings › Restore factory settings,
code `12345`) resets every list to its v6.39 factory value (captured after a Restore: `Nokia
tune`, `Level 4`, Keypad tones `Level 2`, …) and keeps the welcome note, Snake II's top score and
the security record.

**Security code.** The code is `12345` until Change security code stores another five digits.
Every code prompt masks the digits (10 at most), C deletes and C held 1 s clears, and a wrong code
shows `Code error` and returns to the empty prompt. Five wrong codes in a row lock every prompt for
≈290 s; any entry restarts the lock, and it survives a power cycle.

**Boot gates.** With Phone security On, a power-on with a SIM that is not among the last five
used shows the `Security code:` prompt after the self-test, then `Code accepted` and the hands.
Every power-on that passes records its SIM. A stored welcome note replaces the hands for about
5 s. `boot: "skip"` still asks for the code, but skips the hands and the note.

**Later plans.** The Welcome note editor (plan 18) writes the note this plan shows at power-on.
The Russian, Bulgarian and Ukrainian UIs (plan 26) and Phone book › Erase all (19) are left to
later plans; Clear timers' effect and the call-list erase are plan 22's (Calls). SIM PIN,
PIN2 and barring passwords keep their first screen.

## Profiles

**A profile is its settings plus a name** (plan 17, `src/firmware/features/profiles.ts`). Each of
the six slots (`PROFILE_SLUGS`: General, Silent, Discreet, Loud and two `(empty)`) stores its
Personalise settings under `profiles/<slug>/…` keys and its name under its Rename key, in the
`settings` record. `ACTIVE_PROFILE_KEY` stores the active slot (General when unset: the virgin
EEPROM and Restore factory settings).

**The active profile's alias.** Tones (menu 5) are an alias, not settings of their own: every
`tones/…` key reads and writes `profileAlias(key, activeProfile(settings))`, re-resolved through
the stored active choice on every read, so Activate switches every Tones value at once and Tones ›
Keypad tones → Level 3 writes the active profile's. Composer has no Personalise counterpart and
keeps its own.

**What the phone shows.** Activate (Menu › Profiles › n › Activate, `Menu 1 2 n 1`, or the power
key's short press at standby, which opens the `Switch off!` / profiles list) stores the choice as
its note opens and beeps the activating key at the new profile's Keypad tones level. At standby the
active profile's name (none for General; the text `Silent` for a General with its alert, message,
keypad and warning tones off) is drawn under the operator `PROFILE_LINE_DELAY_MS` after standby,
and a small icon shows while its Incoming call alert is Off. Rename edits the name with plan 18's
text input (10 characters; an empty name restores the factory name). The Profiles level lists the
names and opens on the active profile. A standby notice (plan 18) replaces the name line, and the
message envelope, drawn where the silent icon is, hides it (UNVERIFIED: no capture shows both). On
a locked keypad (plan 25) the power key shows the keyguard's hint, not the profile list.

**What later plans read.** `activeProfile`, `profileName`, `activateProfile` and `renameProfile`
over `StockSettings`; every tone setting through the `tones/…` keys, which already follow the
active profile (the message alert (18), the incoming call's ringing (22), reminders and alarms
(21)). The kernel seams are generic and opt-in: `PhoneConfig.standbyLine`, `standbyPower`,
`StandbyIndicators.silent`, `SubmenuOptions.label` and `ApplicationContext.powerOff`
(`packages/phone-core/README.md`).

## Space impact (plan 24, incomplete)

Games › Space impact › New game opens the initial engine and LCD painter. Navi suspends to
Continue; Continue waits for a key, which reaches the game. The stock menu, waiting board,
re-entry from standby, Top score return and twelve tap-key fixtures have exact acceptance
coverage. The full 60-frame New game tree capture also passes. Each game's suspended state
is independent; New game seeds once and replaces only its own state.

`src/games/space-impact/` owns pure state and steps; `src/firmware/features/space-impact.ts`
owns timers, key repeats and suspension. Games wiring stays in `features/games.ts`. Generated
opening-wave declarations come from committed LCD evidence. Full level-0 replay still fails
at image `ah`; collisions, later waves, RNG consumption, bonuses, bosses, game over, seeded
splash and the remaining sound programs are unfinished; the ordinary shot program is generated. The retained clock-seed fallback and other accepted
defaults remain UNVERIFIED. See `docs/specs/stock/space-impact.md` and plan 24 for the checkpoint.

## Snake II

`Games › Snake II › New game` plays the firmware's game (plan 23), checked against gameplay
captures pixel for pixel and tick by tick.

- **Engine.** `src/games/snake/` is a pure engine (`newSnakeGame`, `snakeKey`, `stepSnake`,
  `blinkSnake`, `snakeRender`) with the firmware's rules: the 20x9 board and its wrap, the five
  mazes, every game key, food and growth, the bonus creatures and their countdown, the grace
  tick before a crash, the death blink and the ring quirk. It is separate from
  `@hellotimber/snake`, the website's game, whose rules all differ. `src/widgets/snake.ts` runs it
  at the captured timings and ends in the shared game-over screens (`src/widgets/game-over.ts`).
- **Speed.** The virgin EEPROM stores level 175, which the Level page draws as nine bars. At 175
  the firmware reads its period past the end of its nine-entry table and finds 0, so the snake
  moves one cell per ≈7.7 ms timer unit and a meal scores 175. nokia-os reproduces that, and
  every level the Level page can store (▼ from 175 reaches 174..1) ticks at its captured period
  (`SNAKE_PERIODS`, from the goldens).
- **Random numbers.** Placements come from the firmware's 16-bit generator, reseeded at New game
  (not at Continue); one seed reproduces every placement of each recorded game. The function from
  the clock to the seed is unknown, so the stock phone seeds from the minutes of the day
  (UNVERIFIED) and tests inject the recovered seeds.
- **Cues.** The game emits `eat`, `crash`, `vibrate` and `top-score` cues stamped with the kernel
  time to the phone's sounder (plan 16): a meal's 2636.9 Hz chirp, the crash's three 440 Hz
  pulses and a new top score's fireworks tune need Warning tones and Games › Settings › Sounds On;
  the ≈480 ms shakes need Shakes and Vibrating alert On. Keys on the game-over screens are silent.
- **Scores.** Game over writes a new top score to the settings record, which Top score then shows.
  Navi or C suspends a game; `Continue` heads the game menu until the game resumes or is
  discarded (New game, OK on the Level page, power-off).

## Sound

The phone reports every change of its three outputs to `StockPhoneConfig.sound`, a
`StockSoundPort`, stamped with the kernel time it happens at (`atMs`). Events come from `tick()` in
time order, so a host schedules each one at `audioNow + (atMs - phoneNow) + latency` and a coarse
tick plays the same as a fine one. nokia-os touches no audio API; phone-core's id-only `sound`
event is not used.

```ts
import { createStockPhone, type StockSoundEvent } from "@hellotimber/nokia-os";

const ctx = new AudioContext(); // create or resume it from a user gesture
const voice = (type: OscillatorType) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  gain.gain.value = 0;
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  return { oscillator, gain };
};
const voices = { buzzer: voice("square"), tone: voice("sine") };
let phoneNow = 0;

const phone = createStockPhone({
  carrier: "Telstra",
  sound: {
    change(event: StockSoundEvent) {
      const at = ctx.currentTime + (event.atMs - phoneNow) / 1000 + 0.03;
      if (event.output === "vibrator") return; // drive a lamp or navigator.vibrate()
      const { oscillator, gain } = voices[event.output];
      if (event.hz === null) return gain.gain.setValueAtTime(0, at);
      oscillator.frequency.setValueAtTime(event.hz, at);
      // `volume` is the firmware's register; map it to a gain (loudness is not captured).
      gain.gain.setValueAtTime(event.output === "buzzer" ? 0.15 : 0.04, at);
    },
  },
});
const loop = () => {
  phoneNow = Math.floor(performance.now());
  phone.tick(phoneNow);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
```

- **Outputs.** `buzzer`: 13 MHz / the firmware's divider, `volume` the MAD2 volume register
  (0-194 seen, higher is louder). `tone`: the DSP tone generator on the earpiece path, `volume`
  its level word (`0x9108`/`0x9104`/`0x9100` for Keypad tones Level 1/2/3; a lower low nibble is
  louder). `vibrator`: on or off. The demo's gain table (`demo/panels/sound.ts`) is a choice.
- **What is evidence.** Sound is verified as event timelines, never waveforms: the emulator logs
  each output's register changes every 1 ms, and `goldens/sound/**/*.sound.txt` hold those rows
  aligned on the recording's first key. The captures' WAV files are the emulator's own synthesis
  (it ignores both volume registers) and are never imported or asserted.
- **Asset policy.** `import-captures` turns the capture corpus's sound recordings into the sound
  goldens; `extract-resources` derives every program from them (`src/resources/generated/sounds.ts`:
  the 35 ringing tones, the message tones, the keypad beep, note tones, Snake II's cues, the
  per-level volume tables). The extracted firmware tone tables are only a cross-check.
- **Virgin vs factory.** Empty storage is the virgin EEPROM, whose tone settings are unset: keys
  beep, but ringing previews and warning tones are silent. The factory state (Restore factory
  settings, or the demo's button) sounds: Ringing tone, Ringing volume and Message alert tone
  previews, warning tones on error notes, Snake II's sounds and shakes.
- **Later plans.** An arriving SMS plays the active profile's Message alert tone (plan 18; the
  Tones settings follow the active profile, plan 17). The incoming call's ringing and DTMF (22, Calls),
  the other games' sounds (24) and the Composer (27) play through the same sequencer, as the
  alarm's, the countdown's and the reminders' alerts do (21).

## Lights and the keyguard

The phone reports every change of its display LEDs and keypad LEDs to `StockPhoneConfig.lights`, a
`StockLightsPort`, as `StockLightEvent`s (`light`, `atMs`, `on`) from `tick()`, as the sound port
does. Both lights are off until the boot lights them; power-off turns off the lit ones. v6.39
always switches the two together; the port keeps them apart because the hardware has two lines and
phone-3d renders them differently. A host maps them to phone-3d's props:

```tsx
const [lights, setLights] = useState({ display: false, keypad: false });
const phone = useMemo(
  () =>
    createStockPhone({
      carrier,
      lights: { change: (e) => setLights((l) => ({ ...l, [e.light]: e.on })) },
    }),
  [],
);
<Nokia3310 backlightOn={lights.display} keypadLightOn={lights.keypad} {...rest} />;
```

- **The light tick.** A key-down (and the boot's first frame, standby's arrival, Unlock then `*`;
  an arriving message; a call once plan 22 lands) lights both LEDs; they go dark on the first tick of the
  firmware's 1982.61 ms light tick, counted from the power-on, at least 13 624 ms after the last
  activity: 13.6-15.6 s after a key, never a fixed 15 s. A key's release and how long it is held
  count for nothing.
- **Games › Settings › Lights.** During Snake II's play Lights Off holds the LEDs off and Lights On
  holds them on with no timeout; the pause and the game-over screen release them.
- **The keyguard.** Menu then `*` within 2925 ms locks the keypad (`Keypad locked`, its warning
  tone); the locked standby shows a key icon and `Unlock`. Every other key shows `Press Unlock and
then *` silently and dark (the power key lights); Unlock then `*` within `Now press *` (1448 ms)
  unlocks (`Keypad active`). Digits ending in `112` show the emergency number with `Call`. The
  keyguard lives in RAM: a power-on is unlocked.
- **Arrivals.** An arriving message lights an unlocked phone; a locked one shows its notice with
  `Unlock` and stays dark.
- **Later plans.** Arriving calls (22) light the phone and pass a locked one;
  Call on `112` dials (22); the alarm blinks the LEDs (21); the other games follow the Lights rule
  (24). See `docs/specs/stock/keyguard-and-backlight.md`.

## Text entry and SMS

Plan 18 adds the firmware's multi-tap text entry and the SMS features built on it, checked against
196 goldens of emulator captures (`text/*`, `sms/*`, `welcome/*`, `glyphs/*`).

- **Text entry.** With Dictionary off, Write messages opens the multi-tap editor (T9: plan 18b, below):
  every key's character cycle including the accented letters, the 1452 ms commit, sentence case
  after `. `, `? `, `! ` and the `#` case cycle, `123` on held `#`, held digits, the `*` symbol
  table (31 symbols, ▲/▼ wrap, Use inserts), ▲ right and ▼ left, C delete and held-C clear, the
  `459/1` characters-left counter in three parts, word wrap, scrolling and the 480 ms cursor
  blink. The same editor is the Welcome note (36 characters, large text while two lines fit). The
  reusable widgets later plans bind are `editor`, `textInput` (one-line names, Rename, Tone name)
  and `numberEntry` (numbers: `*` cycles `* + p w`, 30 digits, Search on empty).
- **Messages.** Write messages and its nine Options (Send to a typed number, Save to Outbox,
  Erase, Exit, Dictionary, Send by set with Numeric/Alphanumeric and Set 2's centre prompt;
  Send to many, Template and Insert smiley show what the firmware shows without a phone book or
  content). Inbox and Outbox list, read (four lines a page, then `Sender:` and `Sent:`), and offer
  the stock Options (Erase, Reply, Edit, Use number: the number in standby's number entry, plan
  22; Forward, Details; Chat is plan 18c's). Arrivals show `1 message received` (Read) and the envelope at standby, wait for
  standby elsewhere, and are refused with `No space for new messages` when the SIM's 15 slots are
  used (the envelope blinks). Message centre numbers and the voice mailbox number are editable.
- **Records.** The `messages` EEPROM record (version 1) holds each SIM's Inbox and Outbox:
  `{"sims":{"sim-1":{"inbox":[{number,text,sentAt,centre,read}],"outbox":[{text,number?}]}}}`.
  Restore factory settings keeps it. The Welcome note, the centres, the voice mailbox and the
  Dictionary choice live in the `settings` record.

**The network port.** `StockPhoneConfig.network` is the only way an SMS enters or leaves the
phone. It carries numbers (or routing addresses), text and an incoming message's local time stamp,
and nothing of the radio protocol. `send` may return a promise: the phone shows `Sending message`
until it settles and the measured link time (≈2.66 s) has passed, then `Message sent`, or a
failure note for `"failed"` or a rejection. Arrivals land ≈2.32 s after `deliver`; ones delivered
while the phone is off land once it reaches standby. The default, `createSyntheticNetwork()`,
accepts every send and never loops one back, as the emulator's network does:

```ts
import { createStockPhone, createSyntheticNetwork } from "@hellotimber/nokia-os";

const network = createSyntheticNetwork();
const phone = createStockPhone({ carrier: "Telstra", network });
const now = new Date();
network.deliver({
  number: "0412345678",
  text: "Hello from the network",
  sentAt: {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  },
});
network.sent; // [{ number, text }, …] what the phone sent
```

A host backs the port with its own service. A sketch over an HTTP endpoint (the endpoint and its
replies are the host's; `deliver` validates each field and throws naming a bad one):

```ts
import type { StockIncomingSms, StockNetworkPort } from "@hellotimber/nokia-os";

function httpNetwork(endpoint: string): StockNetworkPort {
  return {
    async send(sms) {
      const response = await fetch(endpoint, { method: "POST", body: JSON.stringify(sms) });
      return response.ok ? "sent" : "failed";
    },
    subscribe(deliver) {
      const events = new EventSource(`${endpoint}/incoming`);
      events.onmessage = (event) => deliver(JSON.parse(event.data) as StockIncomingSms);
      return () => events.close();
    },
  };
}
```

**Business cards.** Send b'card (plan 19) goes through the same port's optional
`sendBusinessCard({ to, card: { name, number } })`; a port without it settles `"sent"` after the
link time, and `createSyntheticNetwork().cards` lists the cards sent.

**Later plans.** Chat, Templates, Smileys, Info service topics and the Service command editor are
plan 18c's (below). Use number and the received notice's ▲/digit keys are plan
22's (Calls); the message alert plays the active profile's tone (plan 17).

## Chat and Messages content

Plan 18c adds Chat, Templates, Smileys, Info service › Topics and the Service command editor,
checked against 163 goldens of emulator captures (`content/*`, `chat/*`, `topics/*`,
`service-command/*`) and specified in
[`docs/specs/stock/chat-and-content.md`](../../docs/specs/stock/chat-and-content.md). The public
API does not change.

- **Templates and Smileys** (Messages 5 and 6) are the `templates` and `smileys` EEPROM records:
  eight slots each, a slot holding the user's text or nothing. The virgin EEPROM has neither list
  (the menu entries do nothing, as on the captured phone); Restore factory settings provisions
  them, and an empty slot shows the firmware's default (five templates, five smileys) or
  `(empty)`. Read, Edit (70 characters, 7 for a smiley) and Erase work as captured, and every
  editor's Options › Template and Insert smiley insert a slot's text at the cursor.
- **Info service › Topics** is the `info-topics` record: the virgin EEPROM's five junk topics
  (box-glyph names), an empty list after Restore; Select, Add topic (at most five), Edit and Erase.
- **The Service command editor** sends nothing anywhere: `Requesting` for ≈14.9 s, then `Not done`,
  as the emulator, which answers no USSD.

**Chat over the network port.** Chat (menu 3, and Inbox › Options › Chat) needs no API of its
own. Each line goes out through `StockNetworkPort.send` as an SMS to the chat's number whose
text is `<chat name>: <line>` (`: <line>` with no name). While a chat runs, an SMS that the host
delivers from exactly that number is the partner's line: it shows on the chat's history at once
and is not stored in Inbox. An SMS from any other number lands in Inbox as usual. So a host that
gives the phone someone to chat with only answers SMS, for example:

```ts
import { createStockPhone, createSyntheticNetwork } from "@hellotimber/nokia-os";

const network = createSyntheticNetwork();
const phone = createStockPhone({ network });
const PARTNER = "0412345678"; // the number the user types at Chat's `Phone number:`

let answered = 0;
function answerChats(): void {
  for (const sms of network.sent.slice(answered)) {
    const line = /^([^:]*): ([\s\S]*)$/.exec(sms.text);
    if (sms.number === PARTNER && line !== null) {
      const text = `Hi ${line[1]}, you said "${line[2]}"`; // an LLM's reply, say
      network.deliver({
        number: PARTNER,
        text,
        sentAt: { year: 2026, month: 10, day: 15, hour: 9, minute: 0, second: 0 },
      });
    }
  }
  answered = network.sent.length;
}
// Call answerChats() after each phone.tick(), or answer from your own StockNetworkPort's send.
```

The partner's SMS lands the usual receive link time (≈2.32 s) after `deliver`; an answer that
lands before the phone shows `Message sent` waits for it, and the history then lists the answer
above the sent line. Nothing of a chat is stored but the name, which the next chat offers
(kept in memory: its persistence over a power cycle is UNVERIFIED).

**Not implemented (no verified v6.39 captures).** Picture messages (Messages 4), Screen saver ›
Screen saver, receiving business cards and sending a Composer tone stay placeholders of plan 18c:
the v6.39 emulator opens no picture folder and stalls on saving a picture, and the network port's
binary (picture, card, ringtone) extension is not part of the contract.

## Calls

Plan 22 adds standby number entry, calls in and out and the call register, checked against 268
goldens of emulator captures (`calls/*`, `sound/calls/*`, `sound/note/calls-*`) over a patched
emulator network that really connects calls.

- **Number entry.** A digit, `*` or `#` at standby (or on a note, an option list, the Level page,
  the calculator's Options) starts the entry with that key: the large face up to 16 characters,
  the small face to 33, the newest 60 kept; `*` cycles `* + p w` and commits after 1.44 s; C,
  held C, ▲/▼ cycle the soft key (Call, Save, Convert); held `1` calls the voice mailbox; `#`
  answers `*#06#`, `*#0000#` and SIM locations (`12#`) at once. Every dial key sounds its DTMF
  pair (`StockSoundEvent.hz2`) for as long as it is held.
- **Calls.** Call shows Calling, the network's alerting (`Call 1`, the 425 Hz ringback),
  connected, and End, C (End/Options), the in-call Options (End active call, Mute; Hold, New
  call and Send DTMF are plan 22b's), Volume on ▲/▼ and DTMF digits. A ring shows over any
  screen ≈1.9 s after the network's ring with the profile's ringing tone and alert type; Answer,
  C (reject), a missed call's `1 missed call` notice (List) and the handset over the screen
  below follow the captures. `112` is an emergency call.
- **Call register.** Missed (10), Received (10) and Dialled (20) are RAM lists (power-off empties
  them), each entry with Options (Call, Send SMS, Time of call, Edit number, Save, Erase); standby
  ▲ opens the dialled numbers with Call. The `calls` EEPROM record (version 1,
  `{"durations":{"last","all","received","dialled"}}` in seconds) keeps Show call duration's
  totals; Clear timers and Restore factory settings zero it.

**The call port.** `StockNetworkPort` (the SMS port above) has an optional call half. The phone
calls `dial(call, phone)` the moment Calling shows (the Call key's redraw), with the number it
dials and, when the phone book knows it, the name it shows:

```ts
interface StockOutgoingCall {
  readonly number: string; // the entry, cut at a later `+` or at its first `p`/`w`
  readonly name?: string; // the phone book's name for the number (plan 19), if any
  readonly emergency: boolean; // `112`
}
```

`dial` returns the host's `StockCallLink` (`hangUp()` is called once when the user ends the
call or the phone switches off) and receives the phone's `StockCallControl`: `alerting()` (the
far end rings: `Call 1`, the ringback), `connected()` (the call counts its duration) and
`released()` (the far end or the network ended the call; called before `alerting`, it refuses
the call: the network's end, the checkered `Call 1` with three beeps, then standby). Events
apply at the phone's next tick, no sooner than its own link times (≈2.2 s to alerting, ≈2.85 s to
connected). A port without `dial` behaves as the synthetic network: every call alerts and
connects at once. Rings come in through `subscribeCalls(ring)`: `ring({ number }, link)` shows a
call and returns the phone's control, whose `released()` ends it (before Answer: a missed call);
`link.answer()` and `link.hangUp()` report the user's Answer and End/reject. After Answer, the
host calls `connected()` when the incoming speech channel is ready; the synthetic network does
this at Answer. Without that event the answered call stays up without a connection redraw or
connected duration (the original plan 25 emulator cell).

A website can turn numbers into links: open a URL when its number is dialled and end the call
with the stock network's end (no telephony involved):

```ts
import {
  createStockPhone,
  createSyntheticNetwork,
  type StockNetworkPort,
} from "@hellotimber/nokia-os";

const LINKS: Record<string, string> = { "448482": "https://github.com/lachieh" }; // "GITHUB"
const sms = createSyntheticNetwork();
const network: StockNetworkPort = {
  ...sms,
  dial(call, phone) {
    const url = LINKS[call.number];
    if (url !== undefined) {
      window.open(url, "_blank", "noopener");
      phone.released(); // refused: the network's end, then standby
    } else {
      phone.alerting(); // or ring for a while, then connect or release
      phone.connected();
    }
    return { answer() {}, hangUp() {} };
  },
};
const phone = createStockPhone({ carrier: "Telstra", network });
```

`createSyntheticNetwork()` implements both halves: `ring(number)` rings every subscribed phone
and returns a handle (`hangUp()`, `state`), and `dialled` lists the calls phones placed.

**Plan 22b** adds the network services behind the same port: supplementary service and USSD
strings (`*#21#`, `Requesting`), Hold, New call and Send DTMF in a call, the DTMF a number sends
after `p`/`w`, call costs and Call divert.

## T9 predictive text

Plan 18b adds the firmware's T9 to the SMS editor (Write messages, Reply, Edit, Forward), checked
against 303 goldens of emulator captures (`t9/*`) and specified in
[`docs/specs/t9-behaviour.md`](../../docs/specs/t9-behaviour.md). With an English dictionary the
virgin phone writes in T9, as the firmware does:

```ts
import { createStockPhone } from "@hellotimber/nokia-os";

// A separate entry point: bundlers emit it as its own chunk (≈246 kB, ≈117 kB gzipped), fetched
// once, and hosts that never open Write messages can leave it out.
const { englishT9 } = await import("@hellotimber/nokia-os/t9-english");
const phone = createStockPhone({ carrier: "Telstra", t9: { english: englishT9 } });
```

- **Keys.** One press per letter: the composing word (underlined, each letter's case fixed when
  typed) shows the best candidate; `*` cycles the list, the last candidate with `?` and the soft
  key Spell; `0` ends the word and adds a space; key 1 gives punctuation alone, a word with each
  mark after a word, and contractions (`don't`); a key no word follows drops silently after one
  key and shows `?` after more; `#` toggles `Abc`/`abc` between words and `abc`/`ABC` in one,
  held `#` is `123`; held digits type the digit; C shortens the word and re-enters the word before
  a deleted space; ▲/▼ stop at word starts and ends (an end re-enters the word); held `*` opens
  the symbol table. There is no commit timeout.
- **Options.** Twelve entries (thirteen with Matches while a word composes): Matches (the other
  candidates, then the current, Use), Insert word, Insert number, Insert symbol and Dictionary
  (Dictionary off shows `T9 dictionary deactivated`, English `T9 dictionary activated`;
  Русский and Български open plan 26's placeholders). Spell and Insert word open the
  `Insert word:` prompt (multi-tap, the message's counter); OK inserts the word and learns it.
- **User words.** The `t9-user` EEPROM record (version 1) keeps the learned words oldest first,
  each with its case, `{"words":["Hovo","intos"]}`: an exact user word comes second in its list,
  longer ones complete at the end; the store holds words while Σ(length + 1) ≤ 840 and drops the
  oldest. It is written at once, so learned words survive a power cycle, and Restore factory
  settings keeps it (as it keeps the Dictionary choice).
- **Without a dictionary** (no `config.t9.english`) the phone behaves as after plan 18: the
  virgin Dictionary is off, Write messages is multi-tap and English opens a placeholder owned by
  `config` (the host). `createT9Dictionary("english", source)` builds a dictionary from the
  generated format (`#<w>` weight lines, words after them) for hosts and tests.
- **The dictionary** is built by `scripts/build-t9-dictionary.ts` from the MIT-licensed
  [IlyaSemenov/wikipedia-word-frequency](https://github.com/IlyaSemenov/wikipedia-word-frequency)
  English counts (pinned commit and SHA-256): its 30,000 most frequent lower-case words, weighted
  `floor(4 log2(count))`. Provenance, filter and licence:
  [`src/text/t9/THIRD_PARTY.md`](src/text/t9/THIRD_PARTY.md). No firmware dictionary content is
  in the repository.
- **Not reproduced** (spec 15): which words the firmware knows and their order, its nonsense
  stems, its single-key letter order where it differs, and its exact compositions after key 1
  (nokia-os lists the dictionary's contractions, then the word joined by `'`, then by `.`). One
  golden stays a known gap: after a word and a space a short `*` leaves one pixel lit on the
  underline row, a rule nothing explains yet.

## The phone book

The names live on the SIM card a host inserts (`StockPhoneConfig.sim`), as on the real phone (no
phone memory): its id, its locations (default 50, the emulator SIM's), its name length (default 16)
and its initial entries, plus its service numbers. A host passes its own contacts:

```ts
import { createStockPhone, type StockSimCard } from "@hellotimber/nokia-os";

const sim: StockSimCard = {
  id: "my-sim",
  phoneBook: {
    entries: [
      { name: "Ada", number: "0412000001" },
      null, // a free location
      { name: "Grace Hopper", number: "+61412000002" },
    ],
  },
  serviceNumbers: [{ name: "Voice mail", number: "101" }],
};
const phone = createStockPhone({ storage: window.localStorage, sim });
```

`createStockPhone` throws for an invalid SIM (an empty id, fewer than one location or name
character, more entries than locations, a name too long for the SIM or a number it cannot hold),
naming the field and the location. **Persistence (D3):** the phone keeps each SIM's names, speed
dials and assigned tones in its EEPROM (the `phone-book` record) by SIM id. The host's entries are
read only until the phone first changes that SIM's names; from then on the EEPROM's copy is the
SIM's (so the same id with other entries shows the phone's edits), and another SIM id has its own
phone book. Erasing the EEPROM returns to the host's entries.

Standby ▼ opens the list (▲ opens the dialled numbers, plan 22's); Search, Service Nos., Add name,
Erase, Edit, Assign tone (with previews), Send b'card, Options (Type of view, Memory status), Speed
dials and Voice tags (`Voice system error`: the emulator has no voice DSP) follow the v6.39
captures; Write messages' number prompts pick a number with `Search`, and Send to many sends to a
chosen name. **Later plans:** plan 22 adds calls (every `Call` soft key, held 2-9 speed dialling,
caller names and assigned ringing tones through `StockPhoneBook.speedDial`, `byNumber` (plan 30:
the last-9-digits match) and `tone`);
18c adds receiving business cards (`Business card received`, `Save business card?`).

## SIM content and SIM services

A host supplies its content where a 2000 phone kept it (plan 30), and implements nothing else:

| Content                                  | Where a 3310 keeps it           | nokia-os                                    |
| ---------------------------------------- | ------------------------------- | ------------------------------------------- |
| contacts, service numbers                | SIM `EF_ADN`, `EF_SDN`          | `StockSimCard.phoneBook`, `.serviceNumbers` |
| received SMS                             | SIM `EF_SMS`                    | `StockSimCard.messages`                     |
| SIM services menu and screens            | the SIM's toolkit applet        | `StockSimCard.toolkit`                      |
| IMEI                                     | the phone                       | `StockPhoneConfig.imei`                     |
| Welcome note, Reminders                  | phone memory, typed by the user | `StockPhoneConfig.preload`, applied once    |
| missed/received calls, durations, alarms | phone memory, made by events    | none: a host plays the events               |

```ts
import {
  createStockPhone,
  describeStockScreen,
  stockMenuFor,
  type StockSimCard,
} from "@hellotimber/nokia-os";

const sim: StockSimCard = {
  id: "my-sim",
  phoneBook: { entries: [{ name: "Ada", number: "0412000001" }] },
  messages: {
    slots: 15, // the SIM's records: its capacity (default 15)
    entries: [
      // by slot (index 0 = slot 1); null = a free slot
      {
        number: "0412000001",
        text: "Hello!",
        sentAt: { year: 2026, month: 10, day: 13, hour: 9, minute: 30, second: 0 },
        read: false,
      },
    ],
  },
  toolkit: {
    title: "Portfolio", // Menu 14's carousel label
    items: [
      { id: "about", label: "About", steps: [{ kind: "text", text: "Content on the SIM card." }] },
      {
        id: "places",
        label: "Places",
        steps: [
          {
            kind: "select",
            items: [
              {
                id: "office",
                label: "Office",
                steps: [{ kind: "call", number: "0298765432", confirm: "Call the office?" }],
              },
            ],
          },
        ],
      },
    ],
  },
};
const phone = createStockPhone({
  carrier: "Orange F",
  storage: window.localStorage,
  sim,
  imei: "490154203310018",
  preload: { welcomeNote: "Hello", reminders: [{ text: "Call Ada" }] },
});
stockMenuFor(sim).paths(); // [..., "menu/sim-services", "menu/sim-services/about", "menu/sim-services/places"]
phone.subscribe(({ screen }) => (mirror.textContent = describeStockScreen(screen)));
```

- **SMS on the SIM.** The Inbox lists unread messages first, then read ones, each in slot order (the
  order taken when the Inbox opens); an arrival or a Save takes the first free slot; `No space for
new messages` when every slot is used. Power-on with unread SIM messages shows the standby
  envelope only (no notice, no tone). Text is one SMS: GSM 7-bit (the extension table counts two
  septets; `[ ] { } ~ | ^` draw as `?`), at most 160 septets, drawable in the small face. Read on a
  message shows `Opening message` first. **Persistence:** the host's messages are the SIM's contents
  until the phone first writes that SIM's messages (a read, an erase, an arrival, a Save); from then
  on the `messages` record's copy (plan 19's rule). Restore factory settings keeps them.
- **Sender names.** A sender in the phone book is listed and read under its name (the list,
  `Sender:`, Details): two numbers match on their last 9 digits (or all digits of a shorter one),
  `+` and leading digits ignored; an exact match wins.
- **SIM services (Menu 14).** A toolkit adds a 13th carousel slot numbered 14 (no 13: `Menu 1 4` opens it), labelled with the
  toolkit's title (the words that fit), with its own icon; its level lists the items (labels cut with
  `...` where wide). Choosing an item fetches behind `Wait`, then shows its steps: text pages
  (`DISPLAY TEXT`, OK on, C back), lists (`SELECT ITEM`, nested) and calls the phone confirms (`SET
UP CALL`: composed, `confirm` or `Allow SIM card to call?`). The session ends after the item's last
  step (back on the level). A confirmed call goes through plan 22's dial (a placeholder until plan 22
  lands), inside the confirming key's `send()` so a browser host keeps the user activation.
- **Validation.** `createStockPhone` and `stockMenuFor` throw for an invalid SIM, naming the field
  path (`SIM card "my-sim": toolkit.items[1].steps[0].text has characters the stock small font
lacks: …`): messages (numbers, GSM text, time stamps, slots), toolkit (kebab-case ids unique per
  list, 1-255 items, lists at most 4 deep, faces, a text page within one command's 273 septets, a
  confirm within three lines, call numbers by the SIM's rules).
- **Not on the SIM:** `EF_LND` (v6.39 never reads it: dialled numbers are phone memory, plan 22).

### Host identity and preload

`imei` (15 digits, Luhn-valid) is what `*#06#` shows (`stockImeiLines(imei)`: `Serial No.` over ten
digits and five; the screen is plan 22's). `preload` writes the Welcome note while storage has no
`settings` record and the reminders (in order, as Add would, plan 21) while it has no `reminders`
record, so a visitor's edits and erasures survive; every string must be typeable, within its
editor's limit and drawable.

### Screen text

`describeStockScreen(screen)` reads any screen as plain text for an accessibility mirror and
headless QA: standby (operator, profile line, clock, indicators, a notice), the carousel slot, a
level's selected row and place, and every stock widget (notes, lists, editors, prompts, pages,
Snake II's score, placeholders). It is not pixels: no golden asserts it.

## Plan-owned resource evidence

Each `PlanCaptureSet` can declare `resources`, normally imported from its own
`scripts/resource-inputs/<NN>-<slug>.ts`. Its existing export in
`scripts/capture-sets/index.ts` registers both capture imports and resource evidence.
Extraction reads only committed indexed LCD goldens and never runs the capture callbacks.

`resources` accepts `textRuns` (golden → image → `TextRun[]`), `glyphOverrides`,
`spriteBatches`, `timelineBatches` and `timelineGroups`. A glyph specimen is a
single-character text run plus an explicit advance/bearing resolution when needed.
Batches have an integer `order` and an ordered `entries` array. Existing widget
blocks use sprite positions 10/20/30 and timeline positions 10/20/30/40 to retain
first-match behavior and generated bytes. New plans choose distinct positions,
for example 180 for plan 18 or 200 for plan 20. Kind mappings and probe targets
have one owner; probes target exactly one `node` or `name`. Explicit node probes
replace automatic tree timelines, as the existing longer progress capture does.

Duplicate ownership, absent indexed LCD fixtures/images, invalid bands/crops,
empty sprites and unknown timeline kinds/groups fail before resource output is
written. Font conflicts and malformed timelines also fail extraction. See
[plan 29](../../docs/plans/29-capture-resource-registrations.md) for consumer examples,
ownership and checks. Neither generated resources nor goldens are edited by hand.

New fixtures may stay `pending:<plan>` while glyphs, crops and named probe timelines
are extracted from them. Acceptance reports them as todos. Promote each fixture
through its capture importer only after a verified scenario exists in the acceptance
file owning its original index. This applies to glyph and picture stills too;
`knownGaps` cannot replace an absent scenario. Pending owners such as `18c` use the
same plan-number grammar as capture registrations. No resource-specific scenario
exemption is needed.

## Leaf ownership

Leaves that are whole applications open the placeholder, tagged with the plan that owns them:
Picture messages and Screen saver › Screen saver (18c); the three
native languages (26); the other games' New game (24); Calculator (20). Prompts and empty-state
notes show their first screen until the plans for Phone book (19) and Call register and Call
divert (22) take them over.

## Capture artefacts

The emulator's virgin EEPROM and synthetic network leave marks that the OS does not reproduce:

| Artefact                                       | Handling                                           |
| ---------------------------------------------- | -------------------------------------------------- |
| Operator `Orange F`, clock `10:10`, setup date | host config and ports; goldens pass them as inputs |
| Security-code prompt at every virgin power-on  | reproduced as the Phone security gate (new SIM)    |
| In-menu `Code error` for `12345`               | never recorded; wrong-code goldens use `00000`     |
| Clock wizard after the boot                    | not imported; the boot ends at standby             |
| First standby `Snooze` prompt                  | the junk reminder's alert; the entry kept dormant  |
| The time of day never advances; dormant alarm  | the host clock is the RTC; captures use `settime`  |
| Profiles slot 6 name                           | two U+E000 boxes, as captured                      |
| Page values (`Level 1`, `Off`, …)              | the virgin EEPROM (empty storage)                  |
| Unset tone lists, `Top score: 45`, score IDs   | the virgin EEPROM (empty storage)                  |
| Snake II level 175 (one cell per ≈7.7 ms)      | the virgin EEPROM; Restore returns it to virgin    |
| `Requesting` / `Searching` never finish        | the bar loops until Quit or C                      |
| Network: every send succeeds, no loopback      | `createSyntheticNetwork`; hosts decide outcomes    |
| SMS sender `12345` for `Nokia`, 120 septets    | replays map the helper's encoding; not reproduced  |
| Messages lost in a new emulator process        | the `messages` record persists them (D7 policy)    |

Composer Send uses the optional `StockNetworkPort.sendRingtone({ to, tone })` callback.
`tone` contains the typed name, tempo and Composer notation tokens; the host encodes the
wire payload. It returns `"sent"`, `"failed"`, or a Promise of either. Rejection means failed;
power-off ignores pending results. Without the callback the synthetic cell accepts the tone.
`createSyntheticNetwork().tones` lists snapshots of transmitted tones. Send does not save the
Composer slot. Its Sending message / Message sent / editor flow is asserted by
`composer/send-ok` (plan 27's fixture, implemented by plan 18c).

### Supplementary service host (plan 22b)

`StockNetworkPort.requestService(text, control, signal)` receives standby service
strings and menu-generated forwarding/waiting requests. Call
`control.completed(result)` with an active/inactive forwarding result, a waiting
result, or failure. The phone applies that outcome at its next tick. Abort ends
the operation on Quit, C, navigation or power-off; later completions are ignored.
An absent responder, including the default synthetic network, stays unanswered
and reaches the captured Not done timeout. It never succeeds locally.

Unconditional forwarding's indicator follows confirmed network outcomes in RAM.
Persistence across power cycles remains UNVERIFIED: the canonical reboot reaches
a security gate, not settled standby. The host remains the service authority.

The optional call-link methods `hold()`, `retrieve()` and `sendDtmf(text, signal)`
return boolean outcomes or promises. Their absence does not imply success. The
explicit synthetic network acknowledges these operations. A host can abort DTMF
work when its signal aborts; late success cannot revive a released call.

Outgoing calls include the stock `ownNumberSending` policy for non-emergency
calls. `control.released(cause?)` may name the GSM release cause; the captured
phone renders all causes alike. Charging stays zero without network advice;
nonzero charging and broader automatic-redial policy are not implemented.
