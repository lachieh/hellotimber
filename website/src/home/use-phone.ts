import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SectionId } from "../content/section";
import { connectPhoneToRouter } from "../phone/router-sync";
import { loadHomeRuntime, onSiteLink } from "./runtime";
import { highlightedSection } from "./view";

/** The section the phone has highlighted (`highlightedSection`); undefined until it has loaded. */
export function useHighlightedSection(): SectionId | undefined {
  const [highlighted, setHighlighted] = useState<SectionId | undefined>(undefined);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    void loadHomeRuntime().then(({ phone }) => {
      if (!mounted) return;
      setHighlighted(highlightedSection(phone));
      unsubscribe = phone.subscribe((snap) => setHighlighted(highlightedSection(snap)));
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);
  return highlighted;
}

/** Keeps the URL and the phone together while the homepage is mounted, and follows its site links. */
export function useRouterSync(): void {
  const router = useRouter();
  useEffect(() => {
    let disconnect: (() => void) | undefined;
    let mounted = true;
    void loadHomeRuntime().then(({ phone }) => {
      if (!mounted) return;
      const unsync = connectPhoneToRouter(router, phone);
      const unlink = onSiteLink((path) => void router.navigate({ to: path }));
      disconnect = () => {
        unsync();
        unlink();
      };
    });
    return () => {
      mounted = false;
      disconnect?.();
    };
  }, [router]);
}
