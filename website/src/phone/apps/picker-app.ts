import type { AppFactory, KeyEvent, PhoneApp, ScreenModel } from "@hellotimber/phone-core";

export interface PickerOpts {
  title: string;
  options: string[];
  /** Re-read at every launch so the picker opens on the current value. */
  selected?: () => number;
  onPick: (index: number) => void;
}

/**
 * A one-shot option picker (Tones/Settings submenus): ▲▼ move with wrap,
 * NaviKey picks + exits, C cancels. Scroll on key-down (snappy, like the
 * real list UI); pick/cancel on key-up (mirrors phone-core list behavior).
 */
export function pickerApp(opts: PickerOpts): AppFactory {
  return (ctx) => {
    const count = opts.options.length;
    let selected = Math.min(Math.max(opts.selected?.() ?? 0, 0), count - 1);
    const app: PhoneApp = {
      onKey(e: KeyEvent): void {
        if (e.type === "down") {
          if (e.key === "up") selected = (selected + count - 1) % count;
          else if (e.key === "down") selected = (selected + 1) % count;
          return;
        }
        if (e.key === "navi") {
          opts.onPick(selected);
          ctx.exit();
        } else if (e.key === "c") {
          ctx.exit();
        }
      },
      tick(): void {},
      render(): ScreenModel {
        return {
          kind: "list",
          title: opts.title,
          items: opts.options,
          selected,
          softkey: "OK",
        };
      },
    };
    return app;
  };
}
