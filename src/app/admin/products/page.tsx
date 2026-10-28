import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Price from "@/components/Price";
import AdminToast from "@/components/admin/AdminToast";
import ProductActions from "@/components/admin/ProductActions";
import ProductToggle from "@/components/admin/ProductToggle";
import { formatDate } from "@/components/admin/ui";
import StockEditor from "@/components/admin/StockEditor";
import { LOW_STOCK, offerStatus } from "@/lib/product";
import { getDb } from "@/lib/server/db";
import { toProduct } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Products" };

// All products, including disabled ones, in shop order
export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin("/admin/products/");
  const { added } = await searchParams;
  const docs = await (await getDb()).products.find().sort({ createdAt: 1 }).toArray();
  const all = docs.map(toProduct);
  // Just created (the new product form sends us here with ?added=slug)
  const addedProduct = typeof added === "string" ? all.find((p) => p.slug === added) : undefined;
  const outOfStock = all.filter((p) => !p.inStock).length;
  const lowStock = all.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= LOW_STOCK).length;

  return (
    <div>
      {addedProduct && <AdminToast key={addedProduct.slug} title="Product added" message={addedProduct.name} />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-chocolate/70">
          {docs.length} product{docs.length === 1 ? "" : "s"} · {docs.filter((d) => d.enabled).length} shown in the shop
          {outOfStock > 0 && <> · <span className="text-red-800">{outOfStock} out of stock</span></>}
          {lowStock > 0 && <> · <span className="text-amber-900">{lowStock} low on stock</span></>}
        </p>
        <Link href="/admin/products/new/" className="btn btn-primary !px-6 !py-3">+ Add product</Link>
      </div>

      <ul className="grid gap-4">
        {docs.map((d) => {
          const p = toProduct(d);
          const offer = p.offer;
          const status = offerStatus(offer);
          return (
            <li key={p.slug} className={`flex flex-wrap items-center gap-5 rounded-2xl border p-4 ${p.enabled ? "border-chocolate/15" : "border-dashed border-chocolate/25 bg-chocolate/[0.03]"}`}>
              <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ivory ${p.enabled ? "" : "opacity-50"}`}>
                {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="80px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.slug}/`} className="font-medium hover:text-gold">{p.name}</Link>
                <p className="text-xs text-chocolate/60">
                  {p.category} · {p.size}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <Price product={p} />
                  {status === "upcoming" && offer?.startsAt && (
                    <span className="text-xs text-chocolate/60">Offer starts {formatDate(new Date(offer.startsAt))}</span>
                  )}
                  {status === "ended" && <span className="text-xs text-chocolate/60">Offer ended</span>}
                  {status === "active" && offer?.endsAt && (
                    <span className="text-xs text-chocolate/60">until {formatDate(new Date(offer.endsAt))}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <ProductToggle slug={p.slug} name={p.name} flag="enabled" value={p.enabled} />
                <StockEditor slug={p.slug} name={p.name} stock={p.stock} />
                <ProductActions slug={p.slug} name={p.name} image={p.images[0]} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
