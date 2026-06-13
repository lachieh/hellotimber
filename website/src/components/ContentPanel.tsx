import type { ReactNode } from "react";

interface ContentPanelProps {
  title: string;
  children: ReactNode;
}

/**
 * The HTML twin of the current phone screen: server-rendered, crawlable,
 * readable without WebGL. Sits beside the canvas on desktop, below it on
 * mobile (the _phone layout grid handles placement).
 */
export default function ContentPanel({ title, children }: ContentPanelProps) {
  return (
    <article aria-labelledby="content-panel-title" className="island-shell rounded-2xl p-6 sm:p-8">
      <h1
        id="content-panel-title"
        className="display-title mb-4 text-3xl font-bold text-[var(--sea-ink)]"
      >
        {title}
      </h1>
      <div className="prose prose-sm max-w-none text-[var(--sea-ink-soft)]">{children}</div>
    </article>
  );
}
