import type { MenuEntry } from "@hellotimber/phone-core";
export interface PanelProps {
  chain: readonly MenuEntry[];
}

import type { ComponentType } from "react";
import GenericPanel from "./GenericPanel";
import {
  StandbyPanel,
  ContactsPanel,
  ServiceNumbersPanel,
  MessagesPanel,
  MessagingPanel,
  NowPanel,
  ClockPanel,
  ProjectsPanel,
  AboutPanel,
  ToolkitPanel,
  GamesPanel,
  SnakePanel,
  CalculatorPanel,
} from "./content";
export const PANELS: Readonly<Record<string, ComponentType<PanelProps>>> = {
  standby: StandbyPanel,
  menu: GenericPanel,
  contacts: ContactsPanel,
  "service-numbers": ServiceNumbersPanel,
  messages: MessagesPanel,
  messaging: MessagingPanel,
  now: NowPanel,
  clock: ClockPanel,
  projects: ProjectsPanel,
  about: AboutPanel,
  toolkit: ToolkitPanel,
  games: GamesPanel,
  snake: SnakePanel,
  calculator: CalculatorPanel,
};
