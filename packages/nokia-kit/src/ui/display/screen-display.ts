// What a firmware's screens draw beyond their screen models (plan 32 Phase 0): the painter and the
// describer take it per firmware (`Firmware.display`), so neither knows one firmware's menu.
import type { CarouselGraphic } from "../resources";

export interface ScreenDisplay {
  /** Carousel graphics the firmware draws itself, by graphic id; any other id is a stock icon. */
  readonly menuIcons?: Readonly<Record<string, CarouselGraphic>>;
  /** Top-level menu numbers whose levels draw no menu number (v6.39: SIM services, Menu 14). */
  readonly unnumberedMenus?: readonly number[];
}
