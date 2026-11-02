import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, PackageCheck } from "lucide-react";
import { ErrorState, LoadingState, money, PageShell } from "@/components/Storefront";
import { useCart } from "@/providers/cart";
import { storeApi } from "@/providers/store";
type DeliveryZone = { id:number; name:string; districts:string; fee:number };
type CheckoutLine = { id:number; product:{name:string;imageUrl:string}; variant:{sizeMl:number}; quantity:number; lineTotal:number };
type CheckoutResult = { orderNumber:string; total:number };
type OrderLine = { id:number; productName:string; sizeMl:number; quantity:number; lineTotal:number };

const initialForm = { customerName: "", phone: "", email: "", district: "", area: "", address: "", instructions: "" };

export default function Checkout() {
  const { cart, isLoading, token } = useCart();
  const { data: zones } = storeApi.store.zones.useQuery();
  const [form, setForm] = useState(initialForm);
  const [zoneId, setZoneId] = useState<number>();
  const idempotencyKey = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const utils = storeApi.useUtils();
  const checkout = storeApi.store.checkout.useMutation({
    onSuccess: async (result: CheckoutResult) => { localStorage.setItem("deqant.lastOrderNumber", result.orderNumber); await utils.store.cart.invalidate(); navigate(`/order/${result.orderNumber}`, { state: { phone: form.phone, total: result.total } }); },
  });
  const zone = zones?.find((item: DeliveryZone) => item.id === zoneId);
  const total = (cart?.subtotal ?? 0) + (zone?.fee ?? 0);
  const update = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !zoneId) return;
    checkout.mutate({ ...form, token, deliveryZoneId: zoneId, idempotencyKey: idempotencyKey.current });
  };
  return <PageShell>
    <section className="checkout-page"><Link className="text-link" to="/cart"><ArrowLeft /> Back to bag</Link><div className="checkout-heading"><p>SECURE CHECKOUT</p><h1>Where shall we<br /><em>send your scent?</em></h1><span><LockKeyhole /> Cash on delivery. No online payment required.</span></div>
      {isLoading ? <LoadingState /> : !cart?.items.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Add a fragrance before continuing to checkout.</p><Link className="button button-burgundy" to="/shop">Explore collection</Link></div> : <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <fieldset><legend><span>01</span> Your details</legend><div className="form-grid"><label>Full name<input required minLength={2} autoComplete="name" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Your full name" /></label><label>Mobile number<input required minLength={11} autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" /></label><label className="full-field">Email <small>Optional, for your confirmation</small><input type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" /></label></div></fieldset>
          <fieldset><legend><span>02</span> Delivery address</legend><div className="form-grid"><label>District<input required minLength={2} autoComplete="address-level1" value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="Dhaka" /></label><label>City / area<input required minLength={2} autoComplete="address-level2" value={form.area} onChange={(e) => update("area", e.target.value)} placeholder="Dhanmondi" /></label><label className="full-field">Full delivery address<textarea required minLength={8} autoComplete="street-address" rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House, road, block and landmark" /></label><label className="full-field">Additional instructions <small>Optional</small><textarea rows={2} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} placeholder="Anything our courier should know" /></label></div></fieldset>
          <fieldset><legend><span>03</span> Delivery zone</legend><div className="zone-options">{zones?.map((item: DeliveryZone) => <label key={item.id} className={zoneId === item.id ? "selected" : ""}><input type="radio" name="zone" value={item.id} checked={zoneId === item.id} onChange={() => setZoneId(item.id)} required /><span><strong>{item.name}</strong><small>{item.districts}</small></span><b>{money(item.fee)}</b></label>)}</div></fieldset>
        </div>
        <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.items.map((item: CheckoutLine) => <div className="checkout-item" key={item.id}><img src={item.product.imageUrl} alt="" /><span><strong>{item.product.name}</strong><small>{item.variant.sizeMl}ml × {item.quantity}</small></span><b>{money(item.lineTotal)}</b></div>)}<div><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><div><span>Delivery</span><strong>{zone ? money(zone.fee) : "Select a zone"}</strong></div><div className="summary-total"><span>Total payable</span><strong>{zone ? money(total) : money(cart.subtotal)}</strong></div><div className="payment-method"><Check /><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span></div>{checkout.error && <p className="form-error" role="alert">{checkout.error.message}</p>}<button className="button button-burgundy" type="submit" disabled={!zoneId || checkout.isPending}>{checkout.isPending ? "Placing your order…" : "Place order — cash on delivery"}<ArrowRight /></button><p className="checkout-consent">By placing your order, you agree to our terms and delivery policy.</p></aside>
      </form>}
    </section>
  </PageShell>;
}

export function OrderSuccess() {
  const { orderNumber = "" } = useParams();
  const location = useLocation();
  const initialPhone = (location.state as { phone?: string } | null)?.phone ?? "";
  const [phone, setPhone] = useState(initialPhone);
  const [verifiedPhone, setVerifiedPhone] = useState(initialPhone);
  const query = storeApi.store.orderSuccess.useQuery({ orderNumber, phone: verifiedPhone }, { enabled: Boolean(verifiedPhone), retry: false });
  return <PageShell><section className="success-page">
    <div className="success-hero"><span className="success-check"><Check /></span><p>ORDER RECEIVED</p><h1>Your signature<br /><em>is on its way.</em></h1><span>Order <strong>{orderNumber}</strong></span><p>We’ll review your order and contact you at the phone number provided. Keep your order ID for tracking.</p></div>
    {!verifiedPhone ? <form className="verify-order" onSubmit={(e) => { e.preventDefault(); setVerifiedPhone(phone); }}><label>Confirm your mobile number to view this order<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button button-burgundy">View order</button></form> : query.isLoading ? <LoadingState label="Retrieving your order…" /> : query.error ? <ErrorState message={query.error.message} /> : query.data ? <div className="success-details"><div className="success-status"><PackageCheck /><div><p>Current status</p><h2>{query.data.order.status}</h2></div><strong>{money(query.data.order.total)}</strong></div><div className="success-grid"><div><h3>Delivery to</h3><p>{query.data.order.customerName}<br />{query.data.order.address}<br />{query.data.order.area}, {query.data.order.district}<br />{query.data.order.phone}</p></div><div><h3>Your fragrances</h3>{query.data.items.map((item: OrderLine) => <p key={item.id}>{item.productName} · {item.sizeMl}ml × {item.quantity}<strong>{money(item.lineTotal)}</strong></p>)}<p>Delivery <strong>{money(query.data.order.deliveryFee)}</strong></p></div></div><div className="success-actions"><Link className="button button-burgundy" to="/track">Track this order <ArrowRight /></Link><Link className="text-link" to="/shop">Continue exploring <ArrowRight /></Link></div></div> : null}
  </section></PageShell>;
}
