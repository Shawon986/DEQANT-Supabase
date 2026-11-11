import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowRight, ArrowUpRight, CloudRain, Droplets, PackageCheck, ShieldCheck, ShoppingBag, Snowflake, Sparkles, Star, Sun, Wind } from "lucide-react";
import { PageShell, ProductCard, Reveal, LoadingState } from "@/components/Storefront";
import { storeApi } from "@/providers/store";
import type { CatalogEntry } from "@/lib/supabase";
import { useCart } from "@/providers/cart";

const moods = [
  { name: "Warm", terms: "amber vanilla", description: "Soft amber, creamy vanilla and a golden, lingering warmth." },
  { name: "Fresh", terms: "citrus bergamot", description: "Bright citrus, cool bergamot and the feeling of clean air." },
  { name: "Floral", terms: "rose jasmine", description: "Velvety rose, luminous jasmine and a graceful floral trail." },
  { name: "Woody", terms: "oud sandalwood", description: "Polished woods, smooth sandalwood and a quietly confident depth." },
  { name: "Spicy", terms: "saffron cinnamon", description: "A little heat, aromatic spice and an unforgettable edge." },
  { name: "Musk", terms: "musk iris", description: "Airy musk, soft iris and an intimate skin-like finish." },
];

const weatherProfiles = [
 {id:"hot",title:"Hot & humid",short:"SUN / HUMIDITY",temperature:"28°–38°C",icon:Sun,headline:"Keep it light. Leave a beautiful trail.",advice:"Heat amplifies fragrance. Reach for airy citrus, green notes, clean musk and aquatic freshness; keep dense sweetness for cooler hours.",tags:["Citrus","Aquatic","Green","Clean musk"],terms:["citrus","bergamot","lemon","lime","grapefruit","neroli","aquatic","marine","green","vetiver","fresh","musk"],accent:"sun"},
 {id:"rain",title:"Rainy days",short:"RAIN / MONSOON",temperature:"22°–30°C",icon:CloudRain,headline:"A little depth for the softer skies.",advice:"Rain and humidity call for balanced woods, aromatic herbs and earthy freshness. Choose something grounding without becoming too heavy.",tags:["Vetiver","Woody","Earthy","Aromatic"],terms:["vetiver","cedar","patchouli","earthy","woody","aromatic","lavender","moss","tea","musk"],accent:"rain"},
 {id:"cool",title:"Cool & crisp",short:"COLD / WINTER",temperature:"8°–20°C",icon:Snowflake,headline:"Let warmth unfold slowly.",advice:"Cool air softens projection. Amber, vanilla, spices, woods and richer gourmand notes bring warmth and a memorable, comforting presence.",tags:["Amber","Vanilla","Spice","Oud"],terms:["amber","vanilla","saffron","cinnamon","oud","tobacco","leather","spice","tonka","gourmand","sandalwood"],accent:"cool"},
 {id:"mild",title:"Mild & breezy",short:"SPRING / AUTUMN",temperature:"18°–27°C",icon:Wind,headline:"Find your effortless everyday signature.",advice:"In balanced weather, florals, soft woods, iris, tea and gentle musk feel versatile from daytime plans to evening moments.",tags:["Floral","Iris","Tea","Soft woods"],terms:["rose","jasmine","iris","lavender","tea","floral","sandalwood","musk","pear","aromatic"],accent:"mild"}
] as const;

function WeatherAtelier({catalogue}:{catalogue?:CatalogEntry[]}) {
 const [climateId,setClimateId]=useState<(typeof weatherProfiles)[number]["id"]>("hot");
 const climate=weatherProfiles.find(item=>item.id===climateId)??weatherProfiles[0];
 const recommendations=useMemo(()=>{
  if(!catalogue?.length)return [];
  // Every published perfume is evaluated from its saved catalogue data.
  // Notes and fragrance family carry the strongest signal; descriptions provide
  // a useful secondary signal when an admin has entered richer product details.
  const normalise=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const scored=catalogue.map(entry=>{
   const notes=normalise(entry.product.notes);
   const family=normalise(entry.product.family);
   const description=normalise(entry.product.description);
   const identity=normalise([entry.product.name,entry.product.brand].join(" "));
   const score=climate.terms.reduce((total,term)=>{
    const needle=normalise(term);
    if(!needle)return total;
    return total+(notes.includes(needle)?5:0)+(family.includes(needle)?4:0)+(description.includes(needle)?2:0)+(identity.includes(needle)?1:0);
   },0);
   return {entry,score,matchedByNotes:climate.terms.some(term=>notes.includes(normalise(term))||family.includes(normalise(term)))};
  }).sort((a,b)=>b.score-a.score||(b.entry.product.popularity??0)-(a.entry.product.popularity??0));
  const matches=scored.filter(item=>item.score>0).slice(0,3);
  return (matches.length?matches:scored.slice(0,3)).map(item=>({...item,curatedFallback:item.score===0}));
 },[catalogue,climate]);
 const ClimateIcon=climate.icon;
 return <section className={`weather-atlas weather-${climate.accent}`} aria-labelledby="weather-atlas-title">
  <div className="weather-atlas-noise" aria-hidden="true"/><div className="weather-atlas-orbit weather-orbit-one" aria-hidden="true"/><div className="weather-atlas-orbit weather-orbit-two" aria-hidden="true"/>
  <div className="weather-atlas-inner">
   <div className="weather-atlas-heading"><div><p className="weather-kicker"><span/> THE CLIMATE × FRAGRANCE STUDY</p><h2 id="weather-atlas-title">Dress for the<br/><em>weather.</em></h2><p className="weather-intro">Your scent should move with the atmosphere. Choose the weather around you and discover fragrances selected for the way they bloom in that air.</p></div><div className="weather-heading-mark"><span>DEQANT</span><strong>W</strong><small>THE WEATHER EDIT · 01—04</small></div></div>
   <div className="weather-atlas-layout">
    <div className="weather-climate-panel"><div className="weather-panel-top"><span>01 / SET THE ATMOSPHERE</span><span>CHOOSE YOUR CLIMATE</span></div>
     <div className="weather-climate-options">{weatherProfiles.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={`weather-climate-option ${climateId===item.id?"active":""}`} onClick={()=>setClimateId(item.id)} aria-pressed={climateId===item.id}><span className="weather-option-icon"><Icon size={20}/></span><span className="weather-option-copy"><strong>{item.title}</strong><small>{item.short}</small></span><span className="weather-option-temp">{item.temperature}</span><ArrowUpRight size={15} className="weather-option-arrow"/></button>;})}</div>
     <div className="weather-atmosphere-art" aria-live="polite"><div className="weather-art-glow"/><div className="weather-art-ring ring-a"/><div className="weather-art-ring ring-b"/><div className="weather-art-core"><ClimateIcon size={48} strokeWidth={1}/><span>{climate.short}</span><strong>{climate.temperature}</strong></div><span className="weather-art-coordinate">23° 42' N / 90° 21' E</span><span className="weather-art-caption">AN ATMOSPHERIC STUDY</span><i className="weather-particle particle-a"/><i className="weather-particle particle-b"/><i className="weather-particle particle-c"/><i className="weather-particle particle-d"/></div>
    </div>
    <div className="weather-recommendation-panel" aria-live="polite"><div className="weather-result-top"><span>02 / THE FRAGRANCE FORECAST</span><span className="weather-live-dot">CURATED FOR YOU</span></div>
     <div className="weather-result-copy"><span>THE DEQANT CLIMATE NOTE</span><h3>{climate.headline}</h3><p>{climate.advice}</p><div className="weather-note-tags">{climate.tags.map(tag=><span key={tag}><Droplets size={11}/>{tag}</span>)}</div></div>
     <div className="weather-picks-heading"><strong>SCENTS FOR THIS WEATHER</strong><span>{recommendations.length?String(recommendations.length).padStart(2,"0")+" SELECTED":"BUILDING YOUR EDIT"}</span></div>
     {recommendations.length?<div className="weather-product-list">{recommendations.map(({entry,curatedFallback},index)=><Link to={`/product/${entry.product.slug}`} className="weather-product-pick" key={entry.product.id}><span className="weather-pick-number">0{index+1}</span><img src={entry.product.imageUrl} alt={entry.product.name} loading="lazy"/><span className="weather-pick-info"><small>{entry.product.brand}</small><strong>{entry.product.name}</strong><em>{curatedFallback?"A popular DEQANT pick":`Matched to ${climate.title.toLowerCase()}`}</em></span><ArrowUpRight size={17}/></Link>)}</div>:<div className="weather-no-products">Your climate edit is being prepared. Check back soon.</div>}
     <div className="weather-result-foot"><span>NOTE-LED DISCOVERY</span><span>NOT A ONE-SCENT RULE · FIND YOUR SIGNATURE</span></div>
    </div>
   </div><div className="weather-atlas-footer"><span>THE RIGHT SCENT, IN THE RIGHT AIR.</span><span>DEQANT FRAGRANCE <i>✳</i> RAJSHAHI</span></div>
  </div>
 </section>;
}

function ScrollBottleExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cap = section.querySelector<SVGGElement>(".bottle-cap");
    const atomizer = section.querySelector<SVGGElement>(".bottle-atomizer");
    const collar = section.querySelector<SVGGElement>(".bottle-collar");
    const glass = section.querySelector<SVGGElement>(".bottle-glass");
    const juice = section.querySelector<SVGGElement>(".bottle-juice");
    const label = section.querySelector<SVGGElement>(".bottle-label");
    const parts = [cap, atomizer, collar, glass, juice, label];
    if (parts.some((part) => !part)) return;

    let frame = 0;
    let sectionTop = 0;
    let animationStart = 0;
    let runway = 1;
    let distances = { cap: 220, atomizer: 158, collar: 92, glass: 52, juice: 64, label: 78 };

    const measure = () => {
      // Keep the page in ordinary document flow. Only cache geometry on resize;
      // scroll frames update the bottle SVG parts and never read layout.
      sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      animationStart = sectionTop - viewportHeight * 0.35;
      runway = Math.max(1, section.offsetHeight + viewportHeight * 0.3);
      distances = window.matchMedia("(max-width: 760px)").matches
        ? { cap: 118, atomizer: 88, collar: 54, glass: 30, juice: 36, label: 42 }
        : { cap: 220, atomizer: 158, collar: 92, glass: 52, juice: 64, label: 78 };
    };

    const render = () => {
      frame = 0;
      const progress = Math.max(0, Math.min(1, (window.scrollY - animationStart) / runway));
      const capY = -distances.cap * progress;
      const atomizerY = -distances.atomizer * progress;
      const collarY = -distances.collar * progress;
      const glassY = distances.glass * progress;
      const juiceY = distances.juice * progress;
      const labelY = distances.label * progress;

      cap!.style.transform = `translate3d(${-10 * progress}px, ${capY}px, 0) rotate(${-12 * progress}deg)`;
      atomizer!.style.transform = `translate3d(${14 * progress}px, ${atomizerY}px, 0) rotate(${8 * progress}deg)`;
      collar!.style.transform = `translate3d(${-9 * progress}px, ${collarY}px, 0) rotate(${-8 * progress}deg)`;
      glass!.style.transform = `translate3d(0, ${glassY}px, 0) scale(${1 - progress * 0.018})`;
      juice!.style.transform = `translate3d(0, ${juiceY}px, 0)`;
      label!.style.transform = `translate3d(0, ${labelY}px, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const handleResize = () => { measure(); schedule(); };
    // Product content above this scene can resize after async loading. Keep the
    // cached section offset accurate so fast scrolling never uses stale geometry.
    const layoutObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      measure();
      schedule();
    }) : null;
    if (section.parentElement) layoutObserver?.observe(section.parentElement);
    layoutObserver?.observe(section);

    section.classList.add("is-active");
    measure();
    render();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.cancelAnimationFrame(frame);
      layoutObserver?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      section.classList.remove("is-active");
      parts.forEach((part) => { if (part) part.style.transform = ""; });
    };
  }, []);

  return <section className="bottle-scroll-story" ref={sectionRef} aria-label="Interactive perfume bottle story">
    <div className="bottle-story-ornament bottle-story-ornament-top" aria-hidden="true">
      <span className="bottle-ornament-index">DEQANT / THE ART OF FRAGRANCE</span>
      <span className="bottle-ornament-rule" />
      <span className="bottle-ornament-edition">ANATOMY OF A SIGNATURE · VOL. 001</span>
      <div className="bottle-ornament-topline">
        <span className="bottle-ornament-seal"><img src="/brand/emblem-ivory.png" alt="" /></span>
        <div className="bottle-ornament-heading"><span>THE SCENT ARCHIVE</span><strong>THE ART OF THE INVISIBLE.</strong></div>
        <span className="bottle-ornament-subtitle">A STUDY IN FORM,<br/>FRAGRANCE & MEMORY</span>
      </div>
    </div>
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
        <div className="bottle-stage-caption"><span>DEQANT / OBJECT 001</span><span>FRAGRANCE, FELT NOT SEEN</span></div>
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
          <g className="bottle-part bottle-label"><rect x="157" y="365" width="106" height="92" rx="3" fill="#3c1425" fillOpacity=".91" stroke="#d8b994" strokeWidth="1.5"/><path d="M168 377 H252" stroke="#d8b994" strokeOpacity=".7"/><text x="210" y="405" textAnchor="middle" fill="#f4e5d2" fontSize="17" letterSpacing="3" fontFamily="Georgia,serif">DEQANT</text><text x="210" y="425" textAnchor="middle" fill="#d8b994" fontSize="7" letterSpacing="2">FRAGRANCE</text><text x="210" y="442" textAnchor="middle" fill="#d8b994" fontSize="6" letterSpacing="1.5">A MEMORY IN EVERY NOTE</text></g>
        </svg>
        <div className="bottle-stage-footer"><span>01 — FORM</span><span>02 — ESSENCE</span><span>03 — SIGNATURE</span></div>
        <div className="bottle-stage-number">01<span>/</span>03</div>
      </div>
    </div>
    <div className="bottle-story-ornament bottle-story-ornament-bottom" aria-hidden="true">
      <div className="bottle-bottom-epigraph"><span>THE INVISIBLE, MADE ICONIC.</span><strong>AN OBJECT OF DESIRE.</strong></div>
      <div className="bottle-bottom-note"><span>THE CRAFT</span><strong>Designed to be discovered.</strong></div>
      <div className="bottle-bottom-notes"><span>01 <i>FORM</i></span><span>02 <i>ESSENCE</i></span><span>03 <i>MEMORY</i></span></div>
      <div className="bottle-bottom-mark">SCENT IS A FORM OF MEMORY <b>—</b> DEQANT, RAJSHAHI</div>
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
          <div className="scent-result-foot"><span>CURATED FOR YOUR MOMENT</span><span>DEQANT · RAJSHAHI</span></div>
        </div>
      </div>
    </div>
  </section>;
}

export default function Home() {
  const { data: settings } = storeApi.store.settings.useQuery();
  const { data: catalogue, isLoading } = storeApi.store.catalog.useQuery({ sort: "popular" }, { staleTime: 0, refetchOnMount: "always" });
  const bestSellers = useMemo(() => catalogue?.filter((entry: CatalogEntry) => entry.product.bestSeller).slice(0, 4) ?? [], [catalogue]);
  const highRated = useMemo(() => catalogue?.filter((entry: CatalogEntry) => (entry.product.ratingCount ?? 0) > 0 && (entry.product.averageRating ?? 0) >= 4).sort((a: CatalogEntry, b: CatalogEntry) => (b.product.averageRating ?? 0) - (a.product.averageRating ?? 0) || (b.product.ratingCount ?? 0) - (a.product.ratingCount ?? 0)).slice(0, 4) ?? [], [catalogue]);
  const [bestSellerSizes, setBestSellerSizes] = useState<Record<number, number>>({});
  const { add, isMutating } = useCart();
  const line = "FEEL THE FRAGRANCE · RAJSHAHI · 2026";
  const [typed, setTyped] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? line : ""
  );
  // Pause decorative animations when their sections are outside the viewport.
  // This keeps the visual treatment intact while avoiding off-screen GPU work.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll<HTMLElement>(
      ".hero-visual-cinematic, .scent-marquee, .bottle-scroll-story, .scent-finder, .weather-atlas"
    );
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("motion-paused", !entry.isIntersecting);
      });
    }, { rootMargin: "120px 0px", threshold: 0 });
    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      targets.forEach((target) => target.classList.remove("motion-paused"));
    };
  }, []);
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
        <h1>{(settings?.heroTitle ?? "A SCENT OF SUNNAH IN EVERY BOTTLE.").split(". ").map((part: string, index: number) => <span key={part}>{part}{index === 0 ? "." : ""}</span>)}</h1>
        <p className="hero-description">{settings?.heroText ?? "So spread the fragrance."}</p>
        <div className="hero-actions"><Link className="button button-ivory" to="/shop">Explore collection <ArrowRight /></Link><Link className="text-link light" to="/about">Discover DEQANT <ArrowRight /></Link></div>
        <div className="hero-proofline"><span>01 / 03</span><i /><span>SCENT IS A FORM OF MEMORY</span></div>
      </div>
      <div
        className="hero-visual hero-visual-cinematic"
        aria-label="Rouge Amber fragrance bottle"
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
        <div className="hero-orbit-text">DEQANT · OLFACTORY EDITIONS · RAJSHAHI ·</div>
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
        <div className="hero-visual-index"><span>THE ART OF A LASTING SCENT</span><b>01</b><span>EXTRAIT OF CHARACTER</span></div>
      </div>
      <a className="scroll-cue" href="#collection"><ArrowDown /><span>Scroll to discover</span></a>
    </section>

    <section className="deq-promise-ribbon" aria-label="DEQANT shopping promises">
      <div className="deq-promise-glow" aria-hidden="true"/><div className="deq-promise-orbit" aria-hidden="true"/>
      <div className="deq-promise-inner">
        <div className="deq-promise-main">
          <div className="deq-promise-intro">
            <div className="deq-promise-heading"><span>THE DEQANT PROMISE</span><i/><small>01 — 04 / ALWAYS INCLUDED</small></div>
            <div className="deq-promise-seal" aria-hidden="true"><span>THE DEQANT STANDARD</span><b>D</b><i>✳</i><small>CARE IN EVERY DETAIL</small></div>
            <p className="deq-promise-eyebrow">A BETTER WAY TO DISCOVER FRAGRANCE</p>
            <h2>Confidence,<br/><em>beautifully delivered.</em></h2>
            <p className="deq-promise-description">From the first click to the final note, every order comes with a little more care.</p>
            <span className="deq-promise-signature">THE DETAILS MATTER. <b>✳</b> DEQANT</span>
          </div>
          <div className="deq-promise-grid">
            <article className="deq-promise-item"><span className="deq-promise-index">01</span><span className="deq-promise-icon"><PackageCheck size={21}/></span><div><small>COMPLIMENTARY DELIVERY</small><strong>Free delivery</strong><p>On orders ৳2,000+</p></div></article>
            <article className="deq-promise-item"><span className="deq-promise-index">02</span><span className="deq-promise-icon"><ShieldCheck size={21}/></span><div><small>AUTHENTICITY, ALWAYS</small><strong>Money back</strong><p>If not original</p></div></article>
            <article className="deq-promise-item"><span className="deq-promise-index">03</span><span className="deq-promise-icon"><ShoppingBag size={21}/></span><div><small>PAY WITH CONFIDENCE</small><strong>Cash on delivery</strong><p>Pay when it arrives</p></div></article>
            <article className="deq-promise-item"><span className="deq-promise-index">04</span><span className="deq-promise-icon"><Sparkles size={21}/></span><div><small>PACKED WITH CARE</small><strong>Free replacement</strong><p>For glass atomizer leak or break</p></div></article>
          </div>
        </div>
        <div className="deq-promise-ticker" aria-label="Free delivery on orders ৳2,000 plus. Money back if not original. Cash on delivery. Free replacement for glass atomizer leak or break.">
          <div className="deq-promise-ticker-track"><span>FREE DELIVERY ON ORDERS ৳2,000+</span><i>✳</i><span>MONEY BACK IF NOT ORIGINAL</span><i>✳</i><span>CASH ON DELIVERY</span><i>✳</i><span>FREE REPLACEMENT FOR GLASS ATOMIZER LEAK OR BREAK</span><i>✳</i><span>FREE DELIVERY ON ORDERS ৳2,000+</span><i>✳</i><span>MONEY BACK IF NOT ORIGINAL</span><i>✳</i><span>CASH ON DELIVERY</span><i>✳</i><span>FREE REPLACEMENT FOR GLASS ATOMIZER LEAK OR BREAK</span><i>✳</i></div>
        </div>
      </div>
    </section>

    <ScrollBottleExperience />

    <div className="scent-marquee" aria-hidden="true"><div><span>EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /> SO SPREAD THE FRAGRANCE <Sparkles /></span><span>EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /> SO SPREAD THE FRAGRANCE <Sparkles /></span><span>EXTRAITS OF CHARACTER <Sparkles /> DECANTS, DONE BEAUTIFULLY <Sparkles /> SO SPREAD THE FRAGRANCE <Sparkles /></span></div></div>

    <section className="home-collection" id="collection">
      <Reveal><div className="section-intro"><p>THE DEQANT EDIT</p><h2>Our<br /><em>best sellers.</em></h2><Link className="text-link" to="/best-sellers">View all best sellers <ArrowRight /></Link></div></Reveal>
      {isLoading ? <LoadingState /> : bestSellers.length ? <div className="editorial-grid">{bestSellers.map((entry: CatalogEntry, index: number) => {
        const availableVariants = entry.variants.filter((variant) => entry.product.category === "decant" ? [3, 6, 10].includes(variant.sizeMl) : [60, 100, 150].includes(variant.sizeMl));
        const selectedSize = bestSellerSizes[entry.product.id] ?? (availableVariants.find((variant) => variant.sizeMl === 3)?.sizeMl ?? availableVariants.find((variant) => variant.stock > 0)?.sizeMl ?? 3);
        const purchasable = availableVariants.find((variant) => variant.sizeMl === selectedSize);
        return <Reveal key={entry.product.id}><div className="best-seller-card"><ProductCard entry={entry} index={index} /><label className="best-seller-size"><span>CHOOSE SIZE</span><select aria-label={`Choose size for ${entry.product.name}`} value={selectedSize} onChange={(event) => setBestSellerSizes(current => ({...current,[entry.product.id]:Number(event.target.value)}))}>{availableVariants.map(variant=><option key={variant.id} value={variant.sizeMl} disabled={variant.stock===0}>{variant.sizeMl} ml{variant.stock===0?" · Sold out":""}</option>)}</select></label><button type="button" className="button button-burgundy best-seller-add" onClick={() => purchasable && purchasable.stock>0 && add(purchasable.id, 1)} disabled={!purchasable || purchasable.stock===0 || isMutating}><ShoppingBag size={16} />{isMutating ? "Adding…" : purchasable?.stock ? `Add ${purchasable.sizeMl}ml to cart` : "Sold out"}</button></div></Reveal>;
      })}</div> : <div className="empty-state"><p>Our best sellers are being curated. Explore the complete collection.</p><Link className="text-link" to="/shop">Shop all fragrances <ArrowRight /></Link></div>}
    </section>

    <section className="shop-by-section shop-by-atlas" aria-labelledby="shop-by-heading">
 <div className="shop-by-atlas-top"><span>DEQANT / COLLECTION INDEX</span><span>VOL. 001 — FIND YOUR WORLD</span></div>
 <div className="shop-by-atlas-heading"><div><p>DISCOVER BY CHARACTER</p><h2 id="shop-by-heading">A world of<br/><em>your own.</em></h2></div><div className="shop-by-atlas-intro"><span>THE COLLECTION INDEX · 08 PATHWAYS</span><p>Not sure what you love yet? Start with a point of view. Explore fragrance through identity, origin, artistry and discovery.</p><Link to="/shop">VIEW THE COMPLETE COLLECTION <ArrowUpRight size={15}/></Link></div></div>
 <div className="shop-by-atlas-grid">
 {[{key:"for-him",label:"For him",sub:"BOLD BY NATURE",note:"Confident signatures",index:"01",symbol:"H",tone:"ink"},{key:"for-her",label:"For her",sub:"SOFTLY UNFORGETTABLE",note:"Expressive elegance",index:"02",symbol:"F",tone:"rose"},{key:"unisex",label:"Unisex",sub:"BEYOND THE LABEL",note:"Made to be shared",index:"03",symbol:"U",tone:"sage"},{key:"middle-eastern",label:"Middle Eastern",sub:"A LEGACY IN EVERY NOTE",note:"Oud, amber & heritage",index:"04",symbol:"م",tone:"noir"},{key:"designer",label:"Designer",sub:"ICONS OF MODERNITY",note:"The houses you know",index:"05",symbol:"D",tone:"sand"},{key:"niche",label:"Niche",sub:"ART WITHOUT COMPROMISE",note:"Rare olfactory art",index:"06",symbol:"N",tone:"plum"},{key:"new-drops",label:"New drops",sub:"FRESH FROM THE ATELIER",note:"Just arrived",index:"07",symbol:<Sparkles aria-hidden="true" strokeWidth={1.1}/>,tone:"blue"},{key:"all-brands",label:"All brands",sub:"THE COMPLETE ARCHIVE",note:"Every house, one place",index:"08",symbol:"∞",tone:"gold"}].map(item=><Link key={item.key} to={`/shop?shopCategory=${item.key}`} className={`shop-atlas-tile shop-atlas-${item.tone}`}><span className="shop-atlas-topline"><small>{item.index} / 08</small><small>{item.sub}</small></span><span className="shop-atlas-symbol" aria-hidden="true">{item.symbol}</span><span className="shop-atlas-bottom"><span><strong>{item.label}</strong><small>{item.note}</small></span><span className="shop-atlas-go"><ArrowUpRight size={19}/></span></span></Link>)}
 </div><div className="shop-by-atlas-bottom"><span>FOLLOW YOUR INSTINCT. DISCOVER YOUR SIGNATURE.</span><span>08 COLLECTIONS <i>✳</i> ENDLESS POSSIBILITIES</span></div>
</section>

<WeatherAtelier catalogue={catalogue} />

    <ScentFinder />

    <section className="high-rated-section"><div className="high-rated-heading"><div className="section-intro"><p>THE CUSTOMER EDIT</p><h2>Most <em>loved.</em></h2><span>Real ratings from fragrance lovers. Discover the scents customers return to, recommend, and make part of their everyday ritual.</span></div><span className="high-rated-stamp"><Star size={15} fill="currentColor"/> RATED BY YOU</span></div><div className="high-rated-guide"><div><strong>01</strong><span>Genuine customer scores</span><small>Every star comes from a customer rating.</small></div><div><strong>02</strong><span>Five-star scale</span><small>Each fragrance is scored from 1 to 5.</small></div><div><strong>03</strong><span>Always evolving</span><small>Rankings update as new ratings arrive.</small></div></div>{highRated.length?<div className="high-rated-grid">{highRated.map((entry:CatalogEntry,index:number)=><Reveal key={entry.product.id}><article className="high-rated-card"><ProductCard entry={entry} index={index}/><div className="high-rated-score"><span className="rating-stars" aria-label={`${entry.product.averageRating} out of 5 stars`}>{Array.from({length:5},(_,i)=><Star key={i} size={13} fill={i<Math.round(entry.product.averageRating??0)?"currentColor":"none"}/>)}</span><strong>{Number(entry.product.averageRating).toFixed(1)}</strong><small>{entry.product.ratingCount} {entry.product.ratingCount===1?"rating":"ratings"}</small></div></article></Reveal>)}</div>:<div className="high-rated-empty"><Star/><div><strong>Your next favourite starts here.</strong><p>Customer-rated fragrances will appear in this collection automatically.</p></div></div>}</section>

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
