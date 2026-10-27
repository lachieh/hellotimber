import { lazy } from "react";
import type { ComponentType, ReactNode } from "react";

/** A surround frames the persistent phone stage; it must render `phone` exactly once. */
export type Surround = ComponentType<{ phone: ReactNode }>;

/** Prototype surrounds, chosen with `?layout=<slug>`; no layout keeps the bare phone. */
export const SURROUNDS: Record<string, Surround> = {
  "back-pages": lazy(() => import("./back-pages/Surround")),
  "user-guide": lazy(() => import("./user-guide/Surround")),
  "retail-box": lazy(() => import("./retail-box/Surround")),
  "pc-suite": lazy(() => import("./pc-suite/Surround")),
  "desk-2001": lazy(() => import("./desk-2001/Surround")),
  "xpress-on": lazy(() => import("./xpress-on/Surround")),
};
