import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowRight, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { PageShell, ProductCard, Reveal, LoadingState } from "@/components/Storefront";
import { storeApi } from "@/providers/store";
import type { CatalogEntry } from "@/lib/supabase";

const moods = [
  { name: "Warm", terms: "amber vanilla", description: "Soft amber, creamy vanilla and a golden, lingering warmth." },
  { name: "Fresh", terms: "citrus bergamot", description: "Bright citrus, cool bergamot and the feeling of clean air." },
  { name: "Floral", terms: "rose jasmine", description: "Velvety rose, luminous jasmine and a graceful floral trail." },
  { name: "Woody", terms: "oud sandalwood", description: "Polished woods, smooth sandalwood and a quietly confident depth." },
  { name: "Spicy", terms: "saffron cinnamon", description: "A little heat, aromatic spice and an unforgettable edge." },
  { name: "Musk", terms: "musk iris", description: "Airy musk, soft iris and an intimate skin-like finish." },
];

function ScrollBottleExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let frame = 0;
    let isVisible = false;

    const update = () => {
      if (!isVisible || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!isVisible) return;

        const rect = section.getBoundingClientRect();
        // The bottle stage pins for the section's full scroll runway. Progress
        // starts when the section reaches the top of the viewport and reaches
        // 100% exactly as the section's bottom reaches the viewport bottom.
        // The same value is used in both directions, so upward scrolling fully
        // reassembles the bottle without direction-change jumps.
        const runway = Math.max(1, section.offsetHeight - window.innerHeight);
        const rawProgress = Math.max(0, Math.min(1, -rect.top / runway));
        // Smoothstep eases both ends while remaining perfectly reversible.
        const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
        const isMobile = window.matchMedia("(max-width: 760px)").matches;
        // Restore the original, clearly visible separation distances. The
        // longer section runway below makes this movement unfold gradually.
        const distance = isMobile
          ? { cap: 150, atomizer: 112, collar: 66, glass: 38, juice: 46, label: 54 }
          : { cap: 220, atomizer: 158, collar: 92, glass: 52, juice: 64, label: 78 };

        section.style.setProperty("--cap-y", `${-distance.cap * progress}px`);
        section.style.setProperty("--cap-x", `${-10 * progress}px`);
        section.style.setProperty("--cap-rotate", `${-12 * progress}deg`);
        section.style.setProperty("--atomizer-y", `${-distance.atomizer * progress}px`);
        section.style.setProperty("--atomizer-x", `${14 * progress}px`);
        section.style.setProperty("--atomizer-rotate", `${8 * progress}deg`);
        section.style.setProperty("--collar-y", `${-distance.collar * progress}px`);
        section.style.setProperty("--collar-x", `${-9 * progress}px`);
        section.style.setProperty("--collar-rotate", `${-8 * progress}deg`);
        section.style.setProperty("--glass-y", `${distance.glass * progress}px`);
        section.style.setProperty("--glass-scale", String(1 - progress * 0.018));
        section.style.setProperty("--juice-y", `${distance.juice * progress}px`);
        section.style.setProperty("--label-y", `${distance.label * progress}px`);
        section.style.setProperty("--halo-scale", String(1 + progress * 0.16));
        section.style.setProperty("--explode-progress", progress.toFixed(3));
      });
    };

    const visibilityObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          isVisible = entry.isIntersecting;
          section.classList.toggle("is-active", isVisible);
          if (isVisible) update();
          else {
            window.cancelAnimationFrame(frame);
            frame = 0;
          }
        }, { rootMargin: "100px 0px" })
      : null;

    if (visibilityObserver) visibilityObserver.observe(section);
    else isVisible = true;

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(frame);
      visibilityObserver?.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <section className="bottle-scroll-story" ref={sectionRef} aria-label="Interactive perfume bottle story">
    <div className="bottle-scroll-sticky">
      <div className="bottle-story-copy">
        <p className="eyebrow">ENGINEERED TO BE REMEMBERED</p>
        <h2>Beauty in<br/><em>every layer.</em></h2>
        <p className="bottle-story-description">A fragrance is more than a bottle. Discover the details that come together to hold a signature scent.</p>
        <div className="bottle-scroll-instruction"><span className="scroll-pulse" /><span>SCROLL TO EXPLORE</span><small>Scroll down to separate · Scroll up to restore</small></div>
        <div className="bottle-progress-track"><span /></div>
      </div>
      <div className="bottle-exploded-stage">
        <div className="bottle-stage-orbit orbit-one" /><div className="bottle-stage-orbit orbit-two" />
        <div className="bottle-stage-caption"><span>DEQANT / OBJECT 001</span><span>EAU DE PARFUM</span></div>
        <svg className="exploded-perfume" viewBox="0 0 420 620" role="img" aria-label="A perfume bottle separating into its cap, atomizer, collar, glass body, fragrance and label">
          <defs>
            <linearGradient id="deq-cap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e8d4bd"/><stop offset=".42" stopColor="#9e796d"/><stop offset="1" stopColor="#39212a"/></linearGradient>
            <linearGradient id="deq-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7e8d5" stopOpacity=".78"/><stop offset=".22" stopColor="#d6b49d" stopOpacity=".18"/><stop offset=".72" stopColor="#7c354b" stopOpacity=".36"/><stop offset="1" stopColor="#f3d9c3" stopOpacity=".68"/></linearGradient>
            <linearGradient id="deq-liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8a16d" stopOpacity=".68"/><stop offset="1" stopColor="#6c263b" stopOpacity=".94"/></linearGradient>
            <linearGradient id="deq-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5d3540"/><stop offset=".35" stopColor="#e7c9a7"/><stop offset=".62" stopColor="#a47b70"/><stop offset="1" stopColor="#3d202b"/></linearGradient>
            <filter id="deq-bottle-shadow" x="-60%" y="-40%" width="220%" height="200%"><feGaussianBlur stdDeviation="13"/></filter>
            <clipPath id="deq-bottle-clip"><path d="M145 250 Q145 222 172 210 L180 190 L240 190 L248 210 Q275 222 275 250 L290 282 L290 495 Q290 520 265 520 L155 520 Q130 520 130 495 L130 282 Z"/></clipPath>
          </defs>
          <ellipse cx="210" cy="548" rx="110" ry="18" fill="#000" opacity=".35" filter="url(#deq-bottle-shadow)"/>
          <g className="bottle-part bottle-atomizer"><rect x="196" y="112" width="28" height="62" rx="5" fill="url(#deq-metal)"/><rect x="201" y="96" width="18" height="20" rx="4" fill="#d9c1a7"/><path d="M210 97 V80 H247" fill="none" stroke="#e7d4bf" strokeWidth="5" strokeLinecap="round"/><path d="M210 174 V430 Q210 438 216 438" fill="none" stroke="#d7b38d" strokeOpacity=".82" strokeWidth="3"/><path d="M210 177 V426" fill="none" stroke="#fff4df" strokeOpacity=".35" strokeWidth="1"/><circle cx="249" cy="80" r="4" fill="#e7d4bf"/><circle cx="249" cy="80" r="7" fill="none" stroke="#f4d5b1" strokeOpacity=".5" strokeWidth="1"/></g><g className="bottle-mist" aria-hidden="true"><path d="M253 78 Q278 70 295 54 M254 82 Q282 84 306 77 M253 86 Q279 99 294 111" fill="none" stroke="#f6d8b5" strokeWidth="1.6" strokeLinecap="round"/><circle cx="273" cy="64" r="3" fill="#ffe4c5"/><circle cx="289" cy="82" r="2.4" fill="#fff0d9"/><circle cx="277" cy="99" r="2" fill="#f4cda6"/><circle cx="307" cy="57" r="1.8" fill="#fff0d9"/><circle cx="316" cy="91" r="1.5" fill="#ffe4c5"/><circle cx="298" cy="116" r="2.5" fill="#e8b98d"/><circle cx="324" cy="73" r="1.4" fill="#fff0d9"/><circle cx="263" cy="48" r="1.5" fill="#f4cda6"/></g>
          <g className="bottle-part bottle-cap"><rect x="165" y="25" width="90" height="72" rx="15" fill="url(#deq-cap)" stroke="#f1ddc8" strokeOpacity=".55"/><path d="M180 38 V83" stroke="#fff" strokeOpacity=".32" strokeWidth="3" strokeLinecap="round"/><path d="M242 40 V80" stroke="#180d12" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round"/></g>
          <g className="bottle-part bottle-collar"><rect x="174" y="177" width="72" height="24" rx="6" fill="url(#deq-metal)" stroke="#ead2b9" strokeOpacity=".6"/><path d="M181 184 H239" stroke="#fff" strokeOpacity=".35" strokeWidth="2"/></g>
          <g className="bottle-part bottle-glass">
            <path d="M145 250 Q145 222 172 210 L180 190 L240 190 L248 210 Q275 222 275 250 L290 282 L290 495 Q290 520 265 520 L155 520 Q130 520 130 495 L130 282 Z" fill="url(#deq-glass)" stroke="#f2dfcb" strokeWidth="3"/>
            <path d="M145 268 Q145 242 170 230 L177 214" fill="none" stroke="#fff" strokeOpacity=".46" strokeWidth="6" strokeLinecap="round"/>
            <path d="M274 286 V482" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="4" strokeLinecap="round"/>
            <path d="M135 495 Q210 508 285 495" fill="none" stroke="#f4dcc5" strokeOpacity=".38" strokeWidth="3"/>
          </g>
          <g className="bottle-part bottle-juice" clipPath="url(#deq-bottle-clip)"><path d="M132 345 Q210 333 288 345 V525 H132 Z" fill="url(#deq-liquid)"/><path d="M136 348 Q210 336 284 348" fill="none" stroke="#f8d6a6" strokeOpacity=".58" strokeWidth="3"/></g>
          <g className="bottle-part bottle-label"><rect x="157" y="365" width="106" height="92" rx="3" fill="#3c1425" fillOpacity=".91" stroke="#d8b994" strokeWidth="1.5"/><path d="M168 377 H252" stroke="#d8b994" strokeOpacity=".7"/><text x="210" y="405" textAnchor="middle" fill="#f4e5d2" fontSize="17" letterSpacing="3" fontFamily="Georgia,serif">DEQANT</text><text x="210" y="425" textAnchor="middle" fill="#d8b994" fontSize="7" letterSpacing="2">FRAGRANCE</text><text x="210" y="442" textAnchor="middle" fill="#d8b994" fontSize="6" letterSpacing="1.5">EAU DE PARFUM</text></g>
        </svg>
        <div className="bottle-stage-footer"><span>01 — FORM</span><span>02 — ESSENCE</span><span>03 — SIGNATURE</span></div>
        <div className="bottle-stage-number">01<span>/</span>03</div>
      </div>
    </div>
  </section>;
}

function ScentFinder() {
  const [mood, setMood] = useState(moods[0]);
  const { data, isLoading } = storeApi.store.catalog.useQuery({ q: mood.terms.split(" ")[0], sort: "popular" });
  const match = data?.[0];
  const notes = mood.terms.split(" ");
  return <section className="scent-finder" id="scent-finder">
    <div className="scent-atmosphere" aria-hidden="true">
      <span className="scent-vapor scent-vapor-one" />
      <span className="scent-vapor scent-vapor-two" />
      <span className="scent-vapor scent-vapor-three" />
      <span className="scent-light-refraction" />
      <span className="scent-particle-field" />
    </div>
    <div className="scent-finder-inner">
      <div className="scent-finder-heading">
        <div className="section-intro light"><p>AN OLFACTORY COMPASS</p><h2>What moves you<br /><em>today?</em></h2><span>Choose a feeling. Discover the fragrance that speaks its language.</span></div>
        <div className="scent-editorial-note"><span>THE DEQANT SCENT EDIT · 01—06</span><b>A feeling becomes a signature.</b><p>Six moods. Six different worlds of notes. Find the one that feels like you, right now.</p></div>
      </div>
      <div className="scent-finder-grid">
        <div className="scent-selector-panel">
          <div className="scent-panel-kicker"><span>01 / CHOOSE YOUR MOOD</span><span>SELECT ONE</span></div>
          <div className="orbit-wrap">
            <div className="orbit-center"><img src="/brand/emblem-ivory.png" alt="" /><span>{mood.name}</span></div>
            {moods.map((item, index) => <button type="button" key={item.name} className={`orbit-node ${mood.name === item.name ? "active" : ""}`} style={{ "--angle": `${index * 60}deg` } as CSSProperties} onClick={() => setMood(item)} aria-pressed={mood.name === item.name}>{item.name}</button>)}
          </div>
          <div className="scent-mood-story" aria-live="polite">
            <span>THE FEELING</span><p>{mood.description}</p>
            <div className="scent-note-chips">{notes.map(note => <span key={note}>{note}</span>)}</div>
          </div>
        </div>
        <div className="scent-result-panel" aria-live="polite">
          <div className="scent-result-heading"><span>02 / YOUR PERSONAL SCENT EDIT</span><Sparkles size={17}/></div>
          {isLoading ? <div className="scent-result-loading"><span className="scent-loading-orb"/><p>Finding a fragrance for your {mood.name.toLowerCase()} side…</p></div> : match ? <div className="scent-result">
            <div className="scent-result-image"><img src={match.product.imageUrl} alt={`${match.product.name} perfume bottle`} loading="lazy"/><span>THE MATCH</span></div>
            <div className="scent-result-copy"><p>YOUR {mood.name.toUpperCase()} MATCH</p><h3>{match.product.name}</h3><span>{match.product.notes?.split(" · ").slice(0, 3).join(" · ") || mood.terms}</span><Link className="text-link light" to={`/product/${match.product.slug}`}>Meet your match <ArrowRight size={15}/></Link></div>
          </div> : <div className="scent-result-empty"><Sparkles size={22}/><p>No exact match in this mood just yet.</p><Link className="text-link light" to="/shop">Explore the complete collection <ArrowRight size={15}/></Link></div>}
          <div className="scent-result-foot"><span>CURATED FOR YOUR MOMENT</span><span>DEQANT · DHAKA</span></div>
        </div>
      </div>
    </div>
  </section>;
}

export default function Home() {
  const { data: settings } = storeApi.store.settings.useQuery();
  const { data: catalogue, isLoading } = storeApi.store.catalog.useQuery({ sort: "featured" });
  const featured = useMemo(() => catalogue?.filter((entry: CatalogEntry) => entry.product.featured).slice(0, 4) ?? [], [catalogue]);
  const line = "EAU DE PARFUM · DHAKA · 2026";
  const [typed, setTyped] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? line : ""
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let index = 0;
    let deleting = false;
    let timeout = 0;
    const tick = () => {
      if (!deleting) {
        index = Math.min(line.length, index + 1);
        setTyped(line.slice(0, index));
        if (index === line.length) {
          deleting = true;
          timeout = window.setTimeout(tick, 2400);
          return;
        }
        timeout = window.setTimeout(tick, 52);
        return;
      }
      index = Math.max(0, index - 1);
      setTyped(line.slice(0, index));
      if (index === 0) {
        deleting = false;
        timeout = window.setTimeout(tick, 700);
        return;
      }
      timeout = window.setTimeout(tick, 28);
    };
    timeout = window.setTimeout(tick, 350);
    return () => window.clearTimeout(timeout);
  }, []);
  return <PageShell>
    <section className="hero hero-cinematic">
      <div className="hero-copy">
        <p className="hero-kicker"><span className="hero-kicker-dot" />{typed}<span className="typing-caret" /></p>
        <h1>{(settings?.heroTitle ?? "YOUR SCENT. YOUR SIGNATURE.").split(". ").map((part: string, index: number) => <span key={part}>{part}{index === 0 ? "." : ""}</span>)}</h1>
        <p className="hero-description">{settings?.heroText ?? "Discover the art of fragrance. Find the scent that defines you."}</p>
        <div className="hero-actions"><Link className="button button-ivory" to="/shop">Explore collection <ArrowRight /></Link><Link className="text-link light" to="/about">Discover DEQANT <ArrowRight /></Link></div>
        <div className="hero-proofline"><span>01 / 03</span><i /><span>SCENT IS A FORM OF MEMORY</span></div>
      </div>
      <div
        className="hero-visual hero-visual-cinematic"
        aria-label="Rouge Amber eau de parfum"
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          event.currentTarget.style.setProperty("--hero-shift-x", `${x * 15}px`);
          event.currentTarget.style.setProperty("--hero-shift-y", `${y * 12}px`);
          event.currentTarget.style.setProperty("--hero-tilt", `${x * 8}deg`);
          event.currentTarget.style.setProperty("--hero-pointer-x", `${(x + 0.5) * 100}%`);
          event.currentTarget.style.setProperty("--hero-pointer-y", `${(y + 0.5) * 100}%`);
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--hero-shift-x", "0px");
          event.currentTarget.style.setProperty("--hero-shift-y", "0px");
          event.currentTarget.style.setProperty("--hero-tilt", "0deg");
          event.currentTarget.style.setProperty("--hero-pointer-x", "50%");
          event.currentTarget.style.setProperty("--hero-pointer-y", "45%");
        }}
      >
        <div className="hero-visual-grain" />
        <div className="hero-aurora-layer" aria-hidden="true" />
        <div className="hero-scanline" aria-hidden="true" />
        <div className="hero-visual-glow" />
        <div className="hero-orbit hero-orbit-a" /><div className="hero-orbit hero-orbit-b" /><div className="hero-orbit hero-orbit-c" />
        <div className="hero-light-beam" />
        <div className="hero-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="hero-orbit-text">DEQANT · OLFACTORY EDITIONS · DHAKA ·</div>
        <div className="hero-bottle-stage">
          <div className="hero-bottle-aura" />
          <img className="hero-bottle" src="/products/rouge-amber.svg" alt="Rouge Amber perfume bottle in burgundy light." width="900" height="1100" fetchPriority="high" draggable={false} />
          <div className="hero-bottle-reflection" />
          <div className="hero-perfume-spray" aria-hidden="true"><span className="spray-cloud" /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="hero-spark-lights" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        </div>
        <div className="hero-note glass hero-note-primary"><span><i /> THE OPENING</span><strong>Saffron / Almond</strong><small>Bright. Textural. Unexpected.</small></div>
        <div className="hero-note glass hero-note-secondary"><span>THE SIGNATURE</span><strong>Warm. Distinctive.</strong></div>
        <div className="hero-edition">OLFACTORY<br /><b>EDITION 03</b><i /></div>
        <div className="hero-visual-index"><span>EAU DE PARFUM</span><b>01</b><span>EXTRAIT OF CHARACTER</span></div>
      </div>
      <a className="scroll-cue" href="#collection"><ArrowDown /><span>Scroll to discover</span></a>
    </section>

    <ScrollBottleExperience />

    <div className="scent-marquee" aria-hidden="true"><div>EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /> YOUR SCENT, YOUR SIGNATURE <Sparkles /> EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /></div></div>

    <section className="home-collection" id="collection">
      <Reveal><div className="section-intro"><p>THE DEQANT EDIT</p><h2>Signatures in<br /><em>the making.</em></h2><Link className="text-link" to="/shop">View the complete collection <ArrowRight /></Link></div></Reveal>
      {isLoading ? <LoadingState /> : <div className="editorial-grid">{featured.map((entry: CatalogEntry, index: number) => <Reveal key={entry.product.id}><ProductCard entry={entry} index={index} /></Reveal>)}</div>}
    </section>

    <ScentFinder />

    <section className="manifesto">
      <Reveal className="manifesto-image"><div className="pattern-frame"><img src="/products/ivory-santal.svg" alt="Ivory Santal perfume bottle" loading="lazy" /><span>THE ART OF<br />WEARING LESS,<br />BUT MEANING MORE.</span></div></Reveal>
      <Reveal className="manifesto-copy"><p>THE DEQANT PHILOSOPHY</p><h2>A fragrance wardrobe,<br /><em>not a commitment.</em></h2><p>We believe finding your scent should feel like discovery—not a decision made under pressure. Our decants let you live with a fragrance on your skin, in your rhythm, before choosing the full bottle.</p><p>Every size is prepared with care, clearly labelled, and delivered with the same attention as our intact editions.</p><Link className="button button-burgundy" to="/decants">Explore decants <ArrowRight /></Link></Reveal>
    </section>

    <section className="service-notes">
      <div><PackageCheck /><h3>Thoughtfully packed</h3><p>Secure, considered packaging for every size.</p></div>
      <div><ShieldCheck /><h3>Authenticity first</h3><p>Carefully sourced fragrances, honestly presented.</p></div>
      <div><Sparkles /><h3>Cash on delivery</h3><p>Simple ordering with clear delivery charges.</p></div>
    </section>
  </PageShell>;
}

// Hero motion refinement release marker.
