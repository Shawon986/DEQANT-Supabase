const SITE = "https://deqant-perfume.vercel.app";

const publicRoutes = [
  "/", "/shop", "/decants", "/intact", "/best-sellers", "/offers",
  "/about", "/contact", "/delivery-policy", "/privacy", "/terms"
];

const escapeXml = (value) => String(value).replace(/[<>&"']/g, (character) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;"
}[character]));

export default async function handler(_request, response) {
  const locations = new Set(publicRoutes.map((route) => `${SITE}${route}`));
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  // Include every active catalogue item so products published in the admin
  // panel can enter the sitemap without a manual source-code update.
  if (supabaseUrl && anonKey) {
    try {
      const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/products?select=slug&active=eq.true&order=created_at.desc`;
      const result = await fetch(endpoint, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (result.ok) {
        const products = await result.json();
        for (const product of products) {
          if (typeof product.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) {
            locations.add(`${SITE}/product/${encodeURIComponent(product.slug)}`);
          }
        }
      }
    } catch {
      // Keep the core public sitemap available if the catalogue API is briefly unavailable.
    }
  }

  const entries = [...locations].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`);
}
