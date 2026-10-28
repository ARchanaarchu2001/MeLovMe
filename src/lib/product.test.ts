import { describe, expect, test } from "vitest";
import { activeCombos, lineTotal, type Product } from "./product";

// A fixed "today" so date-based offers give the same result whenever the tests run
const NOW = Date.parse("2026-06-15T12:00:00+05:30");

type Priced = Pick<Product, "price" | "offer" | "combos">;

// ₹1,550 a piece, 2 for ₹3,000 (saves ₹100), 3 for ₹4,350 (saves ₹300)
const lotion: Priced = {
  price: 1550,
  offer: null,
  combos: [
    { qty: 2, price: 3000 },
    { qty: 3, price: 4350, tag: "best" },
  ],
};

const total = (p: Priced, qty: number) => lineTotal(p, qty, NOW).total;

describe("combo pricing: lineTotal", () => {
  test("a product without combos costs price × quantity", () => {
    const plain: Priced = { ...lotion, combos: [] };
    expect(lineTotal(plain, 3, NOW)).toEqual({ total: 4650, saving: 0 });
  });

  test("an empty cart line costs nothing", () => {
    expect(lineTotal(lotion, 0, NOW)).toEqual({ total: 0, saving: 0 });
  });

  test("1 piece is the normal price, with no saving", () => {
    expect(lineTotal(lotion, 1, NOW)).toEqual({ total: 1550, saving: 0 });
  });

  test("buying exactly a combo's quantity charges the combo price", () => {
    expect(lineTotal(lotion, 2, NOW)).toEqual({ total: 3000, saving: 100 });
    expect(lineTotal(lotion, 3, NOW)).toEqual({ total: 4350, saving: 300 });
  });

  test("extra pieces beyond a combo are added at the single price", () => {
    // 4 = 3-piece combo + 1 piece (₹5,900), cheaper than two 2-piece combos (₹6,000)
    expect(lineTotal(lotion, 4, NOW)).toEqual({ total: 5900, saving: 300 });
  });

  test("different combos are mixed together", () => {
    // 5 = 3-piece + 2-piece
    expect(lineTotal(lotion, 5, NOW)).toEqual({ total: 7350, saving: 400 });
  });

  test("the same combo can be used more than once", () => {
    expect(total(lotion, 6)).toBe(8700); // 3 + 3 (three 2-piece combos would be ₹9,000)
    expect(total(lotion, 7)).toBe(10250); // 3 + 3 + 1
  });

  test("always picks the cheapest mix, not just the biggest combo", () => {
    // Here two 2-piece combos (₹5,600) beat 3-piece + 1 piece (₹5,900)
    const cheapPairs: Priced = { ...lotion, combos: [{ qty: 2, price: 2800 }, { qty: 3, price: 4350 }] };
    expect(total(cheapPairs, 4)).toBe(5600);
  });

  test("the order combos are listed in doesn't change the price", () => {
    const reversed: Priced = { ...lotion, combos: [...lotion.combos].reverse() };
    for (let qty = 1; qty <= 10; qty++) expect(total(reversed, qty)).toBe(total(lotion, qty));
  });

  test("saving is always the single-piece total minus what is charged", () => {
    for (let qty = 1; qty <= 10; qty++) {
      const { total, saving } = lineTotal(lotion, qty, NOW);
      expect(saving).toBe(1550 * qty - total);
      expect(total).toBeLessThanOrEqual(1550 * qty); // a combo never makes it dearer
    }
  });
});

describe("combo pricing with offers", () => {
  test("a big offer that makes single pieces cheaper turns combos off", () => {
    // 50% off: 1 piece ₹775, so 2 for ₹3,000 is no longer a deal
    const sale: Priced = { ...lotion, offer: { type: "percent", value: 50 } };
    expect(activeCombos(sale, NOW)).toEqual([]);
    expect(lineTotal(sale, 3, NOW)).toEqual({ total: 2325, saving: 0 });
  });

  test("a small offer only turns off the combos it beats", () => {
    // 5% off: 1 piece ₹1,473. Two singles (₹2,946) beat the 2-piece combo,
    // but three singles (₹4,419) still cost more than the 3-piece combo
    const sale: Priced = { ...lotion, offer: { type: "percent", value: 5 } };
    expect(activeCombos(sale, NOW).map((c) => c.qty)).toEqual([3]);
    expect(total(sale, 2)).toBe(2946);
    expect(total(sale, 3)).toBe(4350);
  });

  test("an offer that hasn't started yet doesn't affect combos", () => {
    const later: Priced = { ...lotion, offer: { type: "percent", value: 50, startsAt: "2026-07-01T00:00:00+05:30" } };
    expect(total(later, 2)).toBe(3000);
  });

  test("an offer that has ended doesn't affect combos", () => {
    const over: Priced = { ...lotion, offer: { type: "percent", value: 50, endsAt: "2026-06-01T23:59:59+05:30" } };
    expect(total(over, 3)).toBe(4350);
  });
});

describe("activeCombos", () => {
  test("lists combos that are cheaper than buying the pieces one by one", () => {
    expect(activeCombos(lotion, NOW).map((c) => c.qty)).toEqual([2, 3]);
  });

  test("hides a combo that costs the same as single pieces (no real saving)", () => {
    const noDeal: Priced = { ...lotion, combos: [{ qty: 2, price: 3100 }] };
    expect(activeCombos(noDeal, NOW)).toEqual([]);
    expect(total(noDeal, 2)).toBe(3100);
  });

  test("a product with no combos has none to show", () => {
    expect(activeCombos({ ...lotion, combos: [] }, NOW)).toEqual([]);
  });
});
