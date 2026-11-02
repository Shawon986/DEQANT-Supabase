import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Checkout, { OrderSuccess } from "./pages/Checkout";
import Track from "./pages/Track";
import { About, Contact, PolicyPage } from "./pages/Info";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

function Experience() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 650); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const names: Record<string, string> = { "/shop": "All perfumes", "/decants": "Perfume decants", "/intact": "Intact bottles", "/best-sellers": "Best sellers", "/offers": "Special offers", "/cart": "Shopping bag", "/checkout": "Checkout", "/track": "Track your order", "/about": "Our story", "/contact": "Concierge", "/privacy": "Privacy policy", "/terms": "Terms & conditions", "/delivery-policy": "Delivery & returns", "/admin": "Owner portal", "/login": "Owner sign in" };
    document.title = `${names[location.pathname] ?? (location.pathname === "/" ? "Your scent. Your signature." : "DEQANT Fragrance")} — DEQANT`;
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
      <Route path="*" element={<NotFound />} />
    </Routes>
    <Toaster position="bottom-center" toastOptions={{ className: "deqant-toast" }} />
  </>;
}

export default function App() { return <Experience />; }
