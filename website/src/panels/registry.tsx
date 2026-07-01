import type { ComponentType } from "react";
import type { SiteNode } from "../content/types";
import CalculatorPanel from "./calculator";
import CallDivertPanel from "./call-divert";
import CallRegisterPanel from "./call-register";
import ChatPanel from "./chat";
import ClockPanel from "./clock";
import GamesPanel from "./games";
import InboxPanel from "./inbox";
import MessagesPanel from "./messages";
import PhoneBookPanel from "./phone-book";
import ProfilesPanel from "./profiles";
import RemindersPanel from "./reminders";
import SettingsPanel from "./settings";
import SimServicesPanel from "./sim-services";
import SnakePanel from "./snake";
import TonesPanel from "./tones";
import WritePanel from "./write";

export interface PanelProps {
  /** The resolved SiteNode chain for the current path (root → leaf). */
  chain: SiteNode[];
}

/** `web.panel` key → bespoke panel. Anything else renders GenericPanel. */
export const PANELS: Record<string, ComponentType<PanelProps>> = {
  "phone-book": PhoneBookPanel,
  messages: MessagesPanel,
  inbox: InboxPanel,
  write: WritePanel,
  chat: ChatPanel,
  "call-register": CallRegisterPanel,
  tones: TonesPanel,
  settings: SettingsPanel,
  "call-divert": CallDivertPanel,
  games: GamesPanel,
  snake: SnakePanel,
  calculator: CalculatorPanel,
  reminders: RemindersPanel,
  clock: ClockPanel,
  profiles: ProfilesPanel,
  "sim-services": SimServicesPanel,
};
