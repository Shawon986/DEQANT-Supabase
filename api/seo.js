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
  const selector = new RegExp('<meta\\s+[^>]*' + key + '=["\\']' + name + '["\\'][^>]*>', "i");
  const tag = '<meta ' + key + '="' + name + '" content="' + escaped + '" />';
  return selector.test(html) ? html.replace(selector, tag) : html.replace("</head>", "    " + tag + "\\n  </head>");
}
function replaceLink(html, rel, href) {
  const tag = '<link rel="' + rel + '" href="' + href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" />';
  const selector = new RegExp('<link\\s+[^>]*rel=["\\']' + rel + '["\\'][^>]*>', "i");
  return selector.test(html) ? html.replace(selector, tag) : html.replace("</head>", "    " + tag + "\\n  </head>");
}
function jsonScript(value) {
  return '<script type="application/ld+json">' + JSON.stringify(value).replace(/</g, "\\u003c") + "</script>";
}

export default async function handler(request, response) {
  const rawPath = typeof request.query?.path === "string" ? request.query.path : "/";
  const path = ("/" + rawPath.replace(/^\\/+/, "")).replace(/\\/+$/, "") || "/";
  const isPrivate = /^\\/(admin|login|account|orders|cart|checkout|order|track)(\\/|$)/.test(path);
  const productSlug = path.match(/^\\/product\\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)?.[1];
  const host = request.headers["x-forwarded-host"] || request.headers.host || "deqant-perfume.vercel.app";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const origin = protocol + "://" + host;
  const htmlResponse = await fetch(new URL("/index.html", origin), { headers: { "Accept": "text/html" } });
  if (!htmlResponse.ok) {
    response.status(502).send("Storefront document is temporarily unavailable.");
    return;
  }

  let html = await htmlResponse.text();
  let title, description, image = SITE + "/products/rouge-amber.svg";
  let structuredProduct = null;
  if (productSlug) {
    title = "Perfume | DEQANT Fragrance";
    description = "Explore fragrance details, sizes and availability at DEQANT Fragrance.";
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      try {
        const endpoint = supabaseUrl.replace(/\\/$/, "") + "/rest/v1/products?slug=eq." + encodeURIComponent(productSlug) + "&active=eq.true&select=id,slug,name,brand,description,image_url,image_urls,category,product_variants(size_ml,price,original_price,stock,active)&limit=1";
        const result = await fetch(endpoint, {
          headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
          signal: AbortSignal.timeout(4500)
        });
        if (result.ok) {
          const products = await result.json();
          const product = products[0];
          if (product) {
            title = product.name + " Perfume | " + product.brand + " | DEQANT Bangladesh";
            description = String(product.description || "Discover " + product.name + " at DEQANT Fragrance.").replace(/\\s+/g, " ").slice(0, 158);
            image = product.image_url || product.image_urls?.[0] || image;
            const offers = (product.product_variants || []).filter(v => v.active).map(v => ({
              "@type": "Offer", name: v.size_ml + " ml", priceCurrency: "BDT",
              price: v.price, availability: Number(v.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition", url: SITE + path,
              seller: { "@type": "Organization", name: "DEQANT Fragrance" }
            }));
            structuredProduct = {
              "@context": "https://schema.org", "@type": "Product", "@id": SITE + path + "#product",
              name: product.name, description: description, image: [image], sku: product.slug,
              category: product.category === "decant" ? "Perfume decant" : "Intact perfume bottle",
              brand: { "@type": "Brand", name: product.brand },
              mainEntityOfPage: { "@type": "WebPage", "@id": SITE + path },
              offers: offers.length ? { "@type": "AggregateOffer", priceCurrency: "BDT",
                lowPrice: Math.min(...offers.map(o => Number(o.price))), highPrice: Math.max(...offers.map(o => Number(o.price))),
                offerCount: offers.length, offers } : undefined
            };
          }
        }
      } catch {
        // Keep useful fallback metadata if the catalogue endpoint is briefly unavailable.
      }
    }
  } else {
    [title, description] = pages[path] || pages["/"];
  }

  const canonical = SITE + (path === "/" ? "/" : path);
  html = html.replace(/<title>[^<]*<\\/title>/i, "<title>" + title.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</title>");
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "name", "robots", isPrivate ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
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
    const breadcrumb = {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Shop perfumes", item: SITE + "/shop" },
        { "@type": "ListItem", position: 3, name: title.split(" | ")[0], item: canonical }
      ]
    };
    html = html.replace("</head>", jsonScript(structuredProduct) + jsonScript(breadcrumb) + "\\n</head>");
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", isPrivate ? "private, no-store" : "public, max-age=0, s-maxage=300, stale-while-revalidate=1800");
  response.status(200).send(html);
}
