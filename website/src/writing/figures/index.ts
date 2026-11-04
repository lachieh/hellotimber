// The figures a post's MDX can use without importing them (`<LiveLcd />` …).
import type { MDXComponents } from "mdx/types";
import { KeyReplay } from "./KeyReplay";
import { LiveLcd } from "./LiveLcd";
import { RevealScrubber } from "./RevealScrubber";
import { StateMachine } from "./StateMachine";

export const FIGURES: MDXComponents = { KeyReplay, LiveLcd, RevealScrubber, StateMachine };
