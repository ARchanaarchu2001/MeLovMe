// Short product link for WhatsApp messages: /p/<product>/ forwards to /products/<product>/.
// WhatsApp follows it to build the link preview (photo, name, description) from the product page,
// and tapping the preview opens the product.
export async function GET(_request: Request, ctx: RouteContext<"/p/[slug]">) {
  const { slug } = await ctx.params;
  return new Response(null, { status: 308, headers: { Location: `/products/${encodeURIComponent(slug)}/` } });
}
