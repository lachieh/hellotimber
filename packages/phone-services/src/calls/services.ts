export type StockServiceResult =
  | { readonly kind: "waiting"; readonly active: boolean }
  | { readonly kind: "active"; readonly scope: "voice" | "all"; readonly number: string }
  | { readonly kind: "inactive"; readonly scope: "voice" | "all" }
  | { readonly kind: "failed" };

export interface StockServiceControl {
  completed(result: StockServiceResult): void;
}
export type StockServiceHost = (
  text: string,
  control: StockServiceControl,
  signal: AbortSignal,
) => void;

export class ServiceRequest {
  readonly #abort = new AbortController();
  readonly #settled: ((result: StockServiceResult) => void) | undefined;
  #elapsed = 0;
  #reply: StockServiceResult | undefined;
  #result: StockServiceResult | undefined;

  constructor(
    text: string,
    host: StockServiceHost | undefined,
    settled?: (result: StockServiceResult) => void,
  ) {
    this.#settled = settled;
    try {
      host?.(
        text,
        {
          completed: (result) => {
            if (
              !this.#abort.signal.aborted &&
              this.#result === undefined &&
              this.#reply === undefined
            )
              this.#reply = result;
          },
        },
        this.#abort.signal,
      );
    } catch {
      this.#reply = { kind: "failed" };
    }
  }

  get result(): StockServiceResult | undefined {
    return this.#result;
  }

  tick(dtMs: number): void {
    if (this.#abort.signal.aborted || this.#result !== undefined) return;
    this.#elapsed += dtMs;
    if (this.#reply !== undefined) this.#result = this.#reply;
    else if (this.#elapsed >= 14867) this.#result = { kind: "failed" };
    if (this.#result !== undefined) this.#settled?.(this.#result);
  }

  cancel(): void {
    this.#abort.abort();
    this.#reply = undefined;
    this.#result = undefined;
  }
}
