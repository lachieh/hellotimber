import type { ReactNode } from "react";
import type { FigureFirmware } from "./figure-phone";
import { focusPath, pathAndAncestors, type MachineNode } from "./machine";
import { Figure, Keypad, LcdScreen } from "./parts";
import { useFigurePhone } from "./use-figure-phone";

function Branch({
  nodes,
  focus,
  onPath,
}: {
  nodes: readonly MachineNode[];
  focus: string;
  onPath: ReadonlySet<string>;
}) {
  return (
    <ol>
      {nodes.map((node) => (
        <li
          key={node.path}
          data-focus={node.path === focus ? "" : undefined}
          data-on-path={onPath.has(node.path) ? "" : undefined}
          aria-current={node.path === focus ? "location" : undefined}
        >
          <span className="fig-tree__node">
            <span className="fig-tree__num">{node.number}</span>
            {node.label}
          </span>
          {node.children.length > 0 && (
            <Branch nodes={node.children} focus={focus} onPath={onPath} />
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * The firmware's real menu tree beside a live LCD: press keys and the state the phone is in (or
 * the item it has highlighted) is marked as it moves. `depth` levels of the tree are drawn.
 */
export function StateMachine({
  firmware = "home",
  start,
  depth = 2,
  caption,
}: {
  firmware?: FigureFirmware;
  start?: string;
  depth?: number;
  caption: ReactNode;
}) {
  const phone = useFigurePhone({ firmware, start });
  const tree = phone.figure?.tree(depth);
  const focus = tree !== undefined && phone.state !== undefined ? focusPath(phone.state, tree) : "";
  const onPath = new Set(pathAndAncestors(phone.state?.path ?? ""));
  return (
    <Figure kind="machine" caption={caption}>
      <div className="fig-machine" ref={phone.frameRef}>
        <div className="fig-phone">
          <LcdScreen phone={phone} label="A live Nokia 3310 screen; the diagram follows it" />
          <Keypad phone={phone} />
        </div>
        <div className="fig-tree" aria-label="The menu as states">
          <ol>
            <li data-focus={focus === "standby" ? "" : undefined} data-on-path="">
              <span className="fig-tree__node">Standby</span>
              <ol>
                <li data-on-path={onPath.has("menu") ? "" : undefined}>
                  <span className="fig-tree__node">Menu</span>
                  {tree === undefined ? (
                    <p className="fig-tree__wait">The tree draws once the phone is on.</p>
                  ) : (
                    <Branch nodes={tree} focus={focus} onPath={onPath} />
                  )}
                </li>
              </ol>
            </li>
          </ol>
        </div>
      </div>
    </Figure>
  );
}
