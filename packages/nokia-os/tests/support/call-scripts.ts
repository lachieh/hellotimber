// How each plan 22 recording was made, transcribed from `gen_v639_plan22.py` (Task 0): the
// image's state, CAP_MO_HOLD (an outgoing call held alerting until `!answer`), the harness tokens
// played from a settled standby before recording (`setup`), and the recorded tokens (`keys`: raw
// edges, a tap 60 ms down then 240 ms; `!callin:<n>`, `!hangup`, `!answer` the network's).
import type { CallScript } from "./calls.ts";

export const CALL_SCRIPTS: Readonly<Record<string, CallScript>> = {
  "calls/code-imei": { setup: "* +1700 # 0 6", keys: "#" },
  "calls/code-imei-navi": { setup: "* +1700 # 0 6 #", keys: "+1000 menu" },
  "calls/code-version": { setup: "* +1700 # 0 0 0 0", keys: "#" },
  "calls/code-version-navi": { setup: "* +1700 # 0 0 0 0 #", keys: "+1000 menu" },
  "calls/dial-alerting": { moHold: true, setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +6000 !answer" },
  "calls/dial-c-alerting": { moHold: true, setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +4000 c" },
  "calls/dial-c-calling": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +1000 c" },
  "calls/dial-c-connected": {
    setup: "0 4 1 2 3 4 5 6 7 8",
    keys: "menu +5000 c +2000 c +2000 menu",
  },
  "calls/dial-c-held-connected": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +5000 c@1500" },
  "calls/dial-call": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu" },
  "calls/dial-end-alerting": {
    moHold: true,
    setup: "0 4 1 2 3 4 5 6 7 8",
    keys: "menu +4000 menu",
  },
  "calls/dial-end-calling": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +1000 menu" },
  "calls/dial-end-connected": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +7000 menu" },
  "calls/dial-net-end-alerting": {
    moHold: true,
    setup: "0 4 1 2 3 4 5 6 7 8",
    keys: "menu +4000 !hangup:16",
  },
  "calls/dial-net-end-connected": { setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu +7000 !hangup:16" },
  "calls/dial-number-112": { setup: "1 1 2", keys: "menu" },
  "calls/dial-number-12": { setup: "1 2", keys: "menu" },
  "calls/dial-number-911": { setup: "9 1 1", keys: "menu" },
  "calls/dial-number-hash-ended": { setup: "1 2 3 #", keys: "menu" },
  "calls/dial-number-one-1": { setup: "1", keys: "menu" },
  "calls/dial-number-one-digit": { setup: "5", keys: "menu" },
  "calls/dial-number-pause": { setup: "0 4 1 2 3 4 5 6 7 8 * * * +1700 1 2 3", keys: "menu" },
  "calls/dial-number-plus": { setup: "* * +1700 6 1 4 1 2 3 4 5 6 7 8", keys: "menu" },
  "calls/dial-number-plus-later": { setup: "0 4 1 2 * * +1700 3 4 5", keys: "menu" },
  "calls/dial-number-ten": { setup: "1 2 3 4 5 6 7 8 9 0", keys: "menu" },
  "calls/dial-number-thirty-three": {
    setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3",
    keys: "menu",
  },
  "calls/dial-number-thirty-two": {
    setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2",
    keys: "menu",
  },
  "calls/dial-number-twenty": { setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0", keys: "menu" },
  "calls/dial-number-twenty-eight": {
    setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8",
    keys: "menu",
  },
  "calls/durations-clear-timers": {
    state: "factory",
    setup:
      "!callin:0466666666 +3000 menu +4500 menu +2500 menu +300 down down down +800 menu +1500 down down down down +500 menu +1500 down down down down menu +1500 1 2 3 4 5",
    keys: "menu +4000",
  },
  "calls/entry-c-held-475": { setup: "1 2 3 4", keys: "c@475" },
  "calls/entry-c-held-500": { setup: "1 2 3 4", keys: "c@500" },
  "calls/entry-c-held-long": { setup: "1 2 3 4", keys: "c@1500" },
  "calls/entry-c-last": { setup: "5", keys: "c" },
  "calls/entry-c-last-star": { setup: "", keys: "* +300 c" },
  "calls/entry-c-one": { setup: "1 2 3", keys: "c" },
  "calls/entry-down-held": { setup: "1 2 3 4", keys: "down@2500" },
  "calls/entry-first-digit": { setup: "", keys: "5" },
  "calls/entry-idle": { setup: "1 2 3 4", keys: "" },
  "calls/entry-large-to-small": { setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6", keys: "7" },
  "calls/entry-second-digit": { setup: "5", keys: "6" },
  "calls/entry-star-commit": { setup: "", keys: "*" },
  "calls/entry-star-cycle-commit": { setup: "", keys: "* * * * *" },
  "calls/entry-star-digit": { setup: "1", keys: "* +300 5" },
  "calls/entry-up-held": { setup: "1 2 3 4", keys: "up@2500" },
  "calls/handover-carousel-0": { setup: "menu +4000", keys: "0" },
  "calls/handover-carousel-hash": { setup: "menu +4000", keys: "#" },
  "calls/handover-carousel-star": { setup: "menu +4000", keys: "*" },
  "calls/handover-list-5": { setup: "menu +300 down down down +800 menu +1500", keys: "5" },
  "calls/handover-list-hash": { setup: "menu +300 down down down +800 menu +1500", keys: "#" },
  "calls/handover-list-star": { setup: "menu +300 down down down +800 menu +1500", keys: "*" },
  "calls/handover-note-5": {
    setup: "menu +300 down down down +800 menu +1500 menu",
    keys: "+600 5",
  },
  "calls/handover-note-hash": {
    setup: "menu +300 down down down +800 menu +1500 menu",
    keys: "+600 #",
  },
  "calls/handover-note-star": {
    setup: "menu +300 down down down +800 menu +1500 menu",
    keys: "+600 *",
  },
  "calls/handover-notice-digit": { setup: "!callin:0412345678 +5000 !hangup +4000", keys: "5" },
  "calls/handover-notice-down": { setup: "!callin:0412345678 +5000 !hangup +4000", keys: "down" },
  "calls/handover-notice-up": { setup: "!callin:0412345678 +5000 !hangup +4000", keys: "up" },
  "calls/handover-option-list-5": {
    setup: "menu +300 down down down down +800 menu +1500 down down down +500 menu +1500",
    keys: "5",
  },
  "calls/handover-shortcut-list-late": { setup: "menu 4 +5000", keys: "5" },
  "calls/hold-empty-0": { setup: "", keys: "0@1000" },
  "calls/hold-empty-1": { setup: "", keys: "1@1000" },
  "calls/hold-empty-2": { setup: "", keys: "2@1000" },
  "calls/hold-empty-3": { setup: "", keys: "3@1000" },
  "calls/hold-empty-4": { setup: "", keys: "4@1000" },
  "calls/hold-empty-5": { setup: "", keys: "5@1000" },
  "calls/hold-empty-6": { setup: "", keys: "6@1000" },
  "calls/hold-empty-7": { setup: "", keys: "7@1000" },
  "calls/hold-empty-8": { setup: "", keys: "8@1000" },
  "calls/hold-empty-9": { setup: "", keys: "9@1000" },
  "calls/hold-empty-hash": { setup: "", keys: "#@1000" },
  "calls/hold-empty-star": { setup: "", keys: "*@1000" },
  "calls/hold-inside-0": { setup: "1 2", keys: "0@1000" },
  "calls/hold-inside-1": { setup: "1 2", keys: "1@1000" },
  "calls/hold-inside-2": { setup: "1 2", keys: "2@1000" },
  "calls/hold-inside-3": { setup: "1 2", keys: "3@1000" },
  "calls/hold-inside-4": { setup: "1 2", keys: "4@1000" },
  "calls/hold-inside-5": { setup: "1 2", keys: "5@1000" },
  "calls/hold-inside-6": { setup: "1 2", keys: "6@1000" },
  "calls/hold-inside-7": { setup: "1 2", keys: "7@1000" },
  "calls/hold-inside-8": { setup: "1 2", keys: "8@1000" },
  "calls/hold-inside-9": { setup: "1 2", keys: "9@1000" },
  "calls/hold-inside-hash": { setup: "1 2", keys: "#@1000" },
  "calls/hold-inside-star": { setup: "1 2", keys: "*@1000" },
  "calls/hold-one-475": { setup: "", keys: "1@475" },
  "calls/hold-one-500": { setup: "", keys: "1@500" },
  "calls/in-call-c": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "c +1500 c +1500" },
  "calls/in-call-digit-0": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "0" },
  "calls/in-call-digit-1": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "1" },
  "calls/in-call-digit-2": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "2" },
  "calls/in-call-digit-3": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "3" },
  "calls/in-call-digit-4": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "4" },
  "calls/in-call-digit-5": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "5" },
  "calls/in-call-digit-6": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "6" },
  "calls/in-call-digit-7": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "7" },
  "calls/in-call-digit-8": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "8" },
  "calls/in-call-digit-9": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "9" },
  "calls/in-call-digit-hash": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "#" },
  "calls/in-call-digit-held": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "5@1500" },
  "calls/in-call-digit-star": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "*" },
  "calls/in-call-digits": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "1 2 3 4 5 6 7 8 9 0 * # 1 2 3 4 5 6",
  },
  "calls/in-call-digits-options": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 5 +500", keys: "menu" },
  "calls/in-call-down": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "down" },
  "calls/in-call-down-held": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "down@3000" },
  "calls/in-call-down-steps": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "down down down down down down down down down down down",
  },
  "calls/in-call-long": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "" },
  "calls/in-call-options": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "c +1000 menu" },
  "calls/in-call-options-c": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500",
    keys: "c",
  },
  "calls/in-call-options-select-0": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500",
    keys: "menu",
  },
  "calls/in-call-options-select-1": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down",
    keys: "menu",
  },
  "calls/in-call-options-select-2": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down",
    keys: "menu",
  },
  "calls/in-call-options-select-3": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down",
    keys: "menu",
  },
  "calls/in-call-options-select-4": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down",
    keys: "menu",
  },
  "calls/in-call-options-select-5": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down",
    keys: "menu",
  },
  "calls/in-call-power": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "pwr +1500 c" },
  "calls/in-call-up": { setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "up" },
  "calls/in-call-up-steps": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000 down down down +3000",
    keys: "up up up up up",
  },
  "calls/interrupt-calculator-answer-end": {
    setup: "menu +300 up up up up +2000 menu +1500 1 2",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-calculator-missed": {
    setup: "menu +300 up up up up +2000 menu +1500 1 2",
    keys: "!callin:0412345678 +3000 !hangup",
  },
  "calls/interrupt-calculator-reject": {
    setup: "menu +300 up up up up +2000 menu +1500 1 2",
    keys: "!callin:0412345678 +3000 c",
  },
  "calls/interrupt-editor-answer-end": {
    setup: "menu +300 down +800 menu +2000 menu +2000 2 2",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-editor-missed": {
    setup: "menu +300 down +800 menu +2000 menu +2000 2 2",
    keys: "!callin:0412345678 +3000 !hangup",
  },
  "calls/interrupt-editor-reject": {
    setup: "menu +300 down +800 menu +2000 menu +2000 2 2",
    keys: "!callin:0412345678 +3000 c",
  },
  "calls/interrupt-entry-answer-end": {
    setup: "1 2 3 4 5",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-entry-missed": { setup: "1 2 3 4 5", keys: "!callin:0412345678 +3000 !hangup" },
  "calls/interrupt-entry-reject": { setup: "1 2 3 4 5", keys: "!callin:0412345678 +3000 c" },
  "calls/interrupt-menu-answer-end": {
    setup: "menu +300 down +800 menu +2000",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-menu-missed": {
    setup: "menu +300 down +800 menu +2000",
    keys: "!callin:0412345678 +3000 !hangup",
  },
  "calls/interrupt-menu-reject": {
    setup: "menu +300 down +800 menu +2000",
    keys: "!callin:0412345678 +3000 c",
  },
  "calls/interrupt-note-reject": {
    setup: "menu +300 down down down +800 menu +1500",
    keys: "menu +300 !callin:0412345678 +2200 c",
  },
  "calls/interrupt-note-short": {
    setup: "menu +300 down down down +800 menu +1500",
    keys: "menu +300 !callin:0412345678 +500",
  },
  "calls/interrupt-option-list-answer-end": {
    setup: "menu +300 down down down down +800 menu +1500 down down down +500 menu +1500",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-option-list-missed": {
    setup: "menu +300 down down down down +800 menu +1500 down down down +500 menu +1500",
    keys: "!callin:0412345678 +3000 !hangup",
  },
  "calls/interrupt-option-list-reject": {
    setup: "menu +300 down down down down +800 menu +1500 down down down +500 menu +1500",
    keys: "!callin:0412345678 +3000 c",
  },
  "calls/interrupt-ring-during-call": {
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "!callin:0499999999 +5000 menu",
  },
  "calls/interrupt-snake-answer-end": {
    setup: "menu +300 up up up up up +2000 menu +2000 menu +2500 menu +3000",
    keys: "!callin:0412345678 +3000 menu +4500 menu",
  },
  "calls/interrupt-snake-reject": {
    setup: "menu +300 up up up up up +2000 menu +2000 menu +2500 menu +3000",
    keys: "!callin:0412345678 +3000 c",
  },
  "calls/recall-0-hash": { setup: "0", keys: "#" },
  "calls/recall-1-hash": { setup: "1", keys: "#" },
  "calls/recall-12-hash": { setup: "1 2", keys: "#" },
  "calls/recall-250-hash": { setup: "2 5 0", keys: "#" },
  "calls/recall-50-hash": { setup: "5 0", keys: "#" },
  "calls/recall-51-hash": { setup: "5 1", keys: "#" },
  "calls/recall-note-c": { setup: "1", keys: "# +800 c" },
  "calls/recall-note-call": { setup: "1", keys: "# +800 menu" },
  "calls/recall-note-digit": { setup: "1", keys: "# +800 5" },
  "calls/register-dialled-open": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600",
    keys: "menu",
  },
  "calls/register-dialled-options-open": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500",
    keys: "menu",
  },
  "calls/register-edit-number": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down",
    keys: "menu",
  },
  "calls/register-edit-number-c": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down menu +1500",
    keys: "c",
  },
  "calls/register-edit-number-ok": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down menu +1500",
    keys: "menu",
  },
  "calls/register-erase": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down down",
    keys: "menu",
  },
  "calls/register-erase-c": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down down menu +1500",
    keys: "c",
  },
  "calls/register-erase-lists-all": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500",
    keys: "menu +4000",
  },
  "calls/register-erase-lists-dialled": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down",
    keys: "menu +4000",
  },
  "calls/register-erase-lists-missed": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down",
    keys: "menu +4000",
  },
  "calls/register-erase-lists-received": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down down",
    keys: "menu +4000",
  },
  "calls/register-erase-ok": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down down menu +1500",
    keys: "menu",
  },
  "calls/register-list-c": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500",
    keys: "c",
  },
  "calls/register-missed-12-open": {
    setup:
      "!callin:0410000000 +3000 !hangup +3500 c +500 !callin:0410000001 +3000 !hangup +3500 c +500 !callin:0410000002 +3000 !hangup +3500 c +500 !callin:0410000003 +3000 !hangup +3500 c +500 !callin:0410000004 +3000 !hangup +3500 c +500 !callin:0410000005 +3000 !hangup +3500 c +500 !callin:0410000006 +3000 !hangup +3500 c +500 !callin:0410000007 +3000 !hangup +3500 c +500 !callin:0410000008 +3000 !hangup +3500 c +500 !callin:0410000009 +3000 !hangup +3500 c +500 !callin:0410000010 +3000 !hangup +3500 c +500 !callin:0410000011 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500",
    keys: "menu",
  },
  "calls/register-missed-empty": {
    setup: "menu +300 down down down +800 menu +1500",
    keys: "menu",
  },
  "calls/register-missed-open": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0455555555 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500",
    keys: "menu",
  },
  "calls/register-missed-open-read": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0455555555 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500 menu +4000 c +1000",
    keys: "menu",
  },
  "calls/register-missed-options": {
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0455555555 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500 menu +4000",
    keys: "menu",
  },
  "calls/register-options-c": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500",
    keys: "c",
  },
  "calls/register-options-call": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500",
    keys: "menu",
  },
  "calls/register-options-call-end": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 menu +7000",
    keys: "menu",
  },
  "calls/register-received-open": {
    setup:
      "!callin:0466666666 +3000 menu +4500 menu +2500 !callin:0477777777 +3000 c +2000 menu +300 down down down +800 menu +1500 down",
    keys: "menu",
  },
  "calls/register-save": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down",
    keys: "menu",
  },
  "calls/register-send-sms": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down",
    keys: "menu",
  },
  "calls/register-standby-up": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
    keys: "up",
  },
  "calls/register-standby-up-c": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 up +1000",
    keys: "c",
  },
  "calls/register-standby-up-c-held": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 up +1000",
    keys: "c@1500",
  },
  "calls/register-standby-up-call": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 up +1000 down",
    keys: "menu",
  },
  "calls/register-standby-up-none": { setup: "", keys: "up" },
  "calls/register-time-of-call": {
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down",
    keys: "menu",
  },
  "calls/ring-answer": { setup: "!callin:0412345678 +3000", keys: "menu" },
  "calls/ring-answer-end": { setup: "!callin:0412345678 +3000 menu +4500", keys: "menu" },
  "calls/ring-end-by-caller": { setup: "!callin:0412345678 +3000 menu +4500", keys: "!hangup" },
  "calls/ring-key-5": { setup: "!callin:0412345678 +3000", keys: "5" },
  "calls/ring-key-down": { setup: "!callin:0412345678 +3000", keys: "down" },
  "calls/ring-key-hash": { setup: "!callin:0412345678 +3000", keys: "#" },
  "calls/ring-key-pwr": { setup: "!callin:0412345678 +3000", keys: "pwr" },
  "calls/ring-key-star": { setup: "!callin:0412345678 +3000", keys: "*" },
  "calls/ring-key-up": { setup: "!callin:0412345678 +3000", keys: "up" },
  "calls/ring-missed": { setup: "!callin:0412345678 +3000", keys: "!hangup" },
  "calls/ring-navi-held": { setup: "!callin:0412345678 +3000", keys: "menu@1500" },
  "calls/ring-notice-c": { setup: "!callin:0412345678 +3000 !hangup +4000", keys: "c" },
  "calls/ring-notice-list": { setup: "!callin:0412345678 +3000 !hangup +4000", keys: "menu" },
  "calls/ring-notice-list-11": {
    setup:
      "!callin:0400000000 +3000 !hangup +4000 !callin:0400000001 +3000 !hangup +4000 !callin:0400000002 +3000 !hangup +4000 !callin:0400000003 +3000 !hangup +4000 !callin:0400000004 +3000 !hangup +4000 !callin:0400000005 +3000 !hangup +4000 !callin:0400000006 +3000 !hangup +4000 !callin:0400000007 +3000 !hangup +4000 !callin:0400000008 +3000 !hangup +4000 !callin:0400000009 +3000 !hangup +4000 !callin:0400000010 +3000 !hangup +4000",
    keys: "menu",
  },
  "calls/ring-notice-list-2": {
    setup: "!callin:0412345678 +3000 !hangup +4000 !callin:0412345678 +3000 !hangup +4000",
    keys: "menu",
  },
  "calls/ring-notice-navi-held": {
    setup: "!callin:0412345678 +3000 !hangup +4000",
    keys: "menu@1500",
  },
  "calls/ring-notice-wait": { setup: "!callin:0412345678 +3000 !hangup +4000", keys: "" },
  "calls/ring-number-123": { setup: "", keys: "!callin:123" },
  "calls/ring-number-1234567890": { setup: "", keys: "!callin:1234567890" },
  "calls/ring-number-12345678901234": { setup: "", keys: "!callin:12345678901234" },
  "calls/ring-number-123456789012345": { setup: "", keys: "!callin:123456789012345" },
  "calls/ring-number-12345678901234567890": { setup: "", keys: "!callin:12345678901234567890" },
  "calls/ring-number-plus61412345678": { setup: "", keys: "!callin:+61412345678" },
  "calls/ring-reject": { setup: "!callin:0412345678 +3000", keys: "c" },
  "calls/ring-reject-held": { setup: "!callin:0412345678 +3000", keys: "c@1500" },
  "calls/ring-screen": { setup: "", keys: "!callin:0412345678" },
  "sound/calls/connected": { state: "factory", setup: "0 4 1 2 3 4 5 6 7 8", keys: "menu" },
  "sound/calls/dtmf-entry-keys": { state: "factory", setup: "1 2", keys: "up down c c@1500" },
  "sound/calls/dtmf-hold-0": { state: "factory", setup: "", keys: "0@1000" },
  "sound/calls/dtmf-hold-1": { state: "factory", setup: "", keys: "1@1000" },
  "sound/calls/dtmf-hold-2": { state: "factory", setup: "", keys: "2@1000" },
  "sound/calls/dtmf-hold-3": { state: "factory", setup: "", keys: "3@1000" },
  "sound/calls/dtmf-hold-4": { state: "factory", setup: "", keys: "4@1000" },
  "sound/calls/dtmf-hold-5": { state: "factory", setup: "", keys: "5@1000" },
  "sound/calls/dtmf-hold-6": { state: "factory", setup: "", keys: "6@1000" },
  "sound/calls/dtmf-hold-7": { state: "factory", setup: "", keys: "7@1000" },
  "sound/calls/dtmf-hold-8": { state: "factory", setup: "", keys: "8@1000" },
  "sound/calls/dtmf-hold-9": { state: "factory", setup: "", keys: "9@1000" },
  "sound/calls/dtmf-hold-hash": { state: "factory", setup: "", keys: "#@1000" },
  "sound/calls/dtmf-hold-star": { state: "factory", setup: "", keys: "*@1000" },
  "sound/calls/dtmf-keys": {
    state: "factory",
    setup: "",
    keys: "1 2 3 4 5 6 7 8 9 0 * # c c@1500",
  },
  "sound/calls/dtmf-keys-level-1": {
    state: "factory",
    setup: "menu 5 6 +2500 up menu +2500 c@1500 +1000",
    keys: "1 5 9 * # 0@1000",
  },
  "sound/calls/dtmf-keys-level-3": {
    state: "factory",
    setup: "menu 5 6 +2500 down menu +2500 c@1500 +1000",
    keys: "1 5 9 * # 0@1000",
  },
  "sound/calls/dtmf-keys-off": {
    state: "factory",
    setup: "menu 5 6 +2500 up up menu +2500 c@1500 +1000",
    keys: "1 5 9 * # 0@1000",
  },
  "sound/calls/dtmf-keys-virgin": { setup: "", keys: "1 5 9 * # 0@1000" },
  "sound/calls/dtmf-taps-fast": { state: "factory", setup: "", keys: "+0 1 +0 2 +0 3 +0" },
  "sound/calls/emergency": { state: "factory", setup: "1 1 2", keys: "menu" },
  "sound/calls/end": { state: "factory", setup: "0 4 1 2 3 4 5 6 7 8 menu +5000", keys: "menu" },
  "sound/calls/erased": {
    state: "factory",
    setup:
      "0 4 1 2 3 4 5 6 7 8 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down menu +1500",
    keys: "menu",
  },
  "sound/calls/in-call-keys": {
    state: "factory",
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "1 5 9 0 * # 5@1000 up down c c",
  },
  "sound/calls/net-end": {
    state: "factory",
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "!hangup:16",
  },
  "sound/calls/no-last-dialled": { state: "factory", setup: "", keys: "up" },
  "sound/calls/ring-answer": { state: "factory", setup: "", keys: "!callin:0412345678 +4000 menu" },
  "sound/calls/ring-ascending-vibrator-off": {
    state: "factory",
    setup:
      "menu 5 3 +2500 down menu +2500 c@1500 +1000 menu 5 8 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-ascending-vibrator-on": {
    state: "factory",
    setup: "menu 5 3 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-beep-once-vibrator-off": {
    state: "factory",
    setup:
      "menu 5 3 +2500 down down down menu +2500 c@1500 +1000 menu 5 8 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-beep-once-vibrator-on": {
    state: "factory",
    setup: "menu 5 3 +2500 down down down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-keys": {
    state: "factory",
    setup: "!callin:0412345678 +5000",
    keys: "up +1000 5 +1000 # +1000 down",
  },
  "sound/calls/ring-missed": {
    state: "factory",
    setup: "",
    keys: "!callin:0412345678 +4000 !hangup",
  },
  "sound/calls/ring-off-vibrator-off": {
    state: "factory",
    setup:
      "menu 5 3 +2500 down down down down menu +2500 c@1500 +1000 menu 5 8 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-off-vibrator-on": {
    state: "factory",
    setup: "menu 5 3 +2500 down down down down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-reject": { state: "factory", setup: "", keys: "!callin:0412345678 +4000 c" },
  "sound/calls/ring-ring-once-vibrator-off": {
    state: "factory",
    setup:
      "menu 5 3 +2500 down down menu +2500 c@1500 +1000 menu 5 8 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-ring-once-vibrator-on": {
    state: "factory",
    setup: "menu 5 3 +2500 down down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-ringing-vibrator-off": {
    state: "factory",
    setup: "menu 5 3 +2500 menu +2500 c@1500 +1000 menu 5 8 +2500 down menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-ringing-vibrator-on": {
    state: "factory",
    setup: "menu 5 3 +2500 menu +2500 c@1500 +1000",
    keys: "!callin:0412345678",
  },
  "sound/calls/ring-virgin": { setup: "", keys: "!callin:0412345678" },
  "sound/calls/ringback": {
    moHold: true,
    state: "factory",
    setup: "0 4 1 2 3 4 5 6 7 8",
    keys: "menu",
  },
  "sound/calls/ringback-answer": {
    moHold: true,
    state: "factory",
    setup: "0 4 1 2 3 4 5 6 7 8",
    keys: "menu +6000 !answer",
  },
  "sound/calls/volume-top": {
    state: "factory",
    setup: "0 4 1 2 3 4 5 6 7 8 menu +5000",
    keys: "up up down up up",
  },
  "sound/note/calls-invalid-location": { state: "factory", setup: "0", keys: "#" },
  "sound/note/calls-invalid-phone-number": {
    state: "factory",
    setup: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3",
    keys: "menu",
  },
  "sound/note/calls-new-numbers": {
    state: "factory",
    setup: "!callin:0412345678 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500",
    keys: "menu",
  },
  "sound/note/calls-no-new-numbers": {
    state: "factory",
    setup:
      "!callin:0412345678 +3000 !hangup +3500 c +500 menu +300 down down down +800 menu +1500 menu +4000 c@1500 +1000 menu +300 down down down +800 menu +1500",
    keys: "menu",
  },
  "sound/note/calls-no-phone-numbers": { state: "factory", setup: "1", keys: "#" },
  "sound/note/calls-speed-dial-not-saved": { state: "factory", setup: "5", keys: "menu" },
};
