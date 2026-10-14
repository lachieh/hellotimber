import { PhoneApplication } from "@hellotimber/phone-core";
import type { ApplicationContext, PhoneApplicationSession } from "@hellotimber/phone-core";

export interface PickerOpts {
  title: string;
  options: readonly string[];
  /** Re-read at every launch so the picker opens on the current value. */
  selected?: () => number;
  onPick: (index: number) => void;
}

export class PickerApplication extends PhoneApplication {
  readonly #options: PickerOpts;

  constructor(id: string, options: PickerOpts) {
    super(id);
    this.#options = { ...options, options: Object.freeze([...options.options]) };
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const count = this.#options.options.length;
    let selected = Math.min(Math.max(this.#options.selected?.() ?? 0, 0), Math.max(0, count - 1));

    return {
      onKey: (event) => {
        if (event.type === "down") {
          if (count === 0) return;
          if (event.key === "up") selected = (selected + count - 1) % count;
          else if (event.key === "down") selected = (selected + 1) % count;
          return;
        }
        if (event.key === "navi" && count > 0) {
          this.#options.onPick(selected);
          context.exit();
        } else if (event.key === "c") {
          context.exit();
        }
      },
      tick() {},
      render: () => ({
        kind: "list",
        title: this.#options.title,
        items: [...this.#options.options],
        selected,
        softkey: "OK",
      }),
    };
  }
}
