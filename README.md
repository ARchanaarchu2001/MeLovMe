# MELOVME — Online Store

E-commerce site for MELOVME, built with Next.js (App Router), Tailwind CSS and MongoDB.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI
npm run dev                  # http://localhost:4000
npm run build && npm start   # production server (needs Node.js hosting, e.g. Vercel, Render, a VPS)
```

In development, leave the `NEXT_PUBLIC_FIREBASE_*` variables empty: the login OTP is printed in the terminal running
`npm run dev` instead of being sent by SMS.

## Shopping flow

1. Anyone (guest) can browse products and add them to the cart or wishlist. Both are stored in the browser.
2. **Buy Now** or **Checkout** opens `/checkout/`. Guests are sent to `/login/` first and come back afterwards.
3. Login is by mobile number + OTP sent by SMS (Firebase Phone Authentication). First-time customers also enter
   their name, which creates their account.
4. At checkout, a first-time customer fills in a delivery address. Returning customers pick one of their saved
   addresses or add a new one. Addresses are saved to the account.
5. **Pay** saves the order in MongoDB and opens Razorpay Checkout: UPI apps (Google Pay, PhonePe, Paytm) on phones,
   a UPI QR code on computers, plus cards and netbanking. When the payment succeeds the order is marked `paid` and
   the customer is sent to `/orders/<id>/` ("Order confirmed").
6. `/profile/` shows the customer's name (editable) and phone number, with a log-out button.

Payments are confirmed twice: by the browser (checked with Razorpay's payment signature) and by Razorpay's webhook
(`/api/razorpay/webhook/`), so an order is still marked paid if the customer closes the page right after paying.
Ship only orders with status `paid`. Orders are in the `orders` collection (MongoDB Atlas → Browse Collections), and
every payment is also listed in the Razorpay Dashboard → Transactions.

## Razorpay setup

1. Razorpay Dashboard → Account & Settings → **API Keys** → generate keys. Put them in `.env` (and in Vercel) as
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Test keys (`rzp_test_...`) take fake payments only.
2. Account & Settings → **Webhooks** → Add New Webhook:
   - URL: `https://<your-domain>/api/razorpay/webhook/` (keep the trailing slash)
   - Secret: any long random text; put the same text in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured` and `order.paid`
3. Account & Settings → **Payment capture** → automatic (so payments don't need capturing by hand).
4. When the account is activated (KYC), generate **live** keys, replace both key variables, and add the webhook again
   in live mode (test and live webhooks are separate).

## Database (MongoDB)

| Collection | Contents |
| --- | --- |
| `users` | phone (login ID), name, saved addresses |
| `orders` | items, prices, delivery address, total, status (`awaiting_payment` / `paid`), Razorpay order and payment IDs |
| `sessions` | login sessions (expire after 30 days) |
| `otps` | development-only login codes, hashed (expire after 10 minutes) |

Indexes are created automatically on first connection.

## Where to edit

| What | File |
| --- | --- |
| Products (name, price, images, description) | `src/data/products.ts` |
| Contact details, social links, testimonials, values | `src/data/site.ts` |
| Shipping fee, order notification URL | `src/data/site.ts` (`shipping`, `orderEndpoint`) |
| Payments | `src/lib/server/razorpay.ts`, `src/app/api/razorpay/webhook/route.ts`, `src/components/CheckoutFlow.tsx` |
| Login / OTP logic | `src/components/LoginForm.tsx` (Firebase, in the browser), `src/app/actions/auth.ts` (server) |
| Checkout, addresses, orders | `src/app/actions/checkout.ts`, `src/components/CheckoutFlow.tsx` |
| Brand colours | `src/app/globals.css` (`:root`) |
| Page copy | `src/app/**/page.tsx` |
| Product images | `public/images/` |

To add a product, add an object to the `products` array and put its images in `public/images/`.
A product page is generated automatically at `/products/<slug>/`.

## Going live checklist

- Firebase console: enable Authentication -> Sign-in method -> Phone, upgrade to the Blaze plan (needed to send
  real SMS), and add your live domain under Authentication -> Settings -> Authorized domains.
- Set `MONGODB_URI`, the four `NEXT_PUBLIC_FIREBASE_*` variables and the three `RAZORPAY_*` variables in the host's
  environment variables.
- In MongoDB Atlas → Network Access, allow your host's IP addresses.
- Razorpay: switch to live keys and add the live webhook (see Razorpay setup above).

## Brand

- Deep Chocolate Brown `#462B1B`, Soft Ivory `#EEE1CA`, Espresso `#2E1A11`, Metallic Gold accent
- Typeface: Poppins
- The logo in `src/components/Logo.tsx` is a text recreation — replace it with the official SVG when available.
