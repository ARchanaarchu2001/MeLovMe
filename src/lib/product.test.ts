import { describe, expect, test } from "vitest";
import { LOW_STOCK, activeCombos, lineTotal, maxQtyFor, offerDaysLeft, offerStatus, priceOf, type Offer, type Product } from "./product";

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

describe("offer dates: offerStatus", () => {
  // Offer runs 10–20 June 2026, India time
  const june: Offer = { type: "percent", value: 20, startsAt: "2026-06-10T00:00:00+05:30", endsAt: "2026-06-20T23:59:59+05:30" };

  test("a product without an offer has no offer status", () => {
    expect(offerStatus(null, NOW)).toBeNull();
    expect(offerStatus(undefined, NOW)).toBeNull();
  });

  test("an offer worth nothing (0 or less) counts as no offer", () => {
    expect(offerStatus({ type: "percent", value: 0 }, NOW)).toBeNull();
    expect(offerStatus({ type: "flat", value: -100 }, NOW)).toBeNull();
  });

  test("an offer without dates is always running", () => {
    expect(offerStatus({ type: "flat", value: 100 }, NOW)).toBe("active");
  });

  test("an offer is running between its start and end dates", () => {
    expect(offerStatus(june, NOW)).toBe("active");
  });

  test("an offer that starts later is upcoming", () => {
    expect(offerStatus(june, Date.parse("2026-06-09T23:59:59+05:30"))).toBe("upcoming");
  });

  test("an offer is running from the first moment of its start day", () => {
    expect(offerStatus(june, Date.parse("2026-06-10T00:00:00+05:30"))).toBe("active");
  });

  test("an offer is still running at the last moment of its end day", () => {
    expect(offerStatus(june, Date.parse("2026-06-20T23:59:59+05:30"))).toBe("active");
  });

  test("an offer whose end date has passed is ended", () => {
    expect(offerStatus(june, Date.parse("2026-06-21T00:00:00+05:30"))).toBe("ended");
  });

  test("an offer with only an end date runs until then", () => {
    const untilJune20: Offer = { type: "percent", value: 20, endsAt: june.endsAt };
    expect(offerStatus(untilJune20, NOW)).toBe("active");
    expect(offerStatus(untilJune20, Date.parse("2026-07-01T12:00:00+05:30"))).toBe("ended");
  });
});

describe("offer prices: priceOf", () => {
  test("without an offer the customer pays the regular price, with nothing off", () => {
    expect(priceOf({ price: 1550, offer: null }, NOW)).toEqual({ price: 1550, mrp: 1550, off: 0 });
  });

  test("a % offer takes that share off the price", () => {
    // 20% of ₹1,550 = ₹310, so ₹1,240
    expect(priceOf({ price: 1550, offer: { type: "percent", value: 20 } }, NOW)).toEqual({ price: 1240, mrp: 1550, off: 20 });
  });

  test("a ₹ offer takes that amount off, and shows the rounded % saved", () => {
    // ₹1,550 − ₹300 = ₹1,250; 300 / 1550 = 19.4% → 19% off
    expect(priceOf({ price: 1550, offer: { type: "flat", value: 300 } }, NOW)).toEqual({ price: 1250, mrp: 1550, off: 19 });
  });

  test("offer prices are rounded to whole rupees", () => {
    // 5% of ₹1,550 = ₹77.50 → ₹1,472.50 rounds to ₹1,473
    expect(priceOf({ price: 1550, offer: { type: "percent", value: 5 } }, NOW).price).toBe(1473);
  });

  test("an offer never brings the price below ₹1", () => {
    expect(priceOf({ price: 500, offer: { type: "flat", value: 800 } }, NOW).price).toBe(1);
  });

  test("an offer that hasn't started yet doesn't change the price", () => {
    const later: Offer = { type: "percent", value: 50, startsAt: "2026-07-01T00:00:00+05:30" };
    expect(priceOf({ price: 1550, offer: later }, NOW)).toEqual({ price: 1550, mrp: 1550, off: 0 });
  });

  test("an offer that has ended doesn't change the price", () => {
    const over: Offer = { type: "percent", value: 50, endsAt: "2026-06-01T23:59:59+05:30" };
    expect(priceOf({ price: 1550, offer: over }, NOW)).toEqual({ price: 1550, mrp: 1550, off: 0 });
  });
});

describe("offer countdown: offerDaysLeft", () => {
  // Last day of the offer is 20 June 2026 (India time)
  const endsJune20: Offer = { type: "percent", value: 20, endsAt: "2026-06-20T23:59:59+05:30" };

  test("counts the whole days until the offer's last day", () => {
    // 15 June → 20 June = 5 days
    expect(offerDaysLeft(endsJune20, NOW)).toBe(5);
  });

  test("is 0 on the offer's last day", () => {
    expect(offerDaysLeft(endsJune20, Date.parse("2026-06-20T09:00:00+05:30"))).toBe(0);
  });

  test("counts India dates, even just after midnight when it is still the day before in UTC", () => {
    // 00:30 on 19 June in India is 18 June 19:00 UTC; one day left
    expect(offerDaysLeft(endsJune20, Date.parse("2026-06-19T00:30:00+05:30"))).toBe(1);
  });

  test("an offer without an end date has no countdown", () => {
    expect(offerDaysLeft({ type: "percent", value: 20 }, NOW)).toBeNull();
  });

  test("an offer that hasn't started has no countdown", () => {
    expect(offerDaysLeft({ ...endsJune20, startsAt: "2026-06-18T00:00:00+05:30" }, NOW)).toBeNull();
  });

  test("an offer that has ended has no countdown", () => {
    expect(offerDaysLeft(endsJune20, Date.parse("2026-06-21T10:00:00+05:30"))).toBeNull();
  });
});

describe("stock limits: maxQtyFor", () => {
  test("a product whose stock isn't counted can be bought up to the cart limit", () => {
    expect(maxQtyFor({ stock: null }, 10)).toBe(10);
  });

  test("plenty of stock still stops at the cart limit", () => {
    expect(maxQtyFor({ stock: 50 }, 10)).toBe(10);
  });

  test("low stock lowers the limit to what is left", () => {
    expect(maxQtyFor({ stock: 3 }, 10)).toBe(3);
  });

  test("no stock means none can be bought", () => {
    expect(maxQtyFor({ stock: 0 }, 10)).toBe(0);
  });

  test("a negative stock count is treated as none", () => {
    expect(maxQtyFor({ stock: -2 }, 10)).toBe(0);
  });

  test("the shop warns 'only a few left' at 5 units or fewer", () => {
    expect(LOW_STOCK).toBe(5);
  });
});
