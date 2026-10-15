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
5. The order is saved in MongoDB, then paid by UPI (QR code / "Open UPI App") straight to `site.upi.id`. There is
   no payment gateway. The customer enters the 12-digit UPI reference (UTR) and the order is marked
   `payment_submitted`.
6. `/profile/` shows the customer's name (editable) and phone number, with a log-out button.

Payments are **not verified automatically**: match each order's UTR and amount against your UPI/bank statement
before dispatching. Orders are in the `orders` collection (view them in MongoDB Atlas → Browse Collections).

## Database (MongoDB)

| Collection | Contents |
| --- | --- |
| `users` | phone (login ID), name, saved addresses |
| `orders` | items, prices, delivery address, total, status, UPI reference |
| `sessions` | login sessions (expire after 30 days) |
| `otps` | development-only login codes, hashed (expire after 10 minutes) |

Indexes are created automatically on first connection.

## Where to edit

| What | File |
| --- | --- |
| Products (name, price, images, description) | `src/data/products.ts` |
| Contact details, social links, testimonials, values | `src/data/site.ts` |
| UPI ID that receives payments, shipping fee, order notification URL | `src/data/site.ts` (`upi`, `shipping`, `orderEndpoint`) |
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
- Set `MONGODB_URI` and the four `NEXT_PUBLIC_FIREBASE_*` variables in the host's environment variables.
- In MongoDB Atlas → Network Access, allow your host's IP addresses.
- Replace `site.upi.id` with the real business UPI ID.

## Brand

- Deep Chocolate Brown `#462B1B`, Soft Ivory `#EEE1CA`, Espresso `#2E1A11`, Metallic Gold accent
- Typeface: Poppins
- The logo in `src/components/Logo.tsx` is a text recreation — replace it with the official SVG when available.
