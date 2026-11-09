import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { ErrorState, LoadingState, money, PageShell, ProductCard } from "@/components/Storefront";
import { storeApi } from "@/providers/store";
import { useCart } from "@/providers/cart";
import type { CatalogEntry } from "@/lib/supabase";

export default function Product() {
  const { slug = "" } = useParams();
  const query = storeApi.store.product.useQuery({ slug });
  const relatedQuery = storeApi.store.catalog.useQuery({ sort: "popular" });
  const { add, isMutating } = useCart();
  const [variantId, setVariantId] = useState<number>();
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    if (!query.data) return;
    const { product } = query.data;
    const title = `${product.name} Perfume | ${product.brand} | DEQANT Fragrance`;
    const description = `${product.name} by ${product.brand}. ${product.description} Explore fragrance notes, available sizes and prices at DEQANT, with delivery across Bangladesh.`.slice(0, 300);
    document.title = title;
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    descriptionTag?.setAttribute("content", description);
    const canonicalUrl = `https://deqant-perfume.vercel.app/product/${encodeURIComponent(product.slug)}`;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = canonicalUrl;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
    document.querySelector('meta[property="og:type"]')?.setAttribute("content", "product");
    const socialImage = new URL(product.imageUrl, window.location.origin).href;
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", socialImage);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", socialImage);
    document.querySelector('meta[name="robots"]')?.setAttribute("content", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    const structuredData = document.createElement("script");
    document.getElementById("deqant-product-schema")?.remove();
    document.getElementById("deqant-breadcrumb-schema")?.remove();
    structuredData.id = "deqant-product-schema";
    structuredData.type = "application/ld+json";
    structuredData.dataset.deqantProduct = "true";
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          "@id": `${canonicalUrl}#product`,
          name: product.name,
          description: product.description,
          image: [new URL(product.imageUrl, window.location.origin).href],
          sku: product.slug,
          category: product.category === "decant" ? "Perfume decant" : "Intact perfume bottle",
          brand: { "@type": "Brand", name: product.brand },
          mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
          additionalProperty: [
            
            { "@type": "PropertyValue", name: "Fragrance notes", value: product.notes }
          ],
          offers: {
            "@type": "AggregateOffer",
            url: canonicalUrl,
            priceCurrency: "BDT",
            lowPrice: Math.min(...query.data.variants.map((variant: {price:number}) => variant.price)),
            highPrice: Math.max(...query.data.variants.map((variant: {price:number}) => variant.price)),
            offerCount: query.data.variants.length,
            offers: query.data.variants.map((variant: {price:number;stock:number;sizeMl:number}) => ({
              "@type": "Offer",
              name: `${variant.sizeMl} ml`,
              priceCurrency: "BDT",
              price: variant.price,
              itemCondition: "https://schema.org/NewCondition",
              availability: variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: canonicalUrl,
              seller: { "@type": "Organization", name: "DEQANT Fragrance" }
            }))
          }
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://deqant-perfume.vercel.app/" },
            { "@type": "ListItem", position: 2, name: "Shop perfumes", item: "https://deqant-perfume.vercel.app/shop" },
            { "@type": "ListItem", position: 3, name: product.name, item: canonicalUrl }
          ]
        }
      ]
    });
    document.head.appendChild(structuredData);
    return () => structuredData.remove();
  }, [query.data]);
  if (query.isLoading) return <PageShell><LoadingState /></PageShell>;
  if (query.error || !query.data) return <PageShell><ErrorState message={query.error?.message ?? "Fragrance not found."} /></PageShell>;
  const { product, variants } = query.data;
  const selectedVariantId = variantId ?? (variants.find((v: { id:number; stock:number; sizeMl:number }) => v.sizeMl === 3 && v.stock > 0)?.id ?? variants.find((v: { id: number; stock: number }) => v.stock > 0)?.id);
  const selected = variants.find((v: { id: number; price: number; originalPrice: number; stock: number; sizeMl: number }) => v.id === selectedVariantId) ?? variants[0];
  const discount = selected.originalPrice > selected.price ? Math.round((1 - selected.price / selected.originalPrice) * 100) : 0;
  const related = relatedQuery.data?.filter((entry: CatalogEntry) => entry.product.id !== product.id && entry.product.category === product.category).slice(0, 2) ?? [];
  return <PageShell>
    <div className="product-breadcrumb"><Link to="/shop"><ArrowLeft /> Collection</Link><span>/</span><span>{product.name}</span></div>
    <section className="product-detail">
      <div className="product-gallery"><div className="product-main-image"><img src={product.imageUrl} alt={`${product.name} by ${product.brand}`} width="900" height="1100" /><span>{product.category === "decant" ? "DEQANT DECANT" : "INTACT EDITION"}</span></div>{query.data.images?.length>1&&<div className="product-extra-images">{query.data.images.slice(1).map((image:any)=><img key={image.id} src={image.url} alt={image.alt||product.name} loading="lazy"/>)}</div>}</div>
      <div className="product-purchase">
        <p className="eyebrow">{product.brand} / DEQANT FRAGRANCE</p><h1>{product.name}</h1>
        <div className="detail-price"><strong>{money(selected.price)}</strong>{selected.originalPrice > selected.price && <><del>{money(selected.originalPrice)}</del><span>Save {discount}%</span></>}</div>
        <p className="detail-description">{product.description}</p>
        <fieldset className="size-selector"><legend>Select your size <span>{product.category === "decant" ? "Hand-prepared decant" : "Sealed intact bottle"}</span></legend><div>{variants.map((variant: {id:number;price:number;originalPrice:number;stock:number;sizeMl:number}) => <button key={variant.id} className={selected.id === variant.id ? "selected" : ""} onClick={() => { setVariantId(variant.id); setQuantity(1); }} disabled={variant.stock === 0} aria-pressed={selected.id === variant.id}><strong>{variant.sizeMl}ml</strong>{variant.sizeMl === 3 && <small className="size-pick-badge try-first">TRY FIRST</small>}{variant.sizeMl === 10 && <small className="size-pick-badge best-value">BEST VALUE</small>}<span>{variant.stock === 0 ? "Sold out" : money(variant.price)}</span></button>)}</div></fieldset>
        <div className="stock-note">{selected.stock > 0 ? <><span className="stock-dot" /> {selected.stock < 8 ? `Only ${selected.stock} left in this size` : "In stock, ready to prepare"}</> : "Currently unavailable"}</div>
        <div className="add-row"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(Math.min(10, selected.stock), quantity + 1))} disabled={quantity >= Math.min(10, selected.stock)} aria-label="Increase quantity"><Plus /></button></div><button className="button button-burgundy add-button" onClick={() => add(selected.id, quantity)} disabled={isMutating || selected.stock === 0}><ShoppingBag />{isMutating ? "Adding…" : "Add to cart"}</button></div>
        <p className="cod-note">Cash on delivery · Delivery calculated clearly at checkout</p>
        <div className="product-accordions"><details open><summary>Fragrance notes <Plus /></summary><p>{product.notes}</p></details><details><summary>Delivery & returns <Plus /></summary><p>Delivery is ৳120–৳170 depending on your selected zone. Inspect your order at delivery. See our return policy for eligibility.</p></details><details><summary>Decant preparation <Plus /></summary><p>Decants are transferred into clearly labelled, travel-friendly atomisers with care. The original fragrance name and size are always shown.</p></details></div>
      </div>
    </section>
    <section className="notes-story"><p>ON SKIN</p><h2>A composition in<br /><em>three movements.</em></h2><div>{product.notes.split(" · ").map((note: string, index: number) => <div key={note}><span>0{index + 1}</span><h3>{note}</h3><p>{index === 0 ? "The first impression" : index < 3 ? "The unfolding heart" : "The lasting trail"}</p></div>)}</div></section>
    {related.length > 0 && <section className="related-products"><div className="section-intro"><p>IN THE SAME FAMILY</p><h2>You may also<br /><em>be drawn to.</em></h2></div><div className="catalog-grid">{related.map((entry: CatalogEntry, index: number) => <ProductCard key={entry.product.id} entry={entry} index={index} />)}</div><Link className="text-link" to="/shop">Explore all fragrance <ArrowRight /></Link></section>}
  </PageShell>;
}
