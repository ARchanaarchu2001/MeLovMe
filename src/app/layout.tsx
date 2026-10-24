import type { Metadata, Viewport } from "next";
import { Poppins, Quicksand } from "next/font/google";
import { site } from "@/data/site";
import "./globals.css";

// Poppins is the brand typeface (tagline + body text)
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Rounded geometric face used to approximate the custom wordmark
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
};

// Keep the brand colours as designed, even when the phone is in dark mode
export const viewport: Viewport = {
  colorScheme: "only light",
};

// The page shell for the whole site. The shop adds its header and footer in (shop)/layout.tsx;
// the admin area uses its own layout (admin/layout.tsx).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Keep scroll-reveal content visible if JavaScript is disabled */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
