import type { Nokia3310Content } from "@hellotimber/phone-core";

// ───────────────────────────────────────────────────────────────────────────
// SAMPLE DATA — replace with real copy (plan 06). The STRUCTURE is real and
// shared: nokia3310Menu(content) builds the phone menus from this object, and
// the route ContentPanels render the same entries as HTML.
// ───────────────────────────────────────────────────────────────────────────
export const content: Nokia3310Content = {
  phonebook: [
    { id: "email", label: "Email", body: "lachlan@example.com — say hello." }, // SAMPLE DATA
    { id: "github", label: "GitHub", body: "github.com/lachlan-example" }, // SAMPLE DATA
    { id: "linkedin", label: "LinkedIn", body: "linkedin.com/in/lachlan-example" }, // SAMPLE DATA
  ],
  inbox: [
    {
      id: "hello",
      label: "Hello!",
      body: "Hi, I'm Lachlan. I build software and, apparently, phones.",
    }, // SAMPLE DATA
    {
      id: "stack",
      label: "What I use",
      body: "TypeScript, React, three.js, and a 84x48 pixel grid.",
    }, // SAMPLE DATA
  ],
  chat: [
    { who: "them", text: "Lachlan shipped the impossible, twice." }, // SAMPLE DATA
    { who: "me", text: "Thanks! The second one was easier." }, // SAMPLE DATA
    { who: "them", text: "Would hire again. 10/10." }, // SAMPLE DATA
  ],
  missedCalls: [
    { id: "startup", label: "That startup", body: "The one that got away (2019)." }, // SAMPLE DATA
  ],
  receivedCalls: [
    { id: "acme", label: "Acme Corp 2022", body: "Senior engineer. Did senior engineering." }, // SAMPLE DATA
    {
      id: "initech",
      label: "Initech 2020",
      body: "Full-stack engineer. Shipped the TPS reports.",
    }, // SAMPLE DATA
  ],
  dialledNumbers: [
    { id: "this-site", label: "This site", body: "A Nokia 3310 that is also a website." }, // SAMPLE DATA
    { id: "project-x", label: "Project X", body: "Shipped 2024. It did the thing." }, // SAMPLE DATA
  ],
  diverts: [
    { id: "github", label: "GitHub", href: "https://github.com/lachlan-example" }, // SAMPLE DATA
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/lachlan-example" }, // SAMPLE DATA
  ],
  reminders: [
    { id: "learning", label: "Learning", body: "three.js internals and pixel fonts." }, // SAMPLE DATA
    { id: "building", label: "Building", body: "This phone. You're holding it." }, // SAMPLE DATA
  ],
  clockNote: "Based in Australia (AEST). Generally awake when you are not.", // SAMPLE DATA
};
