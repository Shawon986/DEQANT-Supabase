import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock3, Package, Search, XCircle } from "lucide-react";
import { PageShell, money } from "@/components/Storefront";
import { storeApi } from "@/providers/store";

const statuses = ["pending", "confirmed", "processing", "shipped", "delivered"];
const cancellableStatuses = ["pending", "confirmed", "processing"];
const CANCELLATION_WINDOW_MS = 3 * 60 * 60 * 1000;

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function Track() {
  const [orderNumber, setOrderNumber] = useState(() => typeof window !== "undefined" ? localStorage.getItem("deqant.lastOrderNumber") ?? "" : "");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState<{ orderNumber: string; phone: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const query = storeApi.store.track.useQuery(search!, { enabled: Boolean(search), retry: false });
  const cancelMutation = storeApi.store.cancelOrder.useMutation();
  useEffect(() => {
    if (!query.data) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [query.data]);
  const submit = (event: FormEvent) => { event.preventDefault(); setSearch({ orderNumber: orderNumber.trim().toUpperCase(), phone: phone.trim() }); };
  const activeIndex = query.data ? statuses.indexOf(query.data.status) : -1;
  const deadline = query.data ? query.data.createdAt.getTime() + CANCELLATION_WINDOW_MS : 0;
  const remaining = deadline - now;
  const canCancel = Boolean(query.data && cancellableStatuses.includes(query.data.status) && remaining > 0);
  const cancel = async () => {
    if (!search || !window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
    try {
      await cancelMutation.mutateAsync(search);
      await query.refetch();
    } catch {
      // The mutation error is displayed below; the order remains unchanged.
    }
  };
  return <PageShell><section className="track-page">
    <div className="track-intro"><p>CLIENT CARE</p><h1>Follow your<br /><em>fragrance.</em></h1><span>Enter your order ID and the mobile number used at checkout. We only show delivery status—never your private details.</span></div>
    <form className="tracking-form" onSubmit={submit}><label>Order ID<input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="DQ-20261111-7F3A91C8D24B5E6A9F0C1B2D" /></label><label>Mobile number<input required minLength={8} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button button-burgundy" disabled={query.isFetching}><Search />{query.isFetching ? "Finding order…" : "Track order"}</button></form>
    {query.error && <div className="tracking-error" role="alert">{query.error.message}</div>}
    {query.data && <div className="tracking-result" aria-live="polite">
      <div className="tracking-summary"><Package /><div><p>ORDER {query.data.orderNumber}</p><h2>{query.data.status === "cancelled" ? "This order was cancelled" : query.data.status === "delivered" ? "Your fragrance has arrived" : "Your order is in motion"}</h2><span>Placed {query.data.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {money(query.data.total)}</span></div></div>
      {query.data.status !== "cancelled" && <div className="status-timeline" aria-label={`Order progress: ${query.data.status}`}>{statuses.map((status, index) => <div key={status} className={`${index <= activeIndex ? "complete" : ""}${index === activeIndex ? " current" : ""}`}><span>{index < activeIndex ? <Check /> : index + 1}</span><strong>{status}</strong><small>{index === activeIndex ? "Current status" : index < activeIndex ? "Completed" : "Upcoming"}</small></div>)}</div>}
      {canCancel ? <div className="tracking-cancel-panel"><div><span><Clock3 size={16}/> CANCELLATION AVAILABLE</span><strong>{formatRemaining(remaining)}</strong><p>You can cancel this order within 3 hours of placing it. The option closes automatically when the timer ends.</p></div><button type="button" className="tracking-cancel-button" onClick={() => void cancel()} disabled={cancelMutation.isPending}><XCircle size={16}/>{cancelMutation.isPending ? "Cancelling…" : "Cancel order"}</button></div>
      : query.data.status !== "cancelled" && (cancellableStatuses.includes(query.data.status) ? <p className="tracking-cancel-closed">The 3-hour cancellation period has ended. This order can no longer be cancelled online.</p> : <p className="tracking-cancel-closed">This order can no longer be cancelled because its fulfilment has progressed.</p>)}
      {cancelMutation.error && <div className="tracking-error" role="alert">{cancelMutation.error.message}</div>}
    </div>}
    <div className="tracking-help"><h2>Need a hand?</h2><p>If your tracking details are unavailable or your order seems delayed, our concierge can help.</p><a className="text-link" href="mailto:concierge@deqant.com">Contact concierge</a></div>
  </section></PageShell>;
}
