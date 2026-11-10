import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vite-plus/test";
import { SES_SOURCE_FILE, sesSourceModule } from "../scripts/ses-source";
import { SES_SOURCE } from "../src/generated/ses-source";

describe("the generated SES source", () => {
  it("is what scripts/ses-source.ts writes from the installed ses", () => {
    expect(readFileSync(SES_SOURCE_FILE, "utf8")).toBe(sesSourceModule());
  });

  it("is a classic script that gives a worker lockdown and Compartment", async () => {
    const worker = new Worker(
      `${SES_SOURCE}
      lockdown();
      const compartment = new Compartment({ globals: {}, __options__: true });
      require("node:worker_threads").parentPort.postMessage(
        compartment.evaluate("typeof fetch + ' ' + typeof process + ' ' + (1 + 1)"),
      );`,
      { eval: true },
    );
    try {
      const reply = await new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      expect(reply).toBe("undefined undefined 2");
    } finally {
      await worker.terminate();
    }
  });
});
