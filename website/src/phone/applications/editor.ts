import { EditorApplication, PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  EditorApplicationOptions,
  PhoneApplicationSession,
} from "@hellotimber/phone-core";

export interface ConfiguredEditorOptions extends Omit<EditorApplicationOptions, "initial"> {
  /** Read at session creation so persisted website settings are never read during SSR import. */
  initial?: () => string;
}

export class ConfiguredEditorApplication extends PhoneApplication {
  readonly #options: ConfiguredEditorOptions;

  constructor(id: string, options: ConfiguredEditorOptions) {
    super(id);
    this.#options = {
      ...options,
      ...(options.menu === undefined
        ? {}
        : { menu: Object.freeze(options.menu.map((entry) => Object.freeze({ ...entry }))) }),
    };
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    const editor = new EditorApplication(this.id, {
      ...this.#options,
      initial: this.#options.initial?.(),
    });
    return editor.createSession(context);
  }
}
