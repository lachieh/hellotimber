import {
  EditorApplication,
  PhoneApplication,
  READER_VISIBLE_LINES,
  wrapLines,
} from "@hellotimber/phone-core";
import type { ApplicationContext, PhoneApplicationSession } from "@hellotimber/phone-core";

export interface ChatDeps {
  nickname: string;
  thread(): { who: "me" | "them"; text: string }[];
  seed(): void;
  send(text: string): Promise<string>;
  recordSend(text: string): void;
  recordReceive(text: string): void;
  playAlert(): void;
  replyDelayMs?: () => number;
  schedule?: (fn: () => void | Promise<void>, ms: number) => void;
}

const defaultReplyDelayMs = (): number => 2000 + Math.random() * 6000;
const defaultSchedule = (fn: () => void | Promise<void>, ms: number): void => {
  setTimeout(() => void fn(), ms);
};

class ChatFlow {
  readonly session: ChatSessionApplication;
  readonly compose: ChatComposeApplication;

  constructor(readonly deps: ChatDeps) {
    this.session = new ChatSessionApplication(this);
    this.compose = new ChatComposeApplication(this);
  }
}

class ChatSessionApplication extends PhoneApplication {
  constructor(readonly flow: ChatFlow) {
    super("chat-session");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.flow.deps.seed();
    let scrollTop: number | null = null;
    const lines = (): string[] => {
      const entries = this.flow.deps.thread();
      if (entries.length === 0) return ["No messages"];
      return entries.flatMap((message) =>
        wrapLines(`${message.who === "them" ? ">" : "<"} ${message.text}`),
      );
    };

    return {
      onKey: (event) => {
        if (event.type === "down") {
          const maxTop = Math.max(0, lines().length - READER_VISIBLE_LINES);
          const current = scrollTop ?? maxTop;
          if (event.key === "up") scrollTop = Math.max(0, current - 1);
          else if (event.key === "down") {
            const next = Math.min(maxTop, current + 1);
            scrollTop = next >= maxTop ? null : next;
          }
          return;
        }
        if (event.key === "navi") context.open(this.flow.compose);
        else if (event.key === "c") context.exit();
      },
      tick() {},
      render: () => {
        const all = lines();
        const maxTop = Math.max(0, all.length - READER_VISIBLE_LINES);
        return {
          kind: "reader",
          title: this.flow.deps.nickname,
          lines: all,
          scrollTop: Math.min(scrollTop ?? maxTop, maxTop),
        };
      },
    };
  }
}

class ChatComposeApplication extends PhoneApplication {
  constructor(readonly flow: ChatFlow) {
    super("chat-compose");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const backToSession: ApplicationContext = {
      exit: () => context.open(this.flow.session),
      open: (application) => context.open(application),
    };
    return new EditorApplication(this.id, {
      title: "Chat:",
      charLimit: 160,
      menu: [
        { id: "send", label: "Send" },
        { id: "exit", label: "Exit" },
      ],
      onMenu: (id, text, menuContext) => {
        if (id !== "send" || text.trim() === "") return;
        const replyPromise = this.flow.deps.send(text);
        this.flow.deps.recordSend(text);
        const delay = (this.flow.deps.replyDelayMs ?? defaultReplyDelayMs)();
        (this.flow.deps.schedule ?? defaultSchedule)(async () => {
          const reply = await replyPromise.catch(() => null);
          if (reply === null || reply === "") return;
          this.flow.deps.recordReceive(reply);
          this.flow.deps.playAlert();
        }, delay);
        menuContext.open(this.flow.session);
      },
    }).createSession(backToSession);
  }
}

export class ChatApplication extends PhoneApplication {
  readonly #deps: ChatDeps;

  constructor(deps: ChatDeps) {
    super("chat");
    this.#deps = deps;
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const flow = new ChatFlow(this.#deps);
    return flow.session.createSession(context);
  }
}
