const SITE = "https://deqant-perfume.vercel.app";
const pages = {
  "/": ["DEQANT Fragrance | Perfume Decants & Authentic Perfumes in Bangladesh", "Discover considered fragrances at DEQANT. Explore perfume decants and intact bottles, compare fragrance notes, and find a signature scent with delivery across Bangladesh."],
  "/shop": ["Shop Perfumes & Fragrance Decants | DEQANT Bangladesh", "Shop the DEQANT fragrance collection. Discover perfume decants and intact bottles, explore scent families and notes, and find your next signature fragrance."],
  "/decants": ["Perfume Decants in Bangladesh | DEQANT Fragrance", "Try your next signature scent before choosing a full bottle. Explore carefully prepared perfume decants in convenient sizes from DEQANT."],
  "/intact": ["Authentic Intact Perfume Bottles | DEQANT Fragrance", "Explore intact perfume bottles at DEQANT. Discover fragrances for your collection, with clear product details and delivery across Bangladesh."],
  "/best-sellers": ["Best-Selling Perfumes | DEQANT Fragrance", "Discover popular fragrances chosen by DEQANT customers. Browse best-selling perfume decants and intact bottles by scent and style."],
  "/offers": ["Perfume Offers & Special Prices | DEQANT", "Explore current DEQANT fragrance offers on selected perfume decants and intact bottles. Check product sizes, availability and prices online."],
  "/about": ["Our Story | DEQANT Fragrance", "Discover the DEQANT approach to fragrance: thoughtful discovery, carefully prepared decants, and a considered perfume wardrobe."],
  "/contact": ["Contact & Fragrance Concierge | DEQANT", "Contact DEQANT for perfume enquiries, product guidance, order support and delivery information."],
  "/privacy": ["Privacy Policy | DEQANT Fragrance", "Read how DEQANT handles customer information and protects privacy when you browse or shop online."],
  "/terms": ["Terms & Conditions | DEQANT Fragrance", "Review the terms and conditions for shopping, orders and services at DEQANT Fragrance."],
  "/delivery-policy": ["Delivery & Returns Policy | DEQANT", "Find DEQANT delivery information, shipping charges, order handling and return policy details."],
  "/cart": ["Your Shopping Bag | DEQANT Fragrance", "Review the perfumes and fragrance sizes in your DEQANT shopping bag."],
  "/checkout": ["Secure Checkout | DEQANT Fragrance", "Complete your DEQANT fragrance order with clear delivery information."],
  "/track": ["Track Your Perfume Order | DEQANT", "Check the latest status of your DEQANT fragrance order."],
  "/account": ["Your Account | DEQANT Fragrance", "Manage your DEQANT account and fragrance orders."],
  "/orders": ["Your Orders | DEQANT Fragrance", "Review your recent DEQANT fragrance orders."],
  "/login": ["Sign In | DEQANT Fragrance", "Sign in to your DEQANT account."],
  "/admin": ["Store Administration | DEQANT", "Private DEQANT store administration."]
};
function replaceMeta(html, key, name, value) {
  const escaped = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const selector = new RegExp('<meta\\s+[^>]*' + key + '="' + name + '"[^>]*>', 'i');
  const tag = '<meta ' + key + '="' + name + '" content="' + escaped + '" />';
  return selector.test(html) ? html.replace(selector, tag) : html.replace("</head>", "    " + tag + "\n  </head>");
}
function replaceLink(html, rel, href) {
  const tag = '<link rel="' + rel + '" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" />';
  const selector = new RegExp('<link\\s+[^>]*rel="' + rel + '"[^>]*>', 'i');
  return selector.test(html) ? html.replace(selector, tag) : html.replace("</head>", "    " + tag + "\n  </head>");
}
function replaceTitle(html, title) {
  const start = html.toLowerCase().indexOf("<title>");
  const end = html.toLowerCase().indexOf("</title>");
  const safe = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return start >= 0 && end > start ? html.slice(0, start) + "<title>" + safe + "</title>" + html.slice(end + 8) : html.replace("</head>", "<title>" + safe + "</title></head>");
}
function jsonScript(value, id) {
  return '<script type="application/ld+json"' + (id ? ' id="' + id + '"' : "") + '>' + JSON.stringify(value).replace(/</g, "\\u003c") + "</script>";
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}
export default async function handler(request, response) {
  const rawPath = typeof request.query?.path === "string" ? request.query.path : "/";
  const parts = rawPath.split("/").filter(Boolean);
  const path = parts.length ? "/" + parts.join("/") : "/";
  const privateRoots = ["/admin", "/login", "/account", "/orders", "/cart", "/checkout", "/order", "/track"];
  const isPrivate = privateRoots.some(root => path === root || path.startsWith(root + "/"));
  const productSlug = parts[0] === "product" && parts[1] && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1]) ? parts[1] : null;
  const host = request.headers["x-forwarded-host"] || request.headers.host || "deqant-perfume.vercel.app";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const origin = protocol + "://" + host;
  const htmlResponse = await fetch(new URL("/index.html", origin), { headers: { Accept: "text/html" } });
  if (!htmlResponse.ok) { response.status(502).send("Storefront document is temporarily unavailable."); return; }
  let html = await htmlResponse.text();
  let title, description, image = SITE + "/products/rouge-amber.svg", structuredProduct = null, productRecord = null, productNotFound = false;
  if (productSlug) {
    title = "Perfume | DEQANT Fragrance";
    description = "Explore fragrance details, sizes and availability at DEQANT Fragrance.";
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      try {
        const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
        const endpoint = base + "/rest/v1/products?slug=eq." + encodeURIComponent(productSlug) + "&active=eq.true&select=id,slug,name,brand,description,image_url,image_urls,category,product_variants(size_ml,price,original_price,stock,active)&limit=1";
        const result = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: "Bearer " + anonKey }, signal: AbortSignal.timeout(4500) });
        if (result.ok) {
          const product = (await result.json())[0];
          productRecord = product || null;
          productNotFound = !product;
          if (product) {
            title = product.name + " Perfume | " + product.brand + " | DEQANT Bangladesh";
            description = String(product.description || "Discover " + product.name + " at DEQANT Fragrance.").trim().split(" ").filter(Boolean).join(" ").slice(0, 158);
            image = product.image_url || (product.image_urls || [])[0] || image;
            const offers = (product.product_variants || []).filter(v => v.active).map(v => ({
              "@type": "Offer", name: v.size_ml + " ml", priceCurrency: "BDT", price: v.price,
              availability: Number(v.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition", url: SITE + path,
              seller: { "@type": "Organization", name: "DEQANT Fragrance" }
            }));
            structuredProduct = {
              "@context": "https://schema.org", "@type": "Product", "@id": SITE + path + "#product",
              name: product.name, description, image: [image], sku: product.slug,
              category: product.category === "decant" ? "Perfume decant" : "Intact perfume bottle",
              brand: { "@type": "Brand", name: product.brand },
              mainEntityOfPage: { "@type": "WebPage", "@id": SITE + path },
              offers: offers.length ? { "@type": "AggregateOffer", priceCurrency: "BDT",
                lowPrice: Math.min(...offers.map(o => Number(o.price))), highPrice: Math.max(...offers.map(o => Number(o.price))),
                offerCount: offers.length, offers } : undefined
            };
          }
        }
      } catch { /* Keep fallback metadata if the catalogue API is temporarily unavailable. */ }
    }
  } else {
    [title, description] = pages[path] || pages["/"];
  }
  const canonical = SITE + path;
  html = replaceTitle(html, title);
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "name", "robots", (isPrivate || productNotFound) ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", description);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "property", "og:image", image.startsWith("http") ? image : SITE + image);
  html = replaceMeta(html, "property", "og:type", productSlug ? "product" : "website");
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", description);
  html = replaceMeta(html, "name", "twitter:image", image.startsWith("http") ? image : SITE + image);
  html = replaceLink(html, "canonical", canonical);
  if (structuredProduct) {
    const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Shop perfumes", item: SITE + "/shop" },
      { "@type": "ListItem", position: 3, name: title.split(" | ")[0], item: canonical }
    ]};
    html = html.replace("</head>", jsonScript(structuredProduct, "deqant-product-schema") + jsonScript(breadcrumb, "deqant-breadcrumb-schema") + "\n</head>");
  }
  const userAgent = String(request.headers["user-agent"] || "").toLowerCase();
  const isCrawler = /(googlebot|bingbot|duckduckbot|slurp|baiduspider|yandexbot|facebookexternalhit|twitterbot)/.test(userAgent);
  if (isCrawler && !isPrivate) {
    let crawlableContent = "";
    if (productRecord) {
      const variants = (productRecord.product_variants || []).filter(v => v.active);
      const variantList = variants.map(v => "<li>" + escapeHtml(v.size_ml) + " ml — ৳" + escapeHtml(v.price) + " — " + (Number(v.stock) > 0 ? "In stock" : "Out of stock") + "</li>").join("");
      const safeImage = String(image).startsWith("http") ? image : SITE + image;
      crawlableContent = "<main><nav aria-label=\"Breadcrumb\"><a href=\"/\">Home</a> / <a href=\"/shop\">Shop perfumes</a> / " + escapeHtml(productRecord.name) + "</nav><article><h1>" + escapeHtml(productRecord.name) + "</h1><p><strong>" + escapeHtml(productRecord.brand) + "</strong> · " + escapeHtml(productRecord.category === "decant" ? "Perfume decant" : "Intact perfume bottle") + "</p><p>" + escapeHtml(productRecord.description) + "</p><p>Fragrance family: " + escapeHtml(productRecord.family) + "</p><p>Fragrance notes: " + escapeHtml(productRecord.notes) + "</p><img src=\"" + escapeHtml(safeImage) + "\" alt=\"" + escapeHtml(productRecord.name + " perfume bottle") + "\" width=\"420\" /><h2>Available sizes and prices</h2><ul>" + variantList + "</ul><a href=\"/shop\">Explore the DEQANT fragrance collection</a></article></main>";
    } else {
      crawlableContent = "<main><h1>" + escapeHtml(title.split(" | ")[0]) + "</h1><p>" + escapeHtml(description) + "</p><nav aria-label=\"Explore DEQANT\"><a href=\"/shop\">Shop all perfumes</a> · <a href=\"/decants\">Perfume decants</a> · <a href=\"/intact\">Intact bottles</a> · <a href=\"/best-sellers\">Best sellers</a></nav></main>";
    }
    html = html.replace('<div id="root"></div>', '<div id="root">' + crawlableContent + '</div>');
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", isPrivate ? "private, no-store" : "public, max-age=0, s-maxage=300, stale-while-revalidate=1800");
  response.status(productNotFound ? 404 : 200).send(html);
}
