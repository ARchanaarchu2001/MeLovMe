import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore, useReady } from "./store";

// Keeps only positive whole numbers, like the cart keeps only well-formed items
const onlyCounts = (raw: unknown[]) => raw.filter((n): n is number => Number.isInteger(n) && (n as number) > 0);

// A fresh key per test, so one test's saved list can't leak into the next
let key = "";
let n = 0;
beforeEach(() => {
  localStorage.clear();
  key = `test-list-${++n}`;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const saved = () => JSON.parse(localStorage.getItem(key) ?? "null");

describe("list store: createStore", () => {
  test("a list that was never saved is empty", () => {
    expect(createStore(key, onlyCounts).get()).toEqual([]);
  });

  test("saving a list keeps it in the browser", () => {
    const store = createStore(key, onlyCounts);
    store.set([1, 2]);
    expect(store.get()).toEqual([1, 2]);
    expect(saved()).toEqual([1, 2]);
  });

  test("a list saved earlier (e.g. on a previous visit) is loaded", () => {
    localStorage.setItem(key, JSON.stringify([3, 4]));
    expect(createStore(key, onlyCounts).get()).toEqual([3, 4]);
  });

  test("bad items in the saved list are dropped", () => {
    localStorage.setItem(key, JSON.stringify([2, "x", -1, 1.5, null, 5]));
    expect(createStore(key, onlyCounts).get()).toEqual([2, 5]);
  });

  test("saved data that isn't a list loads as an empty list", () => {
    localStorage.setItem(key, JSON.stringify({ items: [1] }));
    expect(createStore(key, onlyCounts).get()).toEqual([]);
  });

  test("saved data that isn't valid JSON loads as an empty list", () => {
    localStorage.setItem(key, "[1, 2");
    expect(createStore(key, onlyCounts).get()).toEqual([]);
  });

  test("the list still works for this visit when the browser can't save (private mode / full)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createStore(key, onlyCounts);
    expect(() => store.set([7])).not.toThrow();
    expect(store.get()).toEqual([7]);
  });
});

describe("list store in components: useItems", () => {
  test("a component shows the saved list", () => {
    localStorage.setItem(key, JSON.stringify([1]));
    const store = createStore(key, onlyCounts);
    const { result } = renderHook(() => store.useItems());
    expect(result.current).toEqual([1]);
  });

  test("a component updates when the list changes", () => {
    const store = createStore(key, onlyCounts);
    const { result } = renderHook(() => store.useItems());
    act(() => store.set([1, 2, 3]));
    expect(result.current).toEqual([1, 2, 3]);
  });

  test("a change made in another browser tab shows up", () => {
    const store = createStore(key, onlyCounts);
    const { result } = renderHook(() => store.useItems());
    act(() => {
      localStorage.setItem(key, JSON.stringify([9]));
      window.dispatchEvent(new StorageEvent("storage", { key }));
    });
    expect(result.current).toEqual([9]);
  });

  test("another tab clearing all saved data empties the list", () => {
    localStorage.setItem(key, JSON.stringify([1]));
    const store = createStore(key, onlyCounts);
    const { result } = renderHook(() => store.useItems());
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(result.current).toEqual([]);
  });

  test("a change to some other saved list in another tab is ignored", () => {
    const store = createStore(key, onlyCounts);
    const { result } = renderHook(() => store.useItems());
    act(() => store.set([1]));
    act(() => {
      localStorage.setItem(key, JSON.stringify([2]));
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-list" }));
    });
    expect(result.current).toEqual([1]);
  });
});

describe("useReady", () => {
  test("is true once the page is running in the browser", () => {
    const { result } = renderHook(() => useReady());
    expect(result.current).toBe(true);
  });
});
