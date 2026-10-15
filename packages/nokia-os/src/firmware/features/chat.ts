// Chat (menu 3), plan 18c Task 8: `Phone number:`, `Chat name:`, the chat editor and its history
// over plan 18's messaging (src/chat). Inbox › Options › Chat opens the same chat (read.ts).
import { chatScreen } from "../../chat/screens";
import type { StockFeature } from "./feature";

export const chatFeature: StockFeature = {
  name: "chat",
  screens: {
    "3": (services) => () => chatScreen(services),
  },
};
