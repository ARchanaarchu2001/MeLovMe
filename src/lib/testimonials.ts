// The "Loved by our community" reviews on the home page: a photo, the message and who wrote it.
// Edited in /admin/testimonials/. Until an admin saves them, the shop shows the ones in en.json.

export type Testimonial = {
  id: string; // keeps each card's place while editing and reordering
  name: string;
  place: string; // optional, e.g. "Chennai"
  message: string;
  photo: string | null; // link to the customer's photo
};

export const testimonialLayouts = ["grid", "slider"] as const;

export type Testimonials = {
  enabled: boolean;
  layout: (typeof testimonialLayouts)[number]; // grid: all at once; slider: a row that scrolls sideways
  autoScroll: boolean; // slider only: moves on by itself every few seconds
  items: Testimonial[];
};

export const testimonialLimits = { items: 24, name: 60, place: 60, message: 400 };
