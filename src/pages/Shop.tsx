import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { ErrorState, LoadingState, PageShell, ProductCard } from "@/components/Storefront";
import { storeApi } from "@/providers/store";
import type { CatalogEntry } from "@/lib/supabase";

type ShopProps = { title?: string; description?: string; category?: "decant" | "intact"; bestSeller?: boolean; offer?: boolean };

export default function Shop({ title = "The fragrance library", description = "Explore decants and intact bottles. Compare notes, find your size, and choose a scent that feels entirely your own.", category, bestSeller, offer }: ShopProps) {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearchTerm(q.trim()), 220); return () => window.clearTimeout(timer); }, [q]);
  const [size, setSize] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [discounted, setDiscounted] = useState(false);
  const [sort, setSort] = useState<"featured" | "price-asc" | "price-desc" | "popular" | "new">("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (params.get("focus") === "search") setTimeout(() => searchRef.current?.focus(), 150); }, [params]);
  const query = storeApi.store.catalog.useQuery({ q: searchTerm || undefined, category, size, maxPrice, offer: offer || discounted || undefined, bestSeller, sort });
  const clear = () => { setQ(""); setSearchTerm(""); setSearchFocused(false); setSize(undefined); setMaxPrice(undefined); setDiscounted(false); setSort("featured"); };
  return <PageShell>
    <section className="shop-heading"><p>THE COLLECTION / {category === "decant" ? "DECANTS" : category === "intact" ? "INTACT BOTTLES" : "ALL FRAGRANCE"}</p><h1>{title}</h1><span>{description}</span></section>
    <section className="shop-layout">
      <button className="filter-toggle button button-outline" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal /> {filtersOpen ? "Hide filters" : "Search & filters"}</button>
      <aside className={`filters ${filtersOpen ? "filters-open" : ""}`}>
        <div className="filter-search"><label htmlFor="catalog-search">Find your fragrance</label><div className="catalog-search-control"><Search /><input ref={searchRef} id="catalog-search" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(q.trim()&&searchFocused&&query.data?.length)} aria-controls="catalog-search-suggestions" value={q} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false),160)} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if(e.key==="Escape"){setQ("");setSearchTerm("");setSearchFocused(false);e.currentTarget.blur();} }} placeholder="Try a perfume name, brand, oud, rose…" />{q && <button type="button" onClick={() => {setQ("");setSearchTerm("");setSearchFocused(true);searchRef.current?.focus();}} aria-label="Clear search" title="Clear search"><X /></button>}</div>{q.trim()&&searchFocused&&<div className="catalog-search-suggestions" id="catalog-search-suggestions" role="listbox" aria-label="Matching fragrances">{query.isLoading?<p className="catalog-suggestion-status">Searching the fragrance library…</p>:query.data?.length?<>{query.data.slice(0,6).map((entry:CatalogEntry)=><Link role="option" aria-selected="false" key={entry.product.id} to={"/product/"+entry.product.slug} className="catalog-suggestion" onClick={()=>setSearchFocused(false)}><img src={entry.product.imageUrl} alt="" loading="lazy"/><span><b>{entry.product.name}</b><small>{entry.product.brand} · {entry.product.family}</small><small>{entry.product.notes.split(" · ").slice(0,3).join(" · ")}</small></span><strong>View</strong></Link>)}<p className="catalog-suggestion-status">Showing {Math.min(query.data.length,6)} matching fragrances · press a result to view details</p></>:<p className="catalog-suggestion-status">No close match yet. Try another name, brand or fragrance note.</p>}</div>}</div>
        <div className="filter-group"><label htmlFor="size-filter">Size</label><select id="size-filter" value={size ?? ""} onChange={(e) => setSize(e.target.value ? Number(e.target.value) : undefined)}><option value="">All sizes</option>{(category === "intact" ? [60, 100, 150] : category === "decant" ? [3, 6, 10, 15, 30] : [3, 6, 10, 15, 30, 60, 100, 150]).map((value) => <option key={value} value={value}>{value}ml</option>)}</select></div>
        <div className="filter-group"><label htmlFor="price-filter">Maximum starting price</label><select id="price-filter" value={maxPrice ?? ""} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}><option value="">Any price</option><option value="1000">Up to ৳1,000</option><option value="3000">Up to ৳3,000</option><option value="7000">Up to ৳7,000</option><option value="12000">Up to ৳12,000</option></select></div>
        <label className="check-row"><input type="checkbox" checked={discounted} onChange={(e) => setDiscounted(e.target.checked)} /><span>Discounted fragrances only</span></label>
        <button className="text-link" onClick={clear}>Reset all filters</button>
      </aside>
      <div className="shop-results">
        <div className="results-toolbar"><span aria-live="polite">{query.isLoading ? "Curating…" : `${query.data?.length ?? 0} fragrances`}</span><label>Sort by <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="featured">Featured</option><option value="popular">Popularity</option><option value="new">New arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select><ChevronDown /></label></div>
        {query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={query.error.message} /> : query.data?.length ? <div className="catalog-grid">{query.data.map((entry: CatalogEntry, index: number) => <ProductCard key={entry.product.id} entry={entry} index={index} />)}</div> : <div className="empty-state"><h2>No fragrance fits that brief.</h2><p>Try another note, a different size, or reset your filters.</p><button className="button button-burgundy" onClick={clear}>Clear filters</button></div>}
      </div>
    </section>
  </PageShell>;
}
