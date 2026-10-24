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

## Admin (`/admin/`)

Admin access is a `superAdmin` true/false field on each user in MongoDB (`users` collection). New users get
`false`. To make someone an admin, have them sign up once, then in MongoDB Atlas → Browse Collections → `users`, find
them by `phone`, and set `superAdmin` to `true` (set it back to `false` to remove access). Admins land on the admin
**dashboard** (`/admin/`) after logging in (or on checkout, if they were checking out), and the header's account icon
takes them there too. The admin area has its own sidebar layout (Dashboard, Orders, Customers, Products, View shop,
Log out) instead of the shop header and footer. Anyone else gets "page not found". Admin → Customers → **Admins**
lists the admins.

- **Orders**: every order with payment status (Paid / Awaiting payment), search by order ID, name or phone, and
  revenue totals. Open an order to see items, address, customer and Razorpay IDs, and to update its **status**
  (Order placed → Packed → Shipped → Delivered, or Cancelled), courier and tracking number (shown to the customer)
  and a private note. Cancelling doesn't refund: refund in the Razorpay Dashboard.
- **Customers**: everyone who signed up, newest first, with orders, total spent and saved addresses.
- **Products**: add and edit products, upload images (shrunk in the browser, then uploaded straight to Cloudinary in the `melovme/products` folder; MongoDB
  stores only the image links), turn products
  **on/off** (off = hidden from the shop and can't be bought), and set an **offer**: % or ₹ off, optionally between
  two dates (India time). The shop shows the offer price, the struck-through regular price and an "X% off" badge,
  and checkout charges the offer price.

Shop pages are cached and refreshed straight away when a product is saved; offers also start and end on time
(pages rebuild at least every 5 minutes).

## Database (MongoDB)

| Collection | Contents |
| --- | --- |
| `users` | phone (login ID), name, saved addresses, `superAdmin` (true = admin access) |
| `products` | the catalogue, managed in /admin/products. Filled from `src/data/seed-products.ts` the first time it's empty |
| `orders` | items, prices, delivery address, total, payment status (`awaiting_payment` / `paid`), delivery status, tracking, Razorpay order and payment IDs |
| `sessions` | login sessions (expire after 30 days) |
| `otps` | development-only login codes, hashed (expire after 10 minutes) |

Indexes are created automatically on first connection.

## Where to edit

| What | File |
| --- | --- |
| Products, prices, offers, images | **/admin/products** (stored in MongoDB) |
| Contact details, social links, testimonials, values | `src/data/site.ts` |
| Shipping fee, order notification URL | `src/data/site.ts` (`shipping`, `orderEndpoint`) |
| Payments | `src/lib/server/razorpay.ts`, `src/app/api/razorpay/webhook/route.ts`, `src/components/CheckoutFlow.tsx` |
| Login / OTP logic | `src/components/LoginForm.tsx` (Firebase, in the browser), `src/app/actions/auth.ts` (server) |
| Checkout, addresses, orders | `src/app/actions/checkout.ts`, `src/components/CheckoutFlow.tsx` |
| Brand colours | `src/app/globals.css` (`:root`) |
| Page copy | `src/app/**/page.tsx` |
| Admin pages | `src/app/admin/`, `src/components/admin/`, `src/app/actions/admin.ts` |

## Going live checklist

- Firebase console: enable Authentication -> Sign-in method -> Phone, upgrade to the Blaze plan (needed to send
  real SMS), and add your live domain under Authentication -> Settings -> Authorized domains.
- Set `MONGODB_URI`, the four `NEXT_PUBLIC_FIREBASE_*` variables, the three `RAZORPAY_*` variables and the three
  `CLOUDINARY_*` variables in the host's environment variables.
- In /admin/products, turn off the ₹1 **Test Product**.
- In MongoDB Atlas → Network Access, allow your host's IP addresses.
- Razorpay: switch to live keys and add the live webhook (see Razorpay setup above).

## Brand

- Deep Chocolate Brown `#462B1B`, Soft Ivory `#EEE1CA`, Espresso `#2E1A11`, Metallic Gold accent
- Typeface: Poppins
- The logo in `src/components/Logo.tsx` is a text recreation — replace it with the official SVG when available.
