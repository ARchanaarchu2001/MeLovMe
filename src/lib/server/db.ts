import "server-only";
import { MongoClient, type Db, type ObjectId } from "mongodb";
import { seedProducts } from "@/data/seed-products";
import type { Address, Fulfillment } from "@/lib/order";
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
  items: { slug: string; name: string; size: string; qty: number; price: number; total: number; image?: string }[];
  subtotal: number;
  shipping: number;
  total: number;
  status: "awaiting_payment" | "paid";
  razorpayOrderId: string; // the Razorpay order the customer pays against
  paymentId?: string; // Razorpay payment ID, once paid
  paidAt?: Date;
  payment?: PaymentDetails; // how it was paid (method, UPI app, UTR...), looked up from Razorpay once paid
  // Set by the shop in /admin/orders once the order is paid
  fulfillment?: Fulfillment;
  courier?: string;
  trackingNumber?: string;
  adminNote?: string; // only visible to the shop
  createdAt: Date;
  updatedAt?: Date;
};

export type ProductDoc = Omit<Product, "slug"> & { _id: string; createdAt: Date; updatedAt: Date };


// Reuse one client across hot reloads in dev and across requests in prod
const globalForMongo = globalThis as unknown as { mongo?: Promise<Db> };

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — add it to .env.local");
  const client = await new MongoClient(uri).connect();
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
  };
}
