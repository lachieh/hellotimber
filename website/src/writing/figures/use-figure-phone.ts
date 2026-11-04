// A figure's live phone in React: loaded once the figure nears the screen, ticked by the frame
// clock only while it's in view, its LCD painted into a canvas the figure shows.
import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FigureFirmware, FigurePhone } from "./figure-phone";

export interface FigurePhoneHandle {
  /** Where the figure's frame is: the hook watches it to load and to pause off screen. */
  readonly frameRef: (element: HTMLElement | null) => void;
  /** Where the LCD canvas goes. */
  readonly screenRef: (element: HTMLElement | null) => void;
  readonly status: "waiting" | "loading" | "ready" | "failed";
  /** The phone's path and screen, for the StateMachine; undefined until it's ready. */
  readonly state: { readonly path: string; readonly screen: ScreenModel } | undefined;
  /** The LCD as text, for the live region. */
  readonly text: string;
  /** The loaded phone, for the StateMachine's tree. */
  readonly figure: FigurePhone | undefined;
  input(key: PhoneKey, action: "down" | "up"): void;
  /** A fresh phone at `start` again. */
  reset(): void;
}

export function useFigurePhone({
  firmware,
  start,
  t9 = false,
}: {
  firmware: FigureFirmware;
  start?: string;
  t9?: boolean;
}): FigurePhoneHandle {
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [screenSlot, setScreenSlot] = useState<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  const visible = useRef(false);
  const [status, setStatus] = useState<FigurePhoneHandle["status"]>("waiting");
  const [figure, setFigure] = useState<FigurePhone | undefined>(undefined);
  const [state, setState] = useState<FigurePhoneHandle["state"]>(undefined);
  const [text, setText] = useState("");
  const [generation, setGeneration] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  // Kernel time = wall time since this phone was ready, after its synthetic power-on.
  const clock = useRef({ wallAtReady: 0, kernelAtReady: 0 });

  // Load when within a screen of view; tick only while in view.
  useEffect(() => {
    if (frame === null) return;
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "100% 0px" },
    );
    const seen = new IntersectionObserver((entries) => {
      visible.current = entries.some((entry) => entry.isIntersecting);
    });
    near.observe(frame);
    seen.observe(frame);
    return () => {
      near.disconnect();
      seen.disconnect();
    };
  }, [frame]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setStatus("loading");
    const english = t9
      ? import("../../phone/runtime").then(({ loadEnglishT9 }) => loadEnglishT9())
      : Promise.resolve(undefined);
    Promise.all([import("./figure-phone"), import("@hellotimber/phone-screen"), english])
      .then(([{ createFigurePhone }, { createScreenRenderer }, dictionary]) => {
        if (cancelled) return;
        const next = createFigurePhone({ firmware, start, english: dictionary });
        const renderer = createScreenRenderer({ paint: next.paint });
        renderer.canvas.className = "fig-lcd__canvas";
        renderer.canvas.setAttribute("aria-hidden", "true");
        const show = () => {
          renderer.render(next.phone.screen);
          setState({ path: next.phone.path, screen: next.phone.screen });
          setText(next.describe());
        };
        next.phone.subscribe(show);
        show();
        clock.current = { wallAtReady: performance.now(), kernelAtReady: next.clock.now };
        setFigure(next);
        setStatus("ready");
        canvas.current = renderer.canvas;
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [near, firmware, start, t9, generation]);

  // The LCD canvas into its slot.
  useEffect(() => {
    if (screenSlot === null || canvas.current === null || figure === undefined) return;
    screenSlot.replaceChildren(canvas.current);
  }, [screenSlot, figure]);

  // The frame clock, while the figure is in view.
  useEffect(() => {
    if (figure === undefined) return;
    let raf = requestAnimationFrame(function loop(wall) {
      const { wallAtReady, kernelAtReady } = clock.current;
      const target = kernelAtReady + (wall - wallAtReady);
      if (visible.current && target > figure.clock.now) {
        figure.clock.now = target;
        figure.phone.tick(target);
      } else if (!visible.current) {
        // Off screen, time stands still for the phone: resume from here.
        clock.current = { wallAtReady: wall, kernelAtReady: figure.clock.now };
      }
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [figure]);

  const input = useCallback(
    (key: PhoneKey, action: "down" | "up") => {
      figure?.phone.send({ type: action, key });
    },
    [figure],
  );

  const reset = useCallback(() => {
    setFigure(undefined);
    setState(undefined);
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  return {
    frameRef: setFrame,
    screenRef: setScreenSlot,
    status,
    state,
    text,
    figure,
    input,
    reset,
  };
}
