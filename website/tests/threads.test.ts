import { expect, it } from "vite-plus/test";
import { createMemoryStorage } from "@hellotimber/nokia-os";
import { createThreads } from "../src/phone/threads";

it("persists only the last twelve turns and isolates SIMs and numbers", () => {
  const storage = createMemoryStorage();
  const threads = createThreads(storage, "sim-a");
  for (let n = 0; n < 14; n++) threads.append("123", { who: "me", text: String(n) });
  expect(
    createThreads(storage, "sim-a")
      .read("123")
      .map((t) => t.text),
  ).toEqual(Array.from({ length: 12 }, (_, n) => String(n + 2)));
  expect(threads.read("456")).toEqual([]);
  expect(createThreads(storage, "sim-b").read("123")).toEqual([]);
});
it("ignores corrupt storage and tolerates unavailable storage", () => {
  const storage = createMemoryStorage();
  storage.setItem("hellotimber.threads", '{"sim":{"123":[{"who":"me","text":3}]}}');
  expect(createThreads(storage, "sim").read("123")).toEqual([]);
  const unavailable = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const threads = createThreads(unavailable, "sim");
  threads.append("123", { who: "me", text: "hello" });
  expect(threads.read("123")).toEqual([{ who: "me", text: "hello" }]);
});
