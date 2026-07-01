import { editorApp, READER_VISIBLE_LINES, wrapLines } from "@hellotimber/phone-core";
import type { AppFactory, KeyEvent, PhoneApp, ScreenModel } from "@hellotimber/phone-core";

/**
 * Chat (Menu 3), plan 08 — what it really was on the 3310: a live session
 * view, `>` their lines, `<` yours, backed here by the "lachlan" persona
 * through the same /api/sms path as Write messages. Two chained apps:
 *
 *   chat (session) ──navi "Write"──▶ chat-compose ──Send / Exit / C──▶ chat
 *
 * All effects arrive via injected deps — no store/fetch/phone imports.
 */

export interface ChatDeps {
  /** Session title — the 3310 chat nickname (e.g. "Lachlan"). */
  nickname: string;
  /** Live view of the session thread, oldest first. */
  thread(): { who: "me" | "them"; text: string }[];
  /** Seed the thread on first run (no-op afterwards) — called at launch. */
  seed(): void;
  /** Resolve the persona's reply (website wraps /api/sms + canned fallback). */
  send(text: string): Promise<string>;
  recordSend(text: string): void;
  recordReceive(text: string): void;
  /** Alert tone only — no standby notice; you're in the session. */
  playAlert(): void;
  /** Reply latency; default 2–8 s randomized. Injectable for tests. */
  replyDelayMs?: () => number;
  /** Timer; default setTimeout. Injectable for tests. */
  schedule?: (fn: () => void | Promise<void>, ms: number) => void;
}

const defaultReplyDelayMs = (): number => 2000 + Math.random() * 6000;
const defaultSchedule = (fn: () => void | Promise<void>, ms: number): void => {
  setTimeout(() => {
    void fn();
  }, ms);
};

/** The two chat apps, keyed by app id, for buildApps(). */
export function chatApps(deps: ChatDeps): Record<string, AppFactory> {
  const chat: AppFactory = (ctx) => {
    deps.seed();
    /** null = stick to the newest lines (arrivals keep the view at the bottom). */
    let scrollTop: number | null = null;

    function lines(): string[] {
      const entries = deps.thread();
      if (entries.length === 0) return ["No messages"];
      return entries.flatMap((m) => wrapLines(`${m.who === "them" ? ">" : "<"} ${m.text}`));
    }

    const app: PhoneApp = {
      onKey(e: KeyEvent): void {
        if (e.type === "down") {
          const maxTop = Math.max(0, lines().length - READER_VISIBLE_LINES);
          const current = scrollTop ?? maxTop;
          if (e.key === "up") scrollTop = Math.max(0, current - 1);
          else if (e.key === "down") {
            const next = Math.min(maxTop, current + 1);
            scrollTop = next >= maxTop ? null : next; // bottom again → stick
          }
          return;
        }
        if (e.key === "navi")
          ctx.open("chat-compose"); // navi = Write
        else if (e.key === "c") ctx.exit();
      },
      tick(): void {},
      render(): ScreenModel {
        const all = lines();
        const maxTop = Math.max(0, all.length - READER_VISIBLE_LINES);
        return {
          kind: "reader",
          title: deps.nickname,
          lines: all,
          scrollTop: Math.min(scrollTop ?? maxTop, maxTop),
        };
      },
    };
    return app;
  };

  const chatCompose: AppFactory = (ctx) => {
    // Leaving the composer (Exit / C on an empty draft) returns to the
    // session, not out of Chat — the session is home.
    const backToSession = {
      exit: () => ctx.open("chat"),
      open: (appId: string) => ctx.open(appId),
    };
    return editorApp({
      title: "Chat:",
      charLimit: 160,
      menu: [
        { id: "send", label: "Send" },
        { id: "exit", label: "Exit" },
      ],
      onMenu: (id, text, menuCtx) => {
        if (id !== "send" || text.trim() === "") return;
        // send() first: its history snapshot must predate the record.
        const replyPromise = deps.send(text);
        deps.recordSend(text);
        const delay = (deps.replyDelayMs ?? defaultReplyDelayMs)();
        (deps.schedule ?? defaultSchedule)(async () => {
          const reply = await replyPromise.catch(() => null);
          if (reply === null || reply === "") return; // send() already falls back
          deps.recordReceive(reply);
          deps.playAlert();
        }, delay);
        menuCtx.open("chat"); // back to the session; the reply appends there
      },
    })(backToSession);
  };

  return { chat, "chat-compose": chatCompose };
}
