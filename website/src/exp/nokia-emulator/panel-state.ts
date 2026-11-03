/** The control panel's tabs (D4). */
export const PANEL_TABS = ["inspector", "world", "stage"] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export const TAB_LABELS: Record<PanelTab, string> = {
  inspector: "Inspector",
  world: "World",
  stage: "Stage",
};

/** Whether the panel is open (the dock, or the sheet below 760px) and which tab it shows. */
export interface PanelState {
  readonly open: boolean;
  readonly tab: PanelTab;
}

export type PanelAction =
  | { type: "toggle" }
  | { type: "close" }
  /** A tab chosen: it opens the panel on that tab. */
  | { type: "tab"; tab: PanelTab }
  /** Arrow keys over the tab list: the next or previous tab, wrapping. */
  | { type: "step"; by: 1 | -1 };

export const INITIAL_PANEL: PanelState = { open: true, tab: "inspector" };

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "toggle":
      return { ...state, open: !state.open };
    case "close":
      return state.open ? { ...state, open: false } : state;
    case "tab":
      return state.open && state.tab === action.tab ? state : { open: true, tab: action.tab };
    case "step": {
      const index = PANEL_TABS.indexOf(state.tab);
      const next = PANEL_TABS[(index + action.by + PANEL_TABS.length) % PANEL_TABS.length]!;
      return { open: true, tab: next };
    }
  }
}

/** Below this width the dock becomes a bottom sheet (D6). */
export const SHEET_QUERY = "(max-width: 759px)";
