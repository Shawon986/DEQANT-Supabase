import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowRight, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { PageShell, ProductCard, Reveal, LoadingState } from "@/components/Storefront";
import { storeApi } from "@/providers/store";

const moods = [
  { name: "Warm", terms: "amber vanilla" }, { name: "Fresh", terms: "citrus bergamot" },
  { name: "Floral", terms: "rose jasmine" }, { name: "Woody", terms: "oud sandalwood" },
  { name: "Spicy", terms: "saffron cinnamon" }, { name: "Musk", terms: "musk iris" },
];

function ScentFinder() {
  const [mood, setMood] = useState(moods[0]);
  const { data, isLoading } = storeApi.store.catalog.useQuery({ q: mood.terms.split(" ")[0], sort: "popular" });
  const match = data?.[0];
  return <section className="scent-finder" id="scent-finder">
    <div className="section-intro light"><p>AN OLFACTORY COMPASS</p><h2>What moves you<br /><em>today?</em></h2><span>Choose a mood. We’ll follow the notes.</span></div>
    <div className="orbit-wrap">
      <div className="orbit-center"><img src="/brand/emblem-ivory.png" alt="" /><span>{mood.name}</span></div>
      {moods.map((item, index) => <button key={item.name} className={`orbit-node ${mood.name === item.name ? "active" : ""}`} style={{ "--angle": `${index * 60}deg` } as CSSProperties} onClick={() => setMood(item)} aria-pressed={mood.name === item.name}>{item.name}</button>)}
    </div>
    <div className="scent-result" aria-live="polite">
      {isLoading ? <p>Finding your notes…</p> : match ? <><img src={match.product.imageUrl} alt="" /><div><p>YOUR {mood.name.toUpperCase()} MATCH</p><h3>{match.product.name}</h3><span>{match.product.notes.split(" · ").slice(0, 3).join(" · ")}</span><Link className="text-link light" to={`/product/${match.product.slug}`}>Meet your match <ArrowRight /></Link></div></> : <p>No exact match yet. Explore the complete collection.</p>}
    </div>
  </section>;
}

export default function Home() {
  const { data: settings } = storeApi.store.settings.useQuery();
  const { data: catalogue, isLoading } = storeApi.store.catalog.useQuery({ sort: "featured" });
  const featured = useMemo(() => catalogue?.filter((entry) => entry.product.featured).slice(0, 4) ?? [], [catalogue]);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const line = "EAU DE PARFUM · DHAKA · 2026";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTyped(line); return; }
    let index = 0;
    const timer = window.setInterval(() => { index += 1; setTyped(line.slice(0, index)); if (index >= line.length) window.clearInterval(timer); }, 45);
    return () => window.clearInterval(timer);
  }, []);
  return <PageShell>
    <section className="hero">
      <div className="hero-copy">
        <p className="hero-kicker">{typed}<span className="typing-caret" /></p>
        <h1>{(settings?.heroTitle ?? "YOUR SCENT. YOUR SIGNATURE.").split(". ").map((part, index) => <span key={part}>{part}{index === 0 ? "." : ""}</span>)}</h1>
        <p className="hero-description">{settings?.heroText ?? "Discover the art of fragrance. Find the scent that defines you."}</p>
        <div className="hero-actions"><Link className="button button-ivory" to="/shop">Explore collection <ArrowRight /></Link><Link className="text-link light" to="/about">Discover DEQANT <ArrowRight /></Link></div>
      </div>
      <div className="hero-visual" aria-label="Rouge Amber eau de parfum">
        <div className="hero-orbit-text">DEQANT · OLFACTORY EDITIONS · DHAKA ·</div>
        <img className="hero-bottle" src="/products/rouge-amber.svg" alt="Rouge Amber perfume bottle in burgundy light" width="900" height="1100" />
        <div className="hero-note glass"><span>THE OPENING</span><strong>Saffron / Almond</strong><small>Bright. Textural. Unexpected.</small></div>
        <div className="hero-edition">OLFACTORY<br />EDITION 03</div>
      </div>
      <a className="scroll-cue" href="#collection"><ArrowDown /><span>Scroll to discover</span></a>
    </section>

    <div className="scent-marquee" aria-hidden="true"><div>EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /> YOUR SCENT, YOUR SIGNATURE <Sparkles /> EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /></div></div>

    <section className="home-collection" id="collection">
      <Reveal><div className="section-intro"><p>THE DEQANT EDIT</p><h2>Signatures in<br /><em>the making.</em></h2><Link className="text-link" to="/shop">View the complete collection <ArrowRight /></Link></div></Reveal>
      {isLoading ? <LoadingState /> : <div className="editorial-grid">{featured.map((entry, index) => <Reveal key={entry.product.id}><ProductCard entry={entry} index={index} /></Reveal>)}</div>}
    </section>

    <ScentFinder />

    <section className="manifesto">
      <Reveal className="manifesto-image"><div className="pattern-frame"><img src="/products/ivory-santal.svg" alt="Ivory Santal bottle" loading="lazy" /><span>THE ART OF<br />WEARING LESS,<br />BUT MEANING MORE.</span></div></Reveal>
      <Reveal className="manifesto-copy"><p>THE DEQANT PHILOSOPHY</p><h2>A fragrance wardrobe,<br /><em>not a commitment.</em></h2><p>We believe finding your scent should feel like discovery—not a decision made under pressure. Our decants let you live with a fragrance on your skin, in your rhythm, before choosing the full bottle.</p><p>Every size is prepared with care, clearly labelled, and delivered with the same attention as our intact editions.</p><Link className="button button-burgundy" to="/decants">Explore decants <ArrowRight /></Link></Reveal>
    </section>

    <section className="service-notes">
      <div><PackageCheck /><h3>Thoughtfully packed</h3><p>Secure, considered packaging for every size.</p></div>
      <div><ShieldCheck /><h3>Authenticity first</h3><p>Carefully sourced fragrances, honestly presented.</p></div>
      <div><Sparkles /><h3>Cash on delivery</h3><p>Simple ordering with clear delivery charges.</p></div>
    </section>
  </PageShell>;
}
