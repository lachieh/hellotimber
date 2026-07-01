import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Client-side link to a tree-resolved phone path (plan 07). All /menu/… URLs
 * are served by the one dynamic route (`/_phone/$`), so typed links target it
 * via the splat param instead of per-page route ids.
 */
export default function SiteLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <Link to="/$" params={{ _splat: path.replace(/^\/+/, "") }}>
      {children}
    </Link>
  );
}
