import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";

// Route-level chunks keep the initial storefront payload leaner, especially on mobile.
const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const Product = lazy(() => import("./pages/Product"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSuccess = lazy(() => import("./pages/Checkout").then((module) => ({ default: module.OrderSuccess })));
const Track = lazy(() => import("./pages/Track"));
const About = lazy(() => import("./pages/Info").then((module) => ({ default: module.About })));
const Contact = lazy(() => import("./pages/Info").then((module) => ({ default: module.Contact })));
const PolicyPage = lazy(() => import("./pages/Info").then((module) => ({ default: module.PolicyPage })));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));

const routeMeta: Record<string, { title: string; description: string }> = {
  "/": { title: "DEQANT Fragrance | Perfume Decants & Authentic Perfumes in Bangladesh", description: "Discover considered fragrances at DEQANT. Explore perfume decants and intact bottles, compare fragrance notes, and find a signature scent with delivery across Bangladesh." },
  "/shop": { title: "Shop Perfumes & Fragrance Decants | DEQANT Bangladesh", description: "Shop the DEQANT fragrance collection. Discover perfume decants and intact bottles, explore scent families and notes, and find your next signature fragrance." },
  "/decants": { title: "Perfume Decants in Bangladesh | DEQANT Fragrance", description: "Try your next signature scent before choosing a full bottle. Explore carefully prepared perfume decants in convenient sizes from DEQANT." },
  "/intact": { title: "Authentic Intact Perfume Bottles | DEQANT Fragrance", description: "Explore intact perfume bottles at DEQANT. Discover fragrances for your collection, with clear product details and delivery across Bangladesh." },
  "/best-sellers": { title: "Best-Selling Perfumes | DEQANT Fragrance", description: "Discover popular fragrances chosen by DEQANT customers. Browse best-selling perfume decants and intact bottles by scent and style." },
  "/offers": { title: "Perfume Offers & Special Prices | DEQANT", description: "Explore current DEQANT fragrance offers on selected perfume decants and intact bottles. Check product sizes, availability and prices online." },
  "/about": { title: "Our Story | DEQANT Fragrance", description: "Discover the DEQANT approach to fragrance: thoughtful discovery, carefully prepared decants, and a considered perfume wardrobe." },
  "/contact": { title: "Contact & Fragrance Concierge | DEQANT", description: "Contact DEQANT for perfume enquiries, product guidance, order support and delivery information." },
  "/privacy": { title: "Privacy Policy | DEQANT Fragrance", description: "Read how DEQANT handles customer information and protects privacy when you browse or shop online." },
  "/terms": { title: "Terms & Conditions | DEQANT Fragrance", description: "Review the terms and conditions for shopping, orders and services at DEQANT Fragrance." },
  "/delivery-policy": { title: "Delivery & Returns Policy | DEQANT", description: "Find DEQANT delivery information, shipping charges, order handling and return policy details." },
};

function setMeta(selector: string, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    const [key, content] = selector.match(/\[(name|property)="([^"]+)"\]/)?.slice(1) ?? [];
    if (key && content) element.setAttribute(key, content);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function Experience() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 650); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const isProduct = path.startsWith("/product/");
    const isPrivate = /^\/(admin|login|account|orders|cart|checkout|order|track)(\/|$)/.test(path);
    const fallback = { title: "DEQANT Fragrance | Perfume Decants & Authentic Perfumes in Bangladesh", description: "Discover perfume decants and intact bottles at DEQANT Fragrance. Explore scent notes and find your signature perfume, with delivery across Bangladesh." };
    const meta = routeMeta[path] ?? fallback;
    if (!isProduct) document.title = meta.title;
    setMeta('meta[name="description"]', "content", meta.description);
    setMeta('meta[property="og:title"]', "content", meta.title);
    setMeta('meta[property="og:description"]', "content", meta.description);
    setMeta('meta[property="og:type"]', "content", isProduct ? "product" : "website");
    setMeta('meta[name="twitter:title"]', "content", meta.title);
    setMeta('meta[name="twitter:description"]', "content", meta.description);
    setMeta('meta[name="robots"]', "content", isPrivate ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `https://deqant-perfume.vercel.app${path === "/" ? "/" : path}`;
    setMeta('meta[property="og:url"]', "content", canonical.href);
  }, [location.pathname]);
  useEffect(() => {
    if (!window.matchMedia("(pointer:fine)").matches) return;
    const cursor = document.querySelector<HTMLDivElement>(".custom-cursor");
    if (!cursor) return;
    const move = (event: PointerEvent) => { cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`; cursor.classList.add("visible"); };
    const over = (event: PointerEvent) => cursor.classList.toggle("over-link", Boolean((event.target as Element).closest("a,button,input,select,textarea")));
    window.addEventListener("pointermove", move); window.addEventListener("pointerover", over);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerover", over); };
  }, []);
  return <>
    {loading && <div className="brand-loader" aria-label="Loading DEQANT"><img src="/brand/emblem-ivory.png" alt="DEQANT" /><span>FRAGRANCE</span><i /></div>}
    <div className="custom-cursor" aria-hidden="true" />
    <Suspense fallback={<div className="brand-loader" role="status" aria-label="Loading page"><img src="/brand/emblem-ivory.png" alt="" /><span>FRAGRANCE</span><i /></div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/decants" element={<Shop title="Perfume, by the millilitre" description="Discover the fragrance before committing to the bottle. Hand-prepared decants in five considered sizes." category="decant" />} />
      <Route path="/intact" element={<Shop title="The intact editions" description="Complete bottles for scents you already know by heart. Sealed, substantial, and ready for your dressing table." category="intact" />} />
      <Route path="/best-sellers" element={<Shop title="Most wanted, most worn" description="The fragrances our clients return to—chosen again, gifted often, and remembered on skin." bestSeller />} />
      <Route path="/offers" element={<Shop title="The private offer" description="A considered selection of decants and intact bottles, available at a special price for a limited time." offer />} />
      <Route path="/product/:slug" element={<Product />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order/:orderNumber" element={<OrderSuccess />} />
      <Route path="/track" element={<Track />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<PolicyPage type="privacy" />} />
      <Route path="/terms" element={<PolicyPage type="terms" />} />
      <Route path="/delivery-policy" element={<PolicyPage type="delivery" />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/account" element={<Account />} />
      <Route path="/orders" element={<Account />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    <Toaster position="bottom-center" toastOptions={{ className: "deqant-toast" }} />
  </>;
}

export default function App() { return <Experience />; }
