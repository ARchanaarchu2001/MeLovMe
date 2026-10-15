import { useSyncExternalStore } from "react";

// Tiny localStorage-backed list store (static site, no backend), shared across
// components and browser tabs. Backs the cart and the wishlist.
// `parse` receives untrusted stored data and must return only valid items.
export function createStore<T>(key: string, parse: (raw: unknown[]) => T[]) {
  const EMPTY: T[] = [];
  const listeners = new Set<() => void>();
  let cache: T[] | null = null;

  function read(): T[] {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(raw) ? parse(raw) : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  function get() {
    return (cache ??= read());
  }

  function set(items: T[]) {
    cache = items;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // Storage unavailable (private mode / quota) — the list still works for this page view
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== key) return;
      cache = null;
      listener();
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    get,
    set,
    useItems: () => useSyncExternalStore(subscribe, get, () => EMPTY),
  };
}

const noop = () => () => {};

// False during prerender/hydration, so pages can avoid flashing an "empty" state
export function useReady() {
  return useSyncExternalStore(noop, () => true, () => false);
}
