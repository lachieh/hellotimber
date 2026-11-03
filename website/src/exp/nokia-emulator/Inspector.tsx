import { stockMenuFor } from "@hellotimber/nokia-os";
import { STOCK_DEFAULT_SIM } from "@hellotimber/nokia-kit/system/security";
import { Copy, CornerDownRight, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon, Led, Readout, Section } from "./controls";
import type { EmulatorState, Emulator } from "./emulator";
import { formatElapsed, logAsText, type LogEntry } from "./event-log";
import { ancestorPaths, menuTree, type TreeNode } from "./menu-tree";
import { useLive } from "./live";
import { batteryBars, signalBars } from "./world";

export function Inspector({ emulator, state }: { emulator: Emulator; state: EmulatorState }) {
  const [open, setOpen] = useState({ machine: true, tree: true, log: true });
  const toggle = (key: keyof typeof open) => () =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  return (
    <>
      <Section title="Machine" open={open.machine} onToggle={toggle("machine")}>
        <Machine emulator={emulator} state={state} />
      </Section>
      <Section title="Menu tree" open={open.tree} onToggle={toggle("tree")}>
        <MenuTree
          path={state.machine.path}
          disabled={!state.machine.poweredOn}
          onJump={(path) => emulator.navigate(path)}
        />
      </Section>
      <Section
        title="Event log"
        open={open.log}
        onToggle={toggle("log")}
        actions={
          <>
            <button
              type="button"
              className="emu-icon-button"
              aria-label="Copy the event log"
              title="Copy"
              onClick={() => void navigator.clipboard?.writeText(logAsText(state.log))}
            >
              <Icon icon={Copy} />
            </button>
            <button
              type="button"
              className="emu-icon-button"
              aria-label="Clear the event log"
              title="Clear"
              onClick={() => emulator.clearLog()}
            >
              <Icon icon={Trash2} />
            </button>
          </>
        }
      >
        <EventLog log={state.log} />
      </Section>
    </>
  );
}

function Machine({ emulator, state }: { emulator: Emulator; state: EmulatorState }) {
  const live = useLive(emulator, state.runtime);
  const { machine, world } = state;
  return (
    <>
      <dl className="emu-readouts">
        <Readout
          label="Power"
          value={machine.poweredOn ? "on" : state.status === "starting" ? "starting" : "off"}
        >
          <Led on={machine.poweredOn} label="Power" />
        </Readout>
        <Readout label="Path" value={machine.path} />
        <Readout label="Screen" value={machine.kind} />
        <Readout label="Display LED" value={live.display ? "lit" : "dark"}>
          <Led on={live.display} label="Display LED" />
        </Readout>
        <Readout label="Keypad LED" value={live.keypad ? "lit" : "dark"}>
          <Led on={live.keypad} label="Keypad LED" />
        </Readout>
        <Readout
          label="Signal"
          value={`${signalBars(world.signalDbm)}/4`}
          unit="bars"
          warn={signalBars(world.signalDbm) === 0}
        />
        <Readout
          label="Battery"
          value={`${batteryBars(world.batteryPercent)}/4`}
          unit="bars"
          warn={batteryBars(world.batteryPercent) === 0}
        />
        <Readout label="Uptime" value={(live.uptime / 1000).toFixed(1)} unit="s" />
        <Readout label="LCD frames" value={live.frames.toLocaleString("en-US")} />
      </dl>
      <figure className="emu-lcd-text">
        <figcaption>LCD text</figcaption>
        <pre aria-live="polite">{machine.text || "(blank)"}</pre>
      </figure>
    </>
  );
}

function MenuTree({
  path,
  disabled,
  onJump,
}: {
  path: string;
  disabled: boolean;
  onJump: (path: string) => void;
}) {
  const tree = useMemo(() => menuTree(stockMenuFor(STOCK_DEFAULT_SIM)), []);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // The phone's own position opens its branch.
  useEffect(() => {
    if (!path.startsWith("menu/")) return;
    setExpanded((prev) => {
      const missing = ancestorPaths(path).filter((p) => !prev.has(p));
      return missing.length === 0 ? prev : new Set([...prev, ...missing]);
    });
  }, [path]);
  const toggle = (node: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node)) next.delete(node);
      else next.add(node);
      return next;
    });
  const render = (nodes: readonly TreeNode[], depth: number) => (
    <ul className="emu-tree__level" role={depth === 0 ? undefined : "group"}>
      {nodes.map((node) => {
        const isOpen = expanded.has(node.path);
        const here = node.path === path;
        const onPath = !here && path.startsWith(`${node.path}/`);
        return (
          <li key={node.path}>
            <div
              className="emu-tree__row"
              data-here={here ? "" : undefined}
              data-on-path={onPath ? "" : undefined}
              style={{ "--depth": depth } as React.CSSProperties}
            >
              {node.children.length > 0 ? (
                <button
                  type="button"
                  className="emu-tree__disclose"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.label}`}
                  onClick={() => toggle(node.path)}
                >
                  <svg className="emu-chevron" viewBox="0 0 8 8" aria-hidden="true">
                    <path d="M2.5 1.5 5.5 4 2.5 6.5" />
                  </svg>
                </button>
              ) : (
                <span className="emu-tree__leaf" aria-hidden="true" />
              )}
              <button
                type="button"
                className="emu-tree__jump"
                disabled={disabled}
                aria-current={here ? "location" : undefined}
                title={`Jump the phone to ${node.path}`}
                onClick={() => onJump(node.path)}
              >
                <span className="emu-num emu-tree__number">{node.number}</span>
                <span className="emu-tree__label">{node.label}</span>
                <Icon icon={CornerDownRight} size={12} />
              </button>
            </div>
            {isOpen && node.children.length > 0 && render(node.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );
  return (
    <nav className="emu-tree" aria-label="Stock menu">
      {render(tree, 0)}
      {disabled && <p className="emu-hint">Jumps work once the phone is on.</p>}
    </nav>
  );
}

function EventLog({ log }: { log: readonly LogEntry[] }) {
  const list = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);
  useLayoutEffect(() => {
    const element = list.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [log]);
  if (log.length === 0) return <p className="emu-hint">Press a key or change the world.</p>;
  return (
    <ol
      ref={list}
      className="emu-log"
      aria-label="Events, oldest first"
      tabIndex={0}
      onScroll={(event) => {
        const element = event.currentTarget;
        pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 8;
      }}
    >
      {log.map((entry) => (
        <li key={entry.id} data-kind={entry.kind} data-warn={entry.warn ? "" : undefined}>
          <span className="emu-log__time">{formatElapsed(entry.at)}</span>
          <span className="emu-log__kind">{entry.kind}</span>
          <span className="emu-log__text">{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}
