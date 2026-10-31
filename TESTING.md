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

A passing run ends with `Tests  1212 passed | 6 todo (1218)`; each `todo` is a known bug (see below). A failing test shows which check failed, what was expected and
what the code actually returned.

## Files

| File | Purpose |
| --- | --- |
| `vitest.config.mts` | Vitest settings: React support, `@/` imports, browser-like environment, where tests live |
| `vitest.setup.ts` | Runs before the tests; adds the jest-dom checks |
| `src/**/*.test.ts(x)` | The tests. Each sits next to the file it tests: `src/lib/product.ts` → `src/lib/product.test.ts` |
| `src/test/render.tsx` | Helpers for component tests: `renderWithIntl` (English messages + catalogue), `makeProduct`, `resetStores` (empties cart and wishlist), `mockScreen` (phone/computer), `mockDialog` (jsdom has no `<dialog>` methods) |
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
- **Server code runs in Node.** Tests for `src/lib/server`, `src/app/actions` and `src/app/api` start with
  `// @vitest-environment node` and replace `server-only`, `next/headers`, `next/cache` and `next/navigation` with fakes
  (`redirect` throws, like the real one).
- **Write `beforeEach(() => { ... })` with braces.** Without them the mock is returned and Vitest calls it as teardown.

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

### Everything else

Each test file lists its rules as test names; open it to see every case. In short:

| Area | Files | What is checked |
| --- | --- | --- |
| Offers and stock | `src/lib/product.test.ts` | Offers start and end on whole India-time days; % and ₹ discounts (never below ₹1); days left; buy limit = stock, at most 10 |
| Address, shipping, refunds | `src/lib/order.test.ts` | Phone 6–9 + 9 digits, 6-digit PIN not starting with 0; free-shipping threshold; refund labels; customers can cancel only before shipping |
| Cart, wishlist, saved lists | `src/lib/cart.test.ts`, `wishlist.test.ts`, `store.test.ts` | Quantities add up and stop at 10; unticked and sold-out lines aren't charged; quantity cut to stock; broken saved data is cleaned; other tabs stay in sync |
| Admin form checks | `src/lib/admin-validation.test.ts` | Every rule for products, combos, offer dates, stock, orders, announcement bar, banner and admin reviews |
| Uploads | `src/lib/upload.test.ts` | Photos shrunk to WebP; signed upload to Cloudinary (faked); error messages |
| Database and settings | `src/lib/server/*.test.ts` | Defaults when nothing is saved; starting catalogue; category migration; stock never below 0; refunds subtracted from the total; review averages |
| Razorpay | `src/lib/server/razorpay.test.ts`, `src/app/api/razorpay/webhook/route.test.ts` | Rupees → paise; payment details (UPI app, card, bank); payment and webhook signatures (real HMACs) accepted only when correct; an order is marked paid once |
| Login and sessions | `src/lib/server/session.test.ts`, `firebase.test.ts`, `src/app/actions/auth.test.ts` | OTP stored hashed, expires in 10 min, 5 wrong tries max; Firebase tokens checked (signature, audience, expiry, Indian number); 30-day sessions; only super admins reach `/admin`; after login, never sent to another site (incl. `/\` and tab tricks) |
| Checkout and orders | `src/app/actions/checkout.test.ts`, `orders.test.ts` | Prices always from the shop, never the browser; combos and offers worked out again; stock and the 10-piece limit checked per product, even when split over cart lines; COD takes stock at once, online only after payment; customers only see and cancel their own orders |
| Admin actions | `src/app/actions/admin.test.ts` | Every admin action refuses non-admins; refunds never exceed what's left; images only from the shop's Cloudinary; categories can't be deleted while in use |
| Reviews, contact, routes | `src/app/actions/reviews.test.ts`, `contact.test.ts`, `src/app/api/**`, `src/app/p/**` | Verified-buyer badge; editing doesn't un-hide; bot field; EmailJS faked; status codes |
| Shop components | `src/components/*.test.tsx` | Add to cart, combo picker, stock badges, offer stickers and timers, cart totals, checkout with Razorpay/COD, login with OTP, address/contact/profile/review forms, header counts, wishlist |
| Admin components | `src/components/admin/*.test.tsx` | Product form (prices, offers, combos, images), stock editor, order status and refunds, payment switches, announcement bar, banner (picture, button text and links from every page, category and product), testimonials, categories, delete confirmations |

## Known bugs (tests marked `todo`)

Found while writing the tests. Fix the code, then turn the `test.todo` into a real test.

| Where | Problem |
| --- | --- |
| `src/lib/admin-validation.ts` `isDate` | Month 13 or day 32 throws an error instead of "Enter valid dates." |
| `src/lib/admin-validation.ts` `toSlug`, `src/lib/category.ts` | "Café Crème" becomes `cafe-cre-me` |
| `src/lib/cart.ts` | Delivery fee charged when nothing is selected (only matters once a fee is set) |
| `src/components/LoginForm.tsx` | The code box isn't focused after Send OTP |
| `src/components/admin/actions.tsx` | Confirm dialogs don't focus Cancel as intended |
| `src/components/admin/AnnouncementForm.tsx` | "Please fix the highlighted fields." stays after the fields are fixed |

Smaller issues without a test: a phone number of only spaces says "invalid" instead of "required"
(`src/lib/order.ts`); repeated announcement messages are read out by screen readers (`AnnouncementBar.tsx`); the
contact form's topic dropdown has no label (`Select.tsx`); the wishlist's Move to Cart shows when buying is switched off
(`WishlistView.tsx`).

## Still to test

- [ ] Pages that load data on the server (async Server Components)
- [ ] Browser tests with Playwright: add to cart → checkout → payment → order in admin
