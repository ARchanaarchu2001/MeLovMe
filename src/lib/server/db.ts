import "server-only";
import { MongoClient, type Db, type ObjectId } from "mongodb";
import { seedProducts } from "@/data/seed-products";
import type { Announcement } from "@/lib/announcement";
import type { Address, Fulfillment, OrderStatus, Refund } from "@/lib/order";
import type { PaymentSettings } from "@/lib/payments";
import type { Product } from "@/lib/product";
import type { PaymentDetails } from "./razorpay";

export type UserDoc = {
  _id: ObjectId;
  phone: string; // 10-digit Indian mobile number, the login ID
  name: string;
  addresses: (Address & { _id: ObjectId })[];
  // true = full access to the admin panel (/admin). New users get false; to make someone an
  // admin, set it to true in MongoDB Atlas (users collection).
  superAdmin: boolean;
  createdAt: Date;
};

export type SessionDoc = { token: string; userId: ObjectId; expiresAt: Date };

// Development-only login codes (see devSendOtp in src/app/actions/auth.ts). Only a hash is stored.
export type OtpDoc = { phone: string; codeHash: string; attempts: number; sentAt: Date; expiresAt: Date };

export type OrderDoc = {
  _id: string; // human-friendly order ID, e.g. ML-M1X2Y3ABC
  userId: ObjectId;
  address: Address;
  // `price` is what the customer paid per item (the offer price during an offer)
  // `comboSaving`: what combo offers took off `price` × `qty` (total = price × qty − comboSaving)
  items: { slug: string; name: string; size: string; qty: number; price: number; total: number; comboSaving?: number; image?: string }[];
  subtotal: number;
  shipping: number;
  total: number;
  // "awaiting_payment": online payment started, not finished. "cod": placed with cash on delivery,
  // cash not collected yet. "paid": money received (online, or COD marked as collected).
  status: OrderStatus;
  paymentMethod?: "razorpay" | "cod"; // missing on orders from before COD existed (all Razorpay)
  razorpayOrderId?: string; // the Razorpay order the customer pays against (online payments only)
  paymentId?: string; // Razorpay payment ID, once paid
  paidAt?: Date;
  payment?: PaymentDetails; // how it was paid (method, UPI app, UTR...), looked up from Razorpay once paid
  refunds?: Refund[]; // refunds made from /admin/orders, through Razorpay
  // Set by the shop in /admin/orders once the order is paid
  fulfillment?: Fulfillment;
  // When each delivery status was set, for the tracker on the customer's order page
  // (orders from before this was added don't have it)
  statusHistory?: { status: Fulfillment; at: Date }[];
  cancelledBy?: "customer"; // set when the customer cancelled it from their order page
  courier?: string;
  trackingNumber?: string;
  adminNote?: string; // only visible to the shop
  stockTaken?: boolean; // its items were taken out of stock when paid (orders from before stock counts weren't)
  createdAt: Date;
  updatedAt?: Date;
};

export type ProductDoc = Omit<Product, "slug" | "inStock" | "stock" | "combos"> & {
  _id: string;
  combos?: Product["combos"]; // missing on products saved before combos existed
  stock?: number; // missing on products saved before stock counts existed
  inStock?: boolean; // kept in step with stock > 0
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewDoc = {
  _id: ObjectId;
  productSlug: string;
  // Who added it: "customer" = written by a logged-in customer on the product page,
  // "admin" = added by the shop in /admin/reviews (e.g. feedback received on WhatsApp)
  source: "customer" | "admin";
  userId?: ObjectId; // the customer who wrote it (customer reviews only; one per customer per product)
  addedBy?: ObjectId; // the admin who added it (admin reviews only)
  name: string; // shown publicly
  rating: number; // 1–5
  title: string;
  text: string;
  verified: boolean; // the customer had a paid order with this product when they wrote it
  hidden: boolean; // hidden from the shop by an admin
  createdAt: Date;
  updatedAt: Date;
};

// Shop-wide settings edited in the admin area, one document each
export type AnnouncementSettingsDoc = { _id: "announcement" } & Announcement & { updatedAt: Date };
export type PaymentSettingsDoc = { _id: "payments" } & PaymentSettings & { updatedAt: Date };
export type SettingsDoc = AnnouncementSettingsDoc | PaymentSettingsDoc;


// Reuse one client across hot reloads in dev and across requests in prod
const globalForMongo = globalThis as unknown as { mongo?: Promise<Db> };

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — add it to .env.local");
  // A small pool of connections that stay open: requests share them instead of opening new ones.
  // Opening connections is slow (TLS handshake to Atlas), and shared Atlas tiers limit how many
  // there can be and how fast they're opened. (The driver's default is up to 100.)
  const client = await new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 2, maxIdleTimeMS: 10 * 60 * 1000 }).connect();
  const db = client.db(process.env.MONGODB_DB || "melovme");

  // Login used to be by email: drop those old unique indexes, which would reject phone-only documents
  await Promise.all(["users", "otps"].map((c) => db.collection(c).dropIndex("email_1").catch(() => {})));

  await Promise.all([
    db.collection("users").createIndex({ phone: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("otps").createIndex({ phone: 1 }, { unique: true }),
    db.collection("otps").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("orders").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("orders").createIndex({ razorpayOrderId: 1 }),
    db.collection("orders").createIndex({ status: 1, createdAt: -1 }),
    db.collection("products").createIndex({ enabled: 1, createdAt: 1 }),
    db.collection("reviews").createIndex({ productSlug: 1, hidden: 1, createdAt: -1 }),
    db.collection("reviews").createIndex({ createdAt: -1 }),
    // One review per customer per product (admin reviews have no userId)
    db.collection("reviews").createIndex(
      { productSlug: 1, userId: 1 },
      { unique: true, partialFilterExpression: { userId: { $exists: true } } },
    ),
  ]);

  // First run: copy the starting catalogue in. Spread createdAt so the shop keeps their order.
  const products = db.collection<ProductDoc>("products");
  if ((await products.estimatedDocumentCount()) === 0) {
    const start = Date.now();
    await products
      .insertMany(
        seedProducts.map(({ slug, ...p }, i) => ({
          ...p,
          _id: slug,
          enabled: true,
          inStock: true,
          offer: null,
          createdAt: new Date(start + i),
          updatedAt: new Date(start + i),
        })),
        { ordered: false },
      )
      .catch(() => {}); // another request may have seeded at the same moment
  }
  return db;
}

export async function getDb() {
  globalForMongo.mongo ??= connect().catch((err) => {
    globalForMongo.mongo = undefined; // let the next request retry
    throw err;
  });
  const db = await globalForMongo.mongo;
  return {
    users: db.collection<UserDoc>("users"),
    sessions: db.collection<SessionDoc>("sessions"),
    otps: db.collection<OtpDoc>("otps"),
    orders: db.collection<OrderDoc>("orders"),
    products: db.collection<ProductDoc>("products"),
    settings: db.collection<SettingsDoc>("settings"),
    reviews: db.collection<ReviewDoc>("reviews"),
  };
}
