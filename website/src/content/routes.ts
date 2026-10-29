export interface RouteContent {
  readonly description: string;
  readonly panel: string;
}
export const ROUTE_CONTENT: Readonly<Record<string, RouteContent>> = {
  "/": { description: "Lachlan Heywood and a working Nokia 3310.", panel: "standby" },
  "/menu": { description: "Browse the Nokia 3310 menus.", panel: "menu" },
  "/menu/phone-book": { description: "People and links on Lachlan's SIM.", panel: "contacts" },
  "/menu/phone-book/search": {
    description: "Call a contact to open a portfolio link.",
    panel: "contacts",
  },
  "/menu/phone-book/service-nos": {
    description: "Source code for this site.",
    panel: "service-numbers",
  },
  "/menu/messages": {
    description: "About Lachlan, work history and sample testimonials as SMS.",
    panel: "messages",
  },
  "/menu/messages/inbox": { description: "Read the messages on Lachlan's SIM.", panel: "messages" },
  "/menu/messages/write": {
    description: "Send a text to a portfolio persona.",
    panel: "messaging",
  },
  "/menu/chat": { description: "Chat with a portfolio persona over SMS.", panel: "messaging" },
  "/menu/reminders": { description: "What Lachlan is doing now.", panel: "now" },
  "/menu/reminders/view-all": { description: "Notes preloaded on this phone.", panel: "now" },
  "/menu/clock": { description: "Brisbane time and availability.", panel: "clock" },
  "/menu/games": { description: "Play the Nokia 3310 games.", panel: "games" },
  "/menu/games/snake": { description: "Play stock Snake II.", panel: "snake" },
  "/menu/calculator": { description: "Use the Nokia 3310 calculator.", panel: "calculator" },
  "/menu/sim-services": {
    description: "Projects and information about this site.",
    panel: "toolkit",
  },
  "/menu/sim-services/projects": {
    description: "Sample projects, years and links.",
    panel: "projects",
  },
  "/menu/sim-services/about": {
    description: "How this Nokia 3310 portfolio is built.",
    panel: "about",
  },
};
export const REDIRECTS: Readonly<Record<string, string>> = {
  "/menu/call-divert/github": "/menu/phone-book/search",
  "/menu/call-divert/linkedin": "/menu/phone-book/search",
  "/menu/call-divert/x": "/menu/phone-book/search",
  "/menu/settings/phone-settings/lights": "/menu/settings/phone-settings",
  "/menu/tones/warning-and-game-tones": "/menu/tones/warning-tones",
};
