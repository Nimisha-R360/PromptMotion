import { useCallback, useSyncExternalStore } from "react";

/**
 * A query-string param as React state (replaces next/navigation's useSearchParams + router.replace).
 * The URL stays the source of truth, so reloads, sharing and back/forward all work.
 */
const EVENT = "pm:navigate";
const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
};

export function useSearchParam(name: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  /** `push`: add a history entry (Back returns to the previous value) instead of replacing it. */
  const set = useCallback(
    (next: string | null, { push = false } = {}) => {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set(name, next);
      else url.searchParams.delete(name);
      if (url.href === window.location.href) return;
      window.history[push ? "pushState" : "replaceState"](null, "", url);
      window.dispatchEvent(new Event(EVENT));
    },
    [name],
  );
  return [value, set] as const;
}
