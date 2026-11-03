import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import "./exp.css";

/**
 * Whether write-up links render. The posts arrive with plan 32 Phase 4 (`/writing/<slug>`); until
 * then the link would 404, so it stays off.
 */
export const WRITE_UPS_PUBLISHED = false;

/**
 * The thin frame every experiment under `/exp` shares (plan 32 D17): a mark back to the home page,
 * the experiment's title and a link to its write-up.
 */
export function ExpFrame({
  title,
  subtitle,
  writeUp,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The post about the experiment: `/writing/<slug>`. */
  writeUp?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="exp">
      <header className="exp-bar">
        <Link to="/" className="exp-bar__home" aria-label="hellotimber, back to the home page">
          <ArrowLeft size={14} strokeWidth={1} absoluteStrokeWidth aria-hidden="true" />
          <span>hellotimber</span>
        </Link>
        <span className="exp-bar__rule" aria-hidden="true" />
        <h1 className="exp-bar__title">
          {title}
          {subtitle !== undefined && <span className="exp-bar__subtitle">{subtitle}</span>}
        </h1>
        {writeUp !== undefined && WRITE_UPS_PUBLISHED && (
          <a className="exp-bar__writeup" href={writeUp.href}>
            {writeUp.label}
            <ArrowUpRight size={14} strokeWidth={1} absoluteStrokeWidth aria-hidden="true" />
          </a>
        )}
      </header>
      <main className="exp-main">{children}</main>
    </div>
  );
}
