import { ABOUT } from "./about";
import { CHAT } from "./chat";
import { CONTACT } from "./contact";
import { NOW } from "./now";
import type { Section, SectionId } from "./section";
import { SNAKE } from "./snake";
import { WORK } from "./work";
import { WRITING } from "./writing";

/** Every section, in the phone's carousel order. */
export const SECTIONS: readonly Section[] = [ABOUT, WORK, WRITING, NOW, CONTACT, CHAT, SNAKE];

export function sectionById(id: SectionId): Section {
  return SECTIONS.find((section) => section.id === id)!;
}
