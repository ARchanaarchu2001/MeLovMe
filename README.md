# MELOVME — Website

Static marketing site for MELOVME, built with Next.js (App Router) and Tailwind CSS.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site written to /out — upload that folder to any host
```

## Where to edit

| What | File |
| --- | --- |
| Products (name, price, images, description) | `src/data/products.ts` |
| Contact details, social links, testimonials, values | `src/data/site.ts` |
| Brand colours | `src/app/globals.css` (`:root`) |
| Page copy | `src/app/**/page.tsx` |
| Product images | `public/images/` |

To add a product, add an object to the `products` array and put its images in `public/images/`.
A product page is generated automatically at `/products/<slug>/`.

## Brand

- Deep Chocolate Brown `#462B1B`, Soft Ivory `#EEE1CA`, Espresso `#2E1A11`, Metallic Gold accent
- Typeface: Poppins
- The logo in `src/components/Logo.tsx` is a text recreation — replace it with the official SVG when available.
