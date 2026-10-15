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
open word list (plan 18b; see "T9 predictive text"). Leaves that are whole applications open a marked
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
  sim: "sim-1", // the inserted SIM card (default "sim-1")
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
`#`, and `P` power (held for 1 s). The buttons do the same. In Snake II the digits steer (2/4/6/8,
and 1/3/7/9 relative), ▲/▼ and `*`/`#` turn, Enter or Escape suspend the game. The demo validates
the operator name, can skip the boot, and shows the phone's path, screen kind and application in
a status line with the EEPROM records stored. The phone's EEPROM is the page's localStorage:
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
message, and the messages the phone sent are listed beside it. The T9 English dictionary loads as
a chunk of its own after the page and restarts the phone with it (the status line shows `T9:
English (30000 words)`); unticking **T9 English dictionary** restarts the phone without one, as a
host that leaves it out (Write messages is then multi-tap). In dev it also lays any committed golden over the LCD, as an overlay or as a pixel
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
are compared after aligning on the first changed frame, within ±2 ms (probes that replay another
recording's timings or press later keys: `PROBE_TOLERANCE_MS`, 25 ms). Its `knownGaps` list the
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
The Russian, Bulgarian and Ukrainian UIs (plan 26), profile switching (17), Clear timers' effect
and the call-list erase (22) and Phone book › Erase all (19) are left to later plans. SIM PIN,
PIN2 and barring passwords keep their first screen.

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
- **Later plans.** An arriving SMS plays the Message alert tone (plan 18, General's settings until
  profiles). The incoming call's ringing and DTMF (22), alarms and reminders (21), profile switching (17), the other games' sounds (24) and the Composer (27) play
  through the same sequencer.

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
  the stock Options (Erase, Reply, Edit, Forward, Details; Chat and Use number's dialling are
  later plans'). Arrivals show `1 message received` (Read) and the envelope at standby, wait for
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

**Later plans.** 18c adds Chat over the same messaging service, Templates, Smileys, Picture messages
(a binary extension of the port), Info service topics and the Service command editor. Phone book
names (19), dialling a message's number and the received notice's ▲/▼/digit keys (22) and the
profiles' message alert (17) are theirs.

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
Service command editor, Picture messages, Templates, Smileys, Topics, Chat and Screen saver ›
Screen saver (18c); Composer slots (27); the three
native languages (26); the other games' New game (24); Calculator (20); Stopwatch (21); Profiles ›
Activate (17). Prompts and empty-state notes show their first screen until the plans for Phone book (19), Clock and Reminders (21) and Call register and Call divert (22) take them
over.

## Capture artefacts

The emulator's virgin EEPROM and synthetic network leave marks that the OS does not reproduce:

| Artefact                                       | Handling                                           |
| ---------------------------------------------- | -------------------------------------------------- |
| Operator `Orange F`, clock `10:10`, setup date | host config and ports; goldens pass them as inputs |
| Security-code prompt at every virgin power-on  | reproduced as the Phone security gate (new SIM)    |
| In-menu `Code error` for `12345`               | never recorded; wrong-code goldens use `00000`     |
| Clock wizard after the boot                    | not imported; the boot ends at standby             |
| First standby `Snooze` prompt                  | not imported                                       |
| Profiles slot 6 name                           | two U+E000 boxes, as captured                      |
| Page values (`Level 1`, `Off`, …)              | the virgin EEPROM (empty storage)                  |
| Unset tone lists, `Top score: 45`, score IDs   | the virgin EEPROM (empty storage)                  |
| Snake II level 175 (one cell per ≈7.7 ms)      | the virgin EEPROM; Restore returns it to virgin    |
| `Requesting` / `Searching` never finish        | the bar loops until Quit or C                      |
| Network: every send succeeds, no loopback      | `createSyntheticNetwork`; hosts decide outcomes    |
| SMS sender `12345` for `Nokia`, 120 septets    | replays map the helper's encoding; not reproduced  |
| Messages lost in a new emulator process        | the `messages` record persists them (D7 policy)    |
