import { useState, type FormEvent } from "react";
import { Check, Package, Search } from "lucide-react";
import { PageShell, money } from "@/components/Storefront";
import { storeApi } from "@/providers/store";

const statuses = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function Track() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState<{ orderNumber: string; phone: string } | null>(null);
  const query = storeApi.store.track.useQuery(search!, { enabled: Boolean(search), retry: false });
  const submit = (event: FormEvent) => { event.preventDefault(); setSearch({ orderNumber: orderNumber.trim().toUpperCase(), phone: phone.trim() }); };
  const activeIndex = query.data ? statuses.indexOf(query.data.status) : -1;
  return <PageShell><section className="track-page">
    <div className="track-intro"><p>CLIENT CARE</p><h1>Follow your<br /><em>fragrance.</em></h1><span>Enter your order ID and the mobile number used at checkout. We only show delivery status—never your private details.</span></div>
    <form className="tracking-form" onSubmit={submit}><label>Order ID<input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="DQ-20261030-ABC123" /></label><label>Mobile number<input required minLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button button-burgundy" disabled={query.isFetching}><Search />{query.isFetching ? "Finding order…" : "Track order"}</button></form>
    {query.error && <div className="tracking-error" role="alert">{query.error.message}</div>}
    {query.data && <div className="tracking-result" aria-live="polite"><div className="tracking-summary"><Package /><div><p>ORDER {query.data.orderNumber}</p><h2>{query.data.status === "cancelled" ? "This order was cancelled" : query.data.status === "delivered" ? "Your fragrance has arrived" : "Your order is in motion"}</h2><span>Placed {query.data.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {money(query.data.total)}</span></div></div>{query.data.status !== "cancelled" && <div className="status-timeline">{statuses.map((status, index) => <div key={status} className={index <= activeIndex ? "complete" : ""}><span>{index < activeIndex ? <Check /> : index + 1}</span><strong>{status}</strong><small>{index === activeIndex ? "Current status" : index < activeIndex ? "Completed" : "Upcoming"}</small></div>)}</div>}</div>}
    <div className="tracking-help"><h2>Need a hand?</h2><p>If your tracking details are unavailable or your order seems delayed, our concierge can help.</p><a className="text-link" href="mailto:concierge@deqant.com">Contact concierge</a></div>
  </section></PageShell>;
}
