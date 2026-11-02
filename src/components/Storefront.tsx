import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useCart } from "@/providers/cart";
import { storeApi } from "@/providers/store";

export const money = (value: number) => `৳${value.toLocaleString("en-BD")}`;

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.classList.add("is-visible"); observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

export function Logo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return <img className={`brand-logo ${className}`} src={dark ? "/brand/logo-burgundy.png" : "/brand/logo-ivory.png"} alt="DEQANT Fragrance" width="190" height="59" />;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { cart } = useCart();
  const location = useLocation();
  const { data: settings } = storeApi.store.settings.useQuery();
  const { data: profile } = storeApi.auth.me.useQuery();
  const accountPath = profile?.role === "admin" ? "/admin" : profile ? "/account" : "/login";
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <>
    <div className="announcement">{settings?.announcement ?? "DISCOVER YOUR SIGNATURE SCENT"}</div>
    <header className="site-header">
      <Link to="/" aria-label="DEQANT home"><Logo /></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <NavLink to="/shop">All perfumes</NavLink><NavLink to="/decants">Decants</NavLink>
        <NavLink to="/intact">Intact bottles</NavLink><NavLink to="/about">Our story</NavLink>
      </nav>
      <div className="header-actions">
        <Link className="icon-button desktop-only" to="/shop?focus=search" aria-label="Search perfumes"><Search size={19} /></Link>
        <Link className={`icon-button account-trigger${profile ? " account-trigger-signed-in" : ""}`} to={accountPath} aria-label={profile ? `Account: ${profile.full_name || profile.email || "signed in"}` : "Sign in or create an account"} title={profile?.full_name || profile?.email || "Your account"}>{profile?.full_name ? <span className="account-trigger-name">{profile.full_name.split(" ")[0]}</span> : null}<UserRound size={19}/></Link>
        <Link className="icon-button cart-link" to="/cart" aria-label={`Shopping bag with ${cart?.count ?? 0} items`}><ShoppingBag size={20} /><span>{cart?.count ?? 0}</span></Link>
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu size={22} /></button>
      </div>
    </header>
    {open && <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button className="icon-button menu-close" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
      <Logo />
      <nav>
        {[["/shop", "All perfumes"], ["/decants", "Decants"], ["/intact", "Intact bottles"], ["/best-sellers", "Best sellers"], ["/offers", "Special offers"], ["/track", "Track an order"], ["/about", "Our story"], ["/contact", "Contact"], [profile ? accountPath : "/login", profile ? "Your account" : "Sign in"]].map(([to, label], index) => <NavLink key={to} to={to}><span>0{index + 1}</span>{label}<ArrowRight /></NavLink>)}
      </nav>
      <p>Fragrance, chosen with intention.<br />Delivered across Bangladesh.</p>
    </div>}
  </>;
}

export function Footer() {
  const { data: settings } = storeApi.store.settings.useQuery();
  return <footer className="site-footer">
    <div className="footer-main">
      <div><Logo /><p>{settings?.footerText ?? "Independent fragrance, thoughtfully decanted and delivered across Bangladesh."}</p></div>
      <div><h3>Collections</h3><Link to="/decants">Perfume decants</Link><Link to="/intact">Intact bottles</Link><Link to="/best-sellers">Best sellers</Link><Link to="/offers">Special offers</Link></div>
      <div><h3>Client care</h3><Link to="/track">Track your order</Link><Link to="/delivery-policy">Delivery & returns</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
      <div><h3>Concierge</h3><a href={`mailto:${settings?.contactEmail ?? "concierge@deqant.com"}`}>{settings?.contactEmail ?? "concierge@deqant.com"}</a><a href={`tel:${settings?.contactPhone ?? "+8801700000000"}`}>{settings?.contactPhone ?? "+880 1700 000000"}</a><Link to="/contact">Send an enquiry</Link></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} DEQANT FRAGRANCE</span><span>DHAKA · BANGLADESH</span><Link to="/login">Your account / Owner portal</Link></div>
  </footer>;
}

export function PageShell({ children }: { children: ReactNode }) {
  return <><Header /><main>{children}</main><Footer /></>;
}

export function LoadingState({ label = "Composing your collection…" }: { label?: string }) {
  return <div className="loading-state" role="status"><img src="/brand/emblem-burgundy.png" alt="" /><p>{label}</p></div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="empty-state"><h2>A momentary pause.</h2><p>{message}</p><button className="text-link" onClick={() => window.location.reload()}>Try again <ArrowRight /></button></div>;
}

type ProductEntry = {
  product: { id: number; slug: string; name: string; brand: string; category: string; family: string; imageUrl: string; bestSeller: boolean; specialOffer: boolean; newArrival: boolean };
  variants: Array<{ id: number; sizeMl: number; price: number; originalPrice: number; stock: number }>;
};

export function ProductCard({ entry, index = 0 }: { entry: ProductEntry; index?: number }) {
  const { product, variants } = entry;
  const price = Math.min(...variants.map((variant) => variant.price));
  const original = variants.find((variant) => variant.price === price)?.originalPrice ?? price;
  return <article className={`product-card product-card-${index % 4}`}>
    <Link to={`/product/${product.slug}`} className="product-image-wrap" aria-label={`View ${product.name}`}>
      <img src={product.imageUrl} alt={`${product.name} by ${product.brand}`} loading="lazy" width="900" height="1100" />
      <div className="product-badges">{product.bestSeller && <span>Best seller</span>}{original > price && <span>Private offer</span>}</div>
      <span className="product-view">Discover <ArrowRight size={16} /></span>
    </Link>
    <div className="product-meta"><div><p>{product.brand} · {product.category === "decant" ? "Decant" : "Intact bottle"}</p><Link to={`/product/${product.slug}`}><h3>{product.name}</h3></Link><span>{product.family}</span></div><div className="product-price"><strong>{money(price)}</strong>{original > price && <del>{money(original)}</del>}<small>from {Math.min(...variants.map((v) => v.sizeMl))}ml</small></div></div>
  </article>;
}
