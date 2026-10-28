// Product reviews as the shop shows them. Reviews live in MongoDB (`reviews` collection): customers
// write them on the product page, and the shop can add and moderate them in /admin/reviews.

export type Review = {
  id: string;
  name: string; // shown publicly
  rating: number; // 1–5 stars
  title: string; // may be empty
  text: string;
  verified: boolean; // written by a customer who bought the product
  createdAt: string; // ISO date-time
};

// Average stars, number of reviews, and how many gave 5, 4, 3, 2 and 1 stars
export type ReviewSummary = { average: number; count: number; byStars: [number, number, number, number, number] };

// What the review forms send (customer and admin)
export type ReviewInput = { name: string; rating: number; title: string; text: string };

export const reviewLimits = { name: 40, title: 100, text: 2000, minText: 5 };
