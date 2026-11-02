import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { ErrorState, LoadingState, PageShell, ProductCard } from "@/components/Storefront";
import { storeApi } from "@/providers/store";

type ShopProps = { title?: string; description?: string; category?: "decant" | "intact"; bestSeller?: boolean; offer?: boolean };

export default function Shop({ title = "The fragrance library", description = "Explore decants and intact bottles. Compare notes, find your size, and choose a scent that feels entirely your own.", category, bestSeller, offer }: ShopProps) {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [size, setSize] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [discounted, setDiscounted] = useState(false);
  const [sort, setSort] = useState<"featured" | "price-asc" | "price-desc" | "popular" | "new">("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (params.get("focus") === "search") setTimeout(() => searchRef.current?.focus(), 150); }, [params]);
  const query = storeApi.store.catalog.useQuery({ q: q || undefined, category, size, maxPrice, offer: offer || discounted || undefined, bestSeller, sort });
  const clear = () => { setQ(""); setSize(undefined); setMaxPrice(undefined); setDiscounted(false); setSort("featured"); };
  return <PageShell>
    <section className="shop-heading"><p>THE COLLECTION / {category === "decant" ? "DECANTS" : category === "intact" ? "INTACT BOTTLES" : "ALL FRAGRANCE"}</p><h1>{title}</h1><span>{description}</span></section>
    <section className="shop-layout">
      <button className="filter-toggle button button-outline" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal /> {filtersOpen ? "Hide filters" : "Search & filters"}</button>
      <aside className={`filters ${filtersOpen ? "filters-open" : ""}`}>
        <div className="filter-search"><label htmlFor="catalog-search">Search by name, brand or note</label><div><Search /><input ref={searchRef} id="catalog-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oud, rose, DEQANT…" />{q && <button onClick={() => setQ("")} aria-label="Clear search"><X /></button>}</div></div>
        <div className="filter-group"><label htmlFor="size-filter">Size</label><select id="size-filter" value={size ?? ""} onChange={(e) => setSize(e.target.value ? Number(e.target.value) : undefined)}><option value="">All sizes</option>{(category === "intact" ? [60, 100, 150] : category === "decant" ? [3, 6, 10, 15, 30] : [3, 6, 10, 15, 30, 60, 100, 150]).map((value) => <option key={value} value={value}>{value}ml</option>)}</select></div>
        <div className="filter-group"><label htmlFor="price-filter">Maximum starting price</label><select id="price-filter" value={maxPrice ?? ""} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}><option value="">Any price</option><option value="1000">Up to ৳1,000</option><option value="3000">Up to ৳3,000</option><option value="7000">Up to ৳7,000</option><option value="12000">Up to ৳12,000</option></select></div>
        <label className="check-row"><input type="checkbox" checked={discounted} onChange={(e) => setDiscounted(e.target.checked)} /><span>Discounted fragrances only</span></label>
        <button className="text-link" onClick={clear}>Reset all filters</button>
      </aside>
      <div className="shop-results">
        <div className="results-toolbar"><span aria-live="polite">{query.isLoading ? "Curating…" : `${query.data?.length ?? 0} fragrances`}</span><label>Sort by <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="featured">Featured</option><option value="popular">Popularity</option><option value="new">New arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select><ChevronDown /></label></div>
        {query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={query.error.message} /> : query.data?.length ? <div className="catalog-grid">{query.data.map((entry, index) => <ProductCard key={entry.product.id} entry={entry} index={index} />)}</div> : <div className="empty-state"><h2>No fragrance fits that brief.</h2><p>Try another note, a different size, or reset your filters.</p><button className="button button-burgundy" onClick={clear}>Clear filters</button></div>}
      </div>
    </section>
  </PageShell>;
}
