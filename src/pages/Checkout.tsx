import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, Clock3, LockKeyhole, PackageCheck } from "lucide-react";
import { ErrorState, LoadingState, money, PageShell } from "@/components/Storefront";
import { useCart } from "@/providers/cart";
import { validateCoupon } from "@/lib/supabase";
import { storeApi } from "@/providers/store";
type DeliveryZone = { id:number; name:string; districts:string; fee:number };
type CheckoutLine = { id:number; product:{name:string;imageUrl:string;shippingWeightGrams:number}; variant:{sizeMl:number}; quantity:number; lineTotal:number };
type CheckoutResult = { orderNumber:string; total:number };
type OrderLine = { id:number; productName:string; sizeMl:number; quantity:number; lineTotal:number };

const initialForm = { customerName: "", phone: "", email: "", district: "", area: "", address: "", instructions: "" };

export default function Checkout() {
  const { cart, isLoading, token } = useCart();
  const { data: zones } = storeApi.store.zones.useQuery();
  const [form, setForm] = useState(initialForm);
  const [zoneId, setZoneId] = useState<number>();
  const [couponCode,setCouponCode]=useState("");
  const [couponPercent,setCouponPercent]=useState(0);
  const [couponMessage,setCouponMessage]=useState("");
  const [couponBusy,setCouponBusy]=useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const utils = storeApi.useUtils();
  const checkout = storeApi.store.checkout.useMutation({
    onSuccess: async (result: CheckoutResult) => { localStorage.setItem("deqant.lastOrderNumber", result.orderNumber); await utils.store.cart.invalidate(); navigate(`/order/${result.orderNumber}`, { state: { phone: form.phone, total: result.total } }); },
  });
  const zone = zones?.find((item: DeliveryZone) => item.id === zoneId);
  const orderSubtotal=Math.max(0,Number(cart?.subtotal)||0);
  const totalWeight=(cart?.items??[]).reduce((sum:number,item:CheckoutLine)=>sum+(Math.max(1,Number(item.product.shippingWeightGrams)||150)*item.quantity),0);
  const deliveryFee=orderSubtotal>=2000?0:(zone?(Number(zone.fee)||0)+(totalWeight>1000?20:0):0);
  const safeCouponPercent=Math.min(100,Math.max(0,Number(couponPercent)||0));
  const discountAmount=Math.min(orderSubtotal,Math.floor(orderSubtotal*safeCouponPercent/100));
  const total=Math.max(0,orderSubtotal-discountAmount+deliveryFee);
  const applyCoupon=async()=>{setCouponBusy(true);setCouponMessage("");try{const result:any=await validateCoupon(couponCode);setCouponPercent(Number(result.discountPercent)||0);setCouponCode(String(result.code||couponCode).toUpperCase());setCouponMessage(`${result.discountPercent}% discount applied.`);}catch(error){setCouponPercent(0);setCouponMessage(error instanceof Error?error.message:"Could not validate this coupon.");}finally{setCouponBusy(false);}};
  const update = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !zoneId) return;
    checkout.mutate({ ...form, token, deliveryZoneId: zoneId, couponCode:couponPercent?couponCode:"", idempotencyKey: idempotencyKey.current });
  };
  return <PageShell>
    <section className="checkout-page"><Link className="text-link" to="/cart"><ArrowLeft /> Back to bag</Link><div className="checkout-heading"><p>SECURE CHECKOUT</p><h1>Where shall we<br /><em>send your scent?</em></h1><span><LockKeyhole /> ৳200 advance via bKash · remaining balance on delivery.</span></div>
      {isLoading ? <LoadingState /> : !cart?.items.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Add a fragrance before continuing to checkout.</p><Link className="button button-burgundy" to="/shop">Explore collection</Link></div> : <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <fieldset><legend><span>01</span> Your details</legend><div className="form-grid"><label>Full name<input required minLength={2} autoComplete="name" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Your full name" /></label><label>Mobile number<input required minLength={11} autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" /></label><label className="full-field">Email <small>Optional, for your confirmation</small><input type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" /></label></div></fieldset>
          <fieldset><legend><span>02</span> Delivery address</legend><div className="form-grid"><label>District<input required minLength={2} autoComplete="address-level1" value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="Rajshahi" /></label><label>City / area<input required minLength={2} autoComplete="address-level2" value={form.area} onChange={(e) => update("area", e.target.value)} placeholder="Your area" /></label><label className="full-field">Full delivery address<textarea required minLength={8} autoComplete="street-address" rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House, road, block and landmark" /></label><label className="full-field">Additional instructions <small>Optional</small><textarea rows={2} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} placeholder="Anything our courier should know" /></label></div></fieldset>
          <fieldset><legend><span>03</span> Delivery zone</legend><div className="zone-options">{zones?.map((item: DeliveryZone) => <label key={item.id} className={zoneId === item.id ? "selected" : ""}><input type="radio" name="zone" value={item.id} checked={zoneId === item.id} onChange={() => setZoneId(item.id)} required /><span><strong>{item.name}</strong><small>{item.districts}</small></span><b>{money(item.fee)}</b></label>)}</div></fieldset>
        </div>
        <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.items.map((item: CheckoutLine) => <div className="checkout-item" key={item.id}><img src={item.product.imageUrl} alt="" /><span><strong>{item.product.name}</strong><small>{item.variant.sizeMl}ml × {item.quantity}</small></span><b>{money(item.lineTotal)}</b></div>)}<div><span>Subtotal</span><strong>{money(orderSubtotal)}</strong></div><div><span>Delivery</span><strong>{zone ? deliveryFee===0?"FREE":money(deliveryFee) : "Choose a zone to calculate"}</strong></div>{couponPercent>0&&<div><span>Coupon ({couponCode})</span><strong>−{money(discountAmount)}</strong></div>}<div className="coupon-entry"><label htmlFor="checkout-coupon">Coupon code</label><div><input id="checkout-coupon" value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCouponPercent(0);setCouponMessage("");}} placeholder="Enter coupon code" /><button type="button" onClick={()=>void applyCoupon()} disabled={couponBusy||!couponCode.trim()}>{couponBusy?"Checking…":"Apply"}</button></div>{couponMessage&&<small className={couponPercent>0?"coupon-success":"coupon-error"} role="status">{couponMessage}</small>}</div><div className="summary-total"><span>Order total</span><strong>{zone ? money(total) : 'Choose a delivery zone'}</strong></div><div className="bkash-checkout-note"><img className="bkash-logo-image" src="https://www.logo.wine/a/logo/BKash/BKash-Logo.wine.svg" alt="bKash" /><span><strong>৳200 advance payment</strong><small>Pay ৳200 through bKash. The remaining {money(Math.max(0,total-200))} is payable on delivery.</small></span></div>{checkout.error && <p className="form-error" role="alert">{checkout.error.message}</p>}<button className="button button-burgundy" type="submit" disabled={!zoneId || checkout.isPending}>{checkout.isPending ? "Preparing your order…" : "Continue to bKash payment"}<ArrowRight /></button><p className="checkout-consent">{(cart?.subtotal??0)>=2000?"Free delivery unlocked on orders of ৳2,000 or more.":totalWeight>1000?"Orders over 1 kg include a ৳20 handling surcharge.":"Delivery is ৳60 inside Rajshahi and ৳115 outside Rajshahi."} By placing your order, you agree to our terms and delivery policy.</p></aside>
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
  const [trxId, setTrxId] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const query = storeApi.store.orderSuccess.useQuery({ orderNumber, phone: verifiedPhone }, { enabled: Boolean(verifiedPhone), retry: false });
  const paymentSettings = storeApi.store.settings.useQuery();
  const payment = storeApi.store.submitBkashPayment.useMutation({ onSuccess: async () => { setTrxId(""); await query.refetch(); } });
  const bkashNumber = String(paymentSettings.data?.bkashNumber ?? "").trim();
  const bkashPaymentType = paymentSettings.data?.bkashPaymentType === "merchant" ? "merchant" : "personal";
  const order = query.data?.order;
  const paymentStatus = order?.advancePaymentStatus;
  const submitPayment = (event: FormEvent) => {
    event.preventDefault();
    if (!verifiedPhone || !orderNumber) return;
    payment.mutate({ orderNumber, phone: verifiedPhone, trxId: trxId.trim(), senderPhone: senderPhone.trim() });
  };
  return <PageShell><section className="success-page">
    <div className="success-hero"><span className="success-check"><Check /></span><p>ORDER RECEIVED</p><h1>Your signature<br /><em>is on its way.</em></h1><span>Order <strong>{orderNumber}</strong></span><p>Your order is reserved. Complete the ৳200 bKash advance and our team will verify it manually before fulfilment.</p></div>
    {!verifiedPhone ? <form className="verify-order" onSubmit={(e) => { e.preventDefault(); setVerifiedPhone(phone); }}><label>Confirm your mobile number to view this order<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button button-burgundy">View order</button></form> : query.isLoading ? <LoadingState label="Retrieving your order…" /> : query.error ? <ErrorState message={query.error.message} /> : query.data ? <>
      <div className="success-details">
        <div className="success-status"><PackageCheck /><div><p>Current order status</p><h2>{query.data.order.status}</h2></div><strong>{money(query.data.order.total)}</strong></div>
        <div className="success-grid"><div><h3>Delivery to</h3><p>{query.data.order.customerName}<br />{query.data.order.address}<br />{query.data.order.area}, {query.data.order.district}<br />{query.data.order.phone}</p></div><div><h3>Your fragrances</h3>{query.data.items.map((item: OrderLine) => <p key={item.id}>{item.productName} · {item.sizeMl}ml × {item.quantity}<strong>{money(item.lineTotal)}</strong></p>)}<p>Delivery <strong>{query.data.order.deliveryFee===0?"FREE":money(query.data.order.deliveryFee)}</strong></p>{query.data.order.discountAmount>0&&<p>Coupon discount <strong>−{money(query.data.order.discountAmount)}</strong></p>}{query.data.order.couponCode&&<p>Coupon code <strong>{query.data.order.couponCode}</strong></p>}</div></div>
        <div className="success-actions"><Link className="button button-burgundy" to="/track">Track this order <ArrowRight /></Link><Link className="text-link" to="/shop">Continue exploring <ArrowRight /></Link></div>
      </div>
      {order.advancePaymentRequired && <section className="bkash-payment-panel" aria-labelledby="bkash-payment-title">
        <div className="bkash-panel-top"><span className="bkash-brand-lockup"><img className="bkash-logo-image" src="https://www.logo.wine/a/logo/BKash/BKash-Logo.wine.svg" alt="bKash" /><span><small>SECURE MANUAL PAYMENT</small><strong id="bkash-payment-title">bKash advance</strong></span></span><span className="bkash-amount">৳{Number(order.advancePaymentAmount||200).toLocaleString("en-BD")}</span></div>
        {paymentStatus === "verified" ? <div className="bkash-state bkash-state-success"><Check /><div><strong>Advance payment verified</strong><p>Your ৳200 advance has been approved. Remaining cash on delivery: {money(Math.max(0,Number(order.total)-200))}.</p></div></div>
        : paymentStatus === "submitted" ? <div className="bkash-state bkash-state-pending"><Clock3 /><div><strong>Transaction submitted · awaiting review</strong><p>Our team will compare your TrxID with the bKash transaction record. Your order will move forward after approval.</p><small>Transaction ID: {order.bkashTrxId}</small><small>Sender: {order.bkashSenderPhone}</small></div></div>
        : <>
          <div className="bkash-instructions"><div className="bkash-step"><span>01</span><div><strong>Open your bKash app</strong><p>Choose <b>{bkashPaymentType === "merchant" ? "Payment" : "Send Money"}</b> and send exactly ৳200 to the number below.</p></div></div>
            <div className="bkash-receiver"><span>PAYMENT NUMBER</span><strong>{bkashNumber || "Store payment number not configured"}</strong>{bkashNumber && <button type="button" onClick={() => void navigator.clipboard?.writeText(bkashNumber)}>Copy number</button>}</div>
            <div className="bkash-step"><span>02</span><div><strong>Keep your transaction ID</strong><p>After the payment succeeds, copy the TrxID from your bKash confirmation.</p></div></div>
            <div className="bkash-step"><span>03</span><div><strong>Submit your payment details</strong><p>Enter the TrxID and the mobile number you paid from. We verify every payment manually.</p></div></div>
          </div>
          {paymentStatus === "rejected" && <div className="bkash-rejection"><strong>We could not verify the previous submission.</strong><p>{order.bkashReviewNote || "Please check the transaction details and submit again."}</p></div>}
          {!bkashNumber && <p className="bkash-config-notice">The store’s bKash receiving number is being configured. Please contact DEQANT before sending money.</p>}
          <form className="bkash-submit-form" onSubmit={submitPayment}>
            <label>Transaction ID (TrxID)<input required minLength={6} maxLength={32} autoComplete="off" value={trxId} onChange={e=>setTrxId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="Enter your bKash TrxID"/></label>
            <label>Sender mobile number<input required inputMode="tel" autoComplete="tel" value={senderPhone} onChange={e=>setSenderPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label>
            {payment.error && <p className="form-error" role="alert">{payment.error.message}</p>}
            <button className="button button-burgundy" disabled={payment.isPending || !bkashNumber}>{payment.isPending ? "Submitting your confirmation…" : "Submit to confirm your order"} <ArrowRight /></button>
            <small>Submitting details does not mean the payment is verified. Your order remains pending until an administrator approves it.</small>
          </form>
        </>}
        <div className="bkash-cod-note"><span>REMAINING ON DELIVERY</span><strong>{money(Math.max(0,Number(order.total)-200))}</strong><small>৳200 advance is deducted from your order total, not added on top.</small></div>
      </section>}
    </> : null}
  </section></PageShell>;
}
