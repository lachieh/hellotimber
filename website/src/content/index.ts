import { missedCalls, projects, roles } from "./call-register";
import { chatMessages } from "./chat";
import { clock } from "./clock";
import { diverts } from "./divert";
import { inbox, writeMessage } from "./messages";
import { siteMenu } from "./menu";
import { phonebook } from "./phonebook";
import { profileModes } from "./profiles";
import { nowItems } from "./reminders";
import { site } from "./site";

/**
 * The portfolio content modules. The menu tree (`siteMenu`) injects these into
 * the authentic 3310 structure — the handset menus and the HTML panels render
 * EXACTLY the same data (the no-drift seam, VISION).
 */
export type * from "./types";
export {
  chatMessages,
  clock,
  diverts,
  inbox,
  missedCalls,
  nowItems,
  phonebook,
  profileModes,
  projects,
  roles,
  site,
  siteMenu,
  writeMessage,
};
