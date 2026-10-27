// SIM services' carousel slot (plan 30 D5, Task 0 K): its slug, its order in the kernel's menu and
// the number v6.39 shows for it. Pure constants, shared by the menu and the stock painter.

/** Menu 14's slug: `menu/sim-services`. */
export const SIM_SERVICES_SLUG = "sim-services";
/** SIM services' number: its counter reads 14 and there is no 13 (Task 0 K). */
export const SIM_SERVICES_NUMBER = 14;
/**
 * Its order in the kernel's menu: the 13th slot. phone-core numbers top-level entries 1..n with no
 * gap, so the stock painter draws the slot's counter as SIM_SERVICES_NUMBER, and `Menu 1 3` opens
 * the slot where v6.39 answers `Invalid shortcut` and opens it on `Menu 1 4` (a known gap).
 */
export const SIM_SERVICES_ORDER = 13;
