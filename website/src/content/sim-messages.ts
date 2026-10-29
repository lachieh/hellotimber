import type { StockSimMessage } from "@hellotimber/nokia-os";
import { PEOPLE } from "./people";

// SAMPLE DATA - existing intros, placeholder bio, fictional roles and quotes.
export const SIM_MESSAGES: readonly StockSimMessage[] = [
  "Hi, I'm Lachlan. I build software for the web - and, apparently, phones. This whole site is a working Nokia 3310.",
  "Daily drivers: TypeScript, React, three.js, and an 84x48 pixel grid. I like hard boundaries and small packages.",
  "Want to talk? Text Lachlan here or email lachlan@example.com. Generally reachable 9-5 AEST; email lands anytime.",
  "SAMPLE BIO: Software engineer at Acme Pixel Co. (not a real company). I build web things with hard package boundaries and a soft spot for 84x48 displays.",
  "SAMPLE ROLE: 2022-now, Senior Software Engineer, Acme Pixel Co. Led the imaginary platform team. Shipped imaginary things at scale.",
  "SAMPLE ROLE: 2019-2022, Full-stack Engineer, Globex Web Ltd. Built the fictional checkout, twice, the second time correctly.",
  "SAMPLE QUOTE: CTO@Acme: Lachlan shipped the impossible. Twice.",
  "SAMPLE QUOTE: PM@Globex: Writes code AND tickets. Would staff again, 10/10.",
  "SAMPLE QUOTE: CTO@Acme: Also he made our build 4 minutes faster and never mentioned it.",
  "SAMPLE REPLIES: Lachlan: The second one was easier. I'm mentioning it now.",
].map((text, index) => ({
  number: PEOPLE[0].number,
  text,
  sentAt: { year: 2000, month: 9, day: 1, hour: 9, minute: 3 + index, second: 0 },
}));
