import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-5 py-32 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl font-light">Page not found</h1>
      <p className="mt-4 text-chocolate/70">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-10">Back to Home</Link>
    </section>
  );
}
