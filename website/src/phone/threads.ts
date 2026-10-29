import type { StockStorage } from "@hellotimber/nokia-os";
import { MAX_HISTORY, type SmsTurn } from "../messages/generate-reply";

const KEY = "hellotimber.threads";
function readTurns(value: unknown): SmsTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is SmsTurn =>
        typeof turn === "object" &&
        turn !== null &&
        (turn.who === "me" || turn.who === "them") &&
        typeof turn.text === "string",
    )
    .slice(-MAX_HISTORY);
}
export function createThreads(storage: Pick<StockStorage, "getItem" | "setItem">, simId: string) {
  const sims = new Map<string, Map<string, SmsTurn[]>>();
  try {
    const stored: unknown = JSON.parse(storage.getItem(KEY) ?? "null");
    if (typeof stored === "object" && stored !== null) {
      for (const [sim, numbers] of Object.entries(stored)) {
        if (typeof numbers !== "object" || numbers === null) continue;
        sims.set(
          sim,
          new Map(Object.entries(numbers).map(([number, turns]) => [number, readTurns(turns)])),
        );
      }
    }
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  const threads = sims.get(simId) ?? new Map<string, SmsTurn[]>();
  sims.set(simId, threads);
  return {
    read(number: string): SmsTurn[] {
      return (threads.get(number) ?? []).map((turn) => ({ ...turn }));
    },
    append(number: string, turn: SmsTurn): void {
      threads.set(number, [...(threads.get(number) ?? []), { ...turn }].slice(-MAX_HISTORY));
      try {
        storage.setItem(
          KEY,
          JSON.stringify(
            Object.fromEntries(
              Array.from(sims, ([sim, numbers]) => [sim, Object.fromEntries(numbers)]),
            ),
          ),
        );
      } catch {
        /* Keep the session usable when persistence is blocked. */
      }
    },
  };
}
