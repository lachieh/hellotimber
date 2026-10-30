import { afterEach, expect, it, vi } from "vite-plus/test";
import { createMemoryStorage, createStockPhone, describeStockScreen } from "@hellotimber/nokia-os";
import { createPortfolioNetwork, LINK_CALL_MS, NO_ANSWER_MS } from "../src/phone/network";
import { createThreads } from "../src/phone/threads";
import type { PhoneKey } from "@hellotimber/phone-core";
import { PORTFOLIO_SIM } from "../src/content/sim";
import { generateReply, validateSmsRequest } from "../src/messages/generate-reply";
import { PEOPLE } from "../src/content/people";
import { LINKS } from "../src/content/links";

const number = PEOPLE[0]!.number;
const github = LINKS.find((link) => link.id === "github")!;
function setup(fetcher = vi.fn<typeof fetch>(async () => Response.json({ reply: "Hello!" }))) {
  const storage = createMemoryStorage();
  const open = vi.fn();
  const assign = vi.fn();
  const download = vi.fn();
  const network = createPortfolioNetwork({
    storage,
    simId: "test",
    fetch: fetcher,
    now: () => new Date("2026-10-29T20:30:40Z"),
    open,
    assign,
    download,
  });
  return { network, fetcher, storage, open, assign, download };
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
it("opens links synchronously, reports call progress and cancels release on hangup", () => {
  vi.useFakeTimers();
  const { network, open, assign, download } = setup();
  const control = { alerting: vi.fn(), connected: vi.fn(), released: vi.fn() };
  network.dial!({ number: github.number, emergency: false }, control);
  expect(open).toHaveBeenCalledWith(github.href, "_blank", "noopener,noreferrer");
  expect(control.alerting).toHaveBeenCalledOnce();
  expect(control.connected).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(LINK_CALL_MS);
  expect(control.released).toHaveBeenCalledOnce();
  const link = network.dial!({ number: github.number, emergency: false }, control);
  link.hangUp();
  vi.advanceTimersByTime(LINK_CALL_MS);
  expect(control.released).toHaveBeenCalledOnce();
  const linkedin = LINKS.find((link) => link.id === "linkedin")!;
  network.dial!({ number: linkedin.number, emergency: false }, control);
  expect(open).toHaveBeenCalledWith(linkedin.href, "_blank", "noopener,noreferrer");
  expect(assign).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
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

function stock() {
  const storage = createMemoryStorage();
  const open = vi.fn();
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
    simId: PORTFOLIO_SIM.id,
    fetch: fetcher,
    open,
  });
  const phone = createStockPhone({
    boot: "skip",
    carrier: "LACHLAN",
    sim: PORTFOLIO_SIM,
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
  return { phone, press, wait, open, fetcher };
}
it("opens GitHub during the stock phone's Navi event", () => {
  vi.useFakeTimers();
  const { phone, press, wait, open } = stock();
  press("down");
  wait(1000);
  for (let n = 0; n < 12 && !describeStockScreen(phone.screen).includes("GitHub"); n++)
    press("down");
  expect(describeStockScreen(phone.screen)).toContain("GitHub");
  press("navi");
  expect(open).toHaveBeenCalledWith(github.href, "_blank", "noopener,noreferrer");
});
it("writes an SMS through stock keys and receives the canned reply in Inbox", async () => {
  const { phone, press, wait, fetcher } = stock();
  phone.navigate("menu/messages/write");
  wait(1000);
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
  wait(500);
  for (const digit of number) press(digit as PhoneKey);
  press("navi");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 0));
  wait(10000);
  phone.navigate("menu/messages/inbox");
  wait(3000);
  expect(describeStockScreen(phone.screen)).toContain("Lachlan");
  press("navi");
  wait(1000);
  expect(describeStockScreen(phone.screen)).toContain("G'day!");
});
it("uses the landed Chat implementation to send to a persona and show its reply", async () => {
  const { phone, press, wait, fetcher } = stock();
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
  expect(describeStockScreen(phone.screen)).toContain("G'day!");
});

it("rejects unknown dialled numbers with unallocated-number release", () => {
  const { network, open } = setup();
  const control = { alerting: vi.fn(), connected: vi.fn(), released: vi.fn() };
  network.dial!({ number: "0299999837", emergency: false }, control);
  expect(control.released).toHaveBeenCalledWith(1);
  expect(control.alerting).not.toHaveBeenCalled();
  expect(control.connected).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
it("shows the stock network-failure screen for an unknown number, then standby", () => {
  const { phone, press, wait, open } = stock();
  for (const digit of "0299999837") press(digit as PhoneKey);
  press("navi");
  wait(400);
  expect(describeStockScreen(phone.screen)).toContain("Call 1, ended");
  expect(open).not.toHaveBeenCalled();
  wait(3000);
  expect(phone.screen.kind).toBe("standby");
});
