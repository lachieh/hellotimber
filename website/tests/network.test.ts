import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  createFirmwarePhone,
  createMemoryStorage,
  describeFirmwareScreen,
} from "@hellotimber/nokia-os";
import type { ScreenModel } from "@hellotimber/phone-core";
import { homeFirmware } from "../src/home/firmware";
import { HOME_SIM } from "../src/home/runtime";
import { createPortfolioNetwork, NO_ANSWER_MS } from "../src/phone/network";
import { createThreads } from "../src/phone/threads";
import type { PhoneKey } from "@hellotimber/phone-core";
import { generateReply, validateSmsRequest } from "../src/messages/generate-reply";
import { PEOPLE } from "../src/content/people";

const number = PEOPLE[0]!.number;
const firmware = homeFirmware(() => {});
const describe = (screen: ScreenModel) => describeFirmwareScreen(firmware, screen);
function setup(fetcher = vi.fn<typeof fetch>(async () => Response.json({ reply: "Hello!" }))) {
  const storage = createMemoryStorage();
  const network = createPortfolioNetwork({
    storage,
    simId: "test",
    fetch: fetcher,
    now: () => new Date("2026-10-29T20:30:40Z"),
  });
  return { network, fetcher, storage };
}
afterEach(() => vi.useRealTimers());
it("posts a persona's history and delivers its reply with New York time", async () => {
  const { network, fetcher, storage } = setup();
  const deliver = vi.fn();
  network.subscribe(deliver);
  expect(await network.send({ number, text: "Hi" })).toBe("sent");
  await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());
  expect(requestBody(fetcher, 0)).toEqual({
    contactId: "lachlan",
    text: "Hi",
    history: [],
  });
  expect(deliver).toHaveBeenCalledWith({
    number,
    text: "Hello!",
    sentAt: { year: 2026, month: 10, day: 29, hour: 16, minute: 30, second: 40 },
  });
  expect(createThreads(storage, "test").read(number)).toEqual([
    { who: "me", text: "Hi" },
    { who: "them", text: "Hello!" },
  ]);
  await network.send({ number, text: "Again" });
  expect(requestBody(fetcher, 1).history).toHaveLength(2);
});
it("accepts other numbers without posting and fails rejected requests", async () => {
  const { network, fetcher } = setup(
    vi.fn(async () => {
      throw Error("offline");
    }),
  );
  expect(await network.send({ number: "12345", text: "hi" })).toBe("sent");
  expect(fetcher).not.toHaveBeenCalled();
  expect(await network.send({ number, text: "hi" })).toBe("failed");
});
it("settles sending on HTTP acceptance before reading the reply body", async () => {
  let finish: (value: unknown) => void = () => {};
  const body = new Promise((resolve) => {
    finish = resolve;
  });
  const response = Response.json({ reply: "unused" });
  vi.spyOn(response, "json").mockReturnValue(body);
  const { network } = setup(vi.fn(async () => response));
  const deliver = vi.fn();
  network.subscribe(deliver);
  expect(await network.send({ number, text: "hi" })).toBe("sent");
  expect(deliver).not.toHaveBeenCalled();
  finish({ reply: "Later" });
  await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());
});
it("leaves personas unanswered and rejects unknown numbers", () => {
  vi.useFakeTimers();
  const { network } = setup();
  const control = { alerting: vi.fn(), connected: vi.fn(), released: vi.fn() };
  network.dial!({ number, emergency: false }, control);
  expect(control.connected).not.toHaveBeenCalled();
  vi.advanceTimersByTime(NO_ANSWER_MS);
  expect(control.released).toHaveBeenCalledOnce();
  network.dial!({ number: "12345", emergency: false }, control);
  expect(control.connected).not.toHaveBeenCalled();
  expect(control.released).toHaveBeenLastCalledWith(1);
  vi.advanceTimersByTime(NO_ANSWER_MS);
  expect(control.released).toHaveBeenCalledTimes(2);
});

function requestBody(fetcher: ReturnType<typeof setup>["fetcher"], index: number) {
  const body = fetcher.mock.calls[index]?.[1]?.body;
  if (typeof body !== "string") throw Error("Expected JSON request body");
  return JSON.parse(body);
}

function home() {
  const storage = createMemoryStorage();
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    if (typeof init?.body !== "string") throw Error("Missing body");
    const request = validateSmsRequest(JSON.parse(init.body));
    if (!request.ok) throw Error(request.error);
    return Response.json({
      reply: await generateReply(
        { createClient: () => null },
        request.contact,
        request.request.history,
        request.request.text,
      ),
    });
  });
  const network = createPortfolioNetwork({
    storage,
    simId: HOME_SIM.id,
    fetch: fetcher,
  });
  const phone = createFirmwarePhone(firmware, {
    boot: "skip",
    carrier: "LACHLAN",
    sim: HOME_SIM,
    storage,
    network,
    t9: {},
  });
  let now = 0;
  const wait = (ms: number) => {
    const end = now + ms;
    while (now < end) phone.tick(++now);
  };
  const press = (key: PhoneKey, held = 40) => {
    phone.send({ type: "down", key });
    wait(held);
    phone.send({ type: "up", key });
    wait(100);
  };
  phone.tick(0);
  press("power", 1000);
  wait(1000);
  return { phone, press, wait, fetcher };
}
it("uses the homepage Chat to send to a persona and show its reply", async () => {
  const { phone, press, wait, fetcher } = home();
  phone.navigate("menu/chat");
  wait(1000);
  for (const digit of number) press(digit as PhoneKey);
  press("navi");
  wait(500);
  press("2");
  wait(1500);
  press("navi");
  wait(500);
  press("4");
  press("4");
  wait(1500);
  press("4");
  press("4");
  press("4");
  wait(1500);
  press("navi");
  wait(500);
  press("navi");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 0));
  wait(10000);
  expect(requestBody(fetcher, 0).text).toBe("A: Hi");
  expect(describe(phone.screen)).toContain("G'day!");
});

it("rejects unknown dialled numbers with unallocated-number release", () => {
  const { network } = setup();
  const control = { alerting: vi.fn(), connected: vi.fn(), released: vi.fn() };
  network.dial!({ number: "0299999837", emergency: false }, control);
  expect(control.released).toHaveBeenCalledWith(1);
  expect(control.alerting).not.toHaveBeenCalled();
  expect(control.connected).not.toHaveBeenCalled();
});
it("shows the stock network-failure screen for an unknown number, then standby", () => {
  const { phone, press, wait } = home();
  for (const digit of "0299999837") press(digit as PhoneKey);
  press("navi");
  wait(400);
  expect(describe(phone.screen)).toContain("Call 1, ended");
  wait(3000);
  expect(phone.screen.kind).toBe("standby");
});
