# Testing

Automated tests check that the shop's logic still gives the right answers after every change: what a customer is
charged, which offers and combos apply, how much stock can be bought. They run in a few seconds on your computer
and automatically on GitHub for every push and pull request.

## Tools

| Tool | Used for |
| --- | --- |
| [Vitest](https://vitest.dev) | Runs the tests and checks the results (`test`, `describe`, `expect`) |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) | Renders components and finds things on them like a user would ("the button that says Add to Cart") |
| `@testing-library/user-event` | Clicks and types in component tests |
| `@testing-library/jest-dom` | Readable checks for components, e.g. `expect(button).toBeDisabled()` |
| jsdom | A browser-like environment inside Node, so components render without opening a browser |

Vitest is the unit-testing tool recommended in the Next.js docs. It runs TypeScript and `@/...` imports without
extra setup and handles ES-module packages such as `next-intl`. Async Server Components and full flows (cart →
Razorpay → order confirmed) can't be unit tested; they will be covered by browser tests (Playwright) later.

## Running the tests

```bash
npm test             # watch mode: re-runs the affected tests every time you save a file
npm run test:run     # runs everything once and stops (use before committing; this is what GitHub runs)
npx vitest run src/lib/product.test.ts   # one file
npx vitest run -t "cheapest mix"         # only tests whose name contains this text
```

A passing run ends with `Tests  17 passed (17)`. A failing test shows which check failed, what was expected and
what the code actually returned.

## Files

| File | Purpose |
| --- | --- |
| `vitest.config.mts` | Vitest settings: React support, `@/` imports, browser-like environment, where tests live |
| `vitest.setup.ts` | Runs before the tests; adds the jest-dom checks |
| `src/**/*.test.ts(x)` | The tests. Each sits next to the file it tests: `src/lib/product.ts` → `src/lib/product.test.ts` |
| `.github/workflows/test.yml` | Runs the tests on GitHub for every push and pull request to `main` |

## Writing a test

```ts
import { describe, expect, test } from "vitest";
import { lineTotal } from "./product";

describe("combo pricing", () => {
  test("4 pieces use the cheapest combo mix", () => {
    expect(lineTotal(product, 4, NOW).total).toBe(5900);
  });
});
```

Guidelines:

- **Name tests as plain sentences** that say what should happen: "an offer that has ended doesn't affect combos".
  The names are the list of rules the code must follow.
- **One idea per test.** When it fails, the name alone should tell you what broke.
- **Use fixed dates.** Pass a fixed `now` (or use `vi.useFakeTimers()`) so offer tests don't change result as days
  pass. Offer dates are India time (`+05:30`).
- **Use simple, realistic numbers** that are easy to check by hand, and write the working in a comment
  (`// 3-piece combo + 1 piece = ₹5,900`).
- **Don't touch real services.** Replace MongoDB, EmailJS, Razorpay and Cloudinary with fakes (`vi.mock`) so tests
  never change real data, send emails or take payments.
- **When you fix a bug, add a test** that fails without the fix, so it can't come back.

## What is tested

### Combo pricing — `src/lib/product.test.ts`

Sample product: ₹1,550 each, 2 for ₹3,000, 3 for ₹4,350. "Today" is fixed to 15 June 2026.

`lineTotal` — what a quantity of one product costs:

| Situation | Expected |
| --- | --- |
| No combos, 3 pieces | ₹4,650 (price × quantity), no saving |
| 0 pieces | ₹0 |
| 1 piece | ₹1,550, no saving |
| Exactly 2 / exactly 3 pieces | Combo price ₹3,000 (saves ₹100) / ₹4,350 (saves ₹300) |
| 4 pieces | 3-piece combo + 1 piece = ₹5,900 (not two 2-piece combos at ₹6,000) |
| 5 pieces | 3-piece + 2-piece combo = ₹7,350 |
| 6 and 7 pieces | The same combo used twice: ₹8,700 and ₹10,250 |
| 2 for ₹2,800 instead | 4 pieces = two 2-piece combos = ₹5,600: the cheapest mix wins, not the biggest combo |
| Combos listed in a different order | Same price for 1–10 pieces |
| Any quantity 1–10 | Saving = single-piece total − charged total; combos never make it dearer |

Combos together with offers:

| Situation | Expected |
| --- | --- |
| 50% offer (1 piece ₹775) | Combos switch off; the customer pays the cheaper offer price |
| 5% offer (1 piece ₹1,473) | Only the 2-piece combo switches off (two singles ₹2,946 are cheaper); the 3-piece stays (₹4,350 < ₹4,419) |
| Offer that starts later | Ignored; combos work as normal |
| Offer that has ended | Ignored; combos work as normal |

`activeCombos` — which combos the shop shows:

| Situation | Expected |
| --- | --- |
| Normal product | Both combos shown |
| 2 for ₹3,100 (no real saving) | Hidden, and 2 pieces cost ₹3,100 |
| No combos | Nothing shown |

## Still to test

- [ ] Offer prices and dates: `priceOf`, `offerStatus`, `offerDaysLeft` (`src/lib/product.ts`)
- [ ] Stock limits: `maxQtyFor` (`src/lib/product.ts`)
- [ ] Delivery address checks: `validateAddress` (`src/lib/order.ts`)
- [ ] Shipping fee
- [ ] Admin checks: products, combos, announcement bar (`src/app/actions/admin.ts`)
- [ ] Contact form (`src/app/actions/contact.ts`, EmailJS faked)
- [ ] Components: combo picker, stock badge, offer sticker, announcement bar
- [ ] Browser tests with Playwright: add to cart → checkout → payment → order in admin

Tick each item and add its table of cases above when its tests are written.
