import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, PackageCheck } from "lucide-react";
import { ErrorState, LoadingState, money, PageShell } from "@/components/Storefront";
import { useCart } from "@/providers/cart";
import { validateCoupon } from "@/lib/supabase";
import { storeApi } from "@/providers/store";
type DeliveryZone = { id:number; name:string; districts:string; fee:number };
type CheckoutLine = { id:number; product:{name:string;imageUrl:string;category:'decant'|'intact';shippingWeightGrams:number}; variant:{sizeMl:number}; quantity:number; lineTotal:number };
type CheckoutResult = { orderNumber:string; total:number };
type OrderLine = { id:number; productName:string; sizeMl:number; quantity:number; lineTotal:number };

const initialForm = { customerName: "", phone: "", email: "", address: "" };


export default function Checkout() {
  const { cart, isLoading, token, error: cartError, startFreshCart } = useCart();
  const zonesQuery = storeApi.store.zones.useQuery();
  const { data: zones } = zonesQuery;
  const [form, setForm] = useState(initialForm);
  const [zoneId, setZoneId] = useState("");
  const [trxId,setTrxId]=useState("");
  const [senderPhone,setSenderPhone]=useState("");
  const paymentSettings=storeApi.store.settings.useQuery();
  const bkashNumber=String(paymentSettings.data?.bkashNumber??"").trim();
  const bkashPaymentType=paymentSettings.data?.bkashPaymentType==="merchant"?"merchant":"personal";
  const [couponCode,setCouponCode]=useState("");
  const [couponPercent,setCouponPercent]=useState(0);
  const [couponMessage,setCouponMessage]=useState("");
  const [couponBusy,setCouponBusy]=useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const utils = storeApi.useUtils();
  const checkout = storeApi.store.checkout.useMutation({
    onSuccess: async (result: CheckoutResult) => { localStorage.setItem("deqant.lastOrderNumber", result.orderNumber); startFreshCart(); await utils.store.cart.invalidate(); navigate(`/order/${result.orderNumber}`, { state: { phone: form.phone, total: result.total } }); },
  });
  const zone = zones?.find((item: DeliveryZone) => String(item.id) === zoneId);
  const orderSubtotal=Math.max(0,Number(cart?.subtotal)||0);
  const totalWeight=(cart?.items??[]).reduce((sum:number,item:CheckoutLine)=>sum+(Math.max(1,Number(item.product.shippingWeightGrams)||(item.product.category==='intact'?500:100))*item.quantity),0);
  const deliveryFee=orderSubtotal>=2000?0:(zone?(Number(zone.fee)||0)+(totalWeight>1000?20:0):0);
  const safeCouponPercent=Math.min(100,Math.max(0,Number(couponPercent)||0));
  const discountAmount=Math.min(orderSubtotal,Math.floor(orderSubtotal*safeCouponPercent/100));
  const total=Math.max(0,orderSubtotal-discountAmount+deliveryFee);
  const advancePaymentAmount=200;
  const applyCoupon=async()=>{const requestedCode=couponCode.trim().toUpperCase();if(!requestedCode||!token)return;setCouponBusy(true);setCouponMessage("");try{const result:any=await validateCoupon(requestedCode,token);setCouponPercent(Number(result.discountPercent)||0);setCouponCode(String(result.code||requestedCode).toUpperCase());setCouponMessage(`${result.discountPercent}% discount applied.`);}catch(error){setCouponPercent(0);setCouponMessage(error instanceof Error?error.message:"Could not validate this coupon.");}finally{setCouponBusy(false);}};
  const update = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !zone || form.address.trim().length < 8 || !bkashNumber || trxId.trim().length<6 || !senderPhone.trim()) return;
    checkout.mutate({ ...form, trxId:trxId.trim(), senderPhone:senderPhone.trim(), token, couponCode:couponPercent?couponCode:"", idempotencyKey: idempotencyKey.current });
  };
  return <PageShell>
    <section className="checkout-page"><Link className="text-link" to="/cart"><ArrowLeft /> Back to bag</Link><div className="checkout-heading"><p>SECURE CHECKOUT</p><h1>Where shall we<br /><em>send your scent?</em></h1><span><LockKeyhole /> Pay the bKash advance before placing your order. We manually verify every transaction.</span></div>
      {isLoading ? <LoadingState /> : cartError ? <ErrorState message={cartError instanceof Error ? cartError.message : "Your cart could not be loaded. Please try again."} /> : !cart?.items.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Add a fragrance before continuing to checkout.</p><Link className="button button-burgundy" to="/shop">Explore collection</Link></div> : zonesQuery.isLoading ? <LoadingState label="Checking delivery options…" /> : zonesQuery.error ? <ErrorState message={zonesQuery.error instanceof Error ? zonesQuery.error.message : "Delivery options could not be loaded. Please try again."} /> : <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <fieldset><legend><span>01</span> Your details</legend><div className="form-grid"><label>Full name<input required minLength={2} autoComplete="name" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Your full name" /></label><label>Mobile number<input required minLength={11} autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" /></label><label className="full-field">Email <small>Optional, for your confirmation</small><input type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" /></label></div></fieldset>
<fieldset><legend><span>02</span> Delivery address</legend><div className="form-grid"><label className="full-field">Detailed delivery address<textarea required minLength={8} autoComplete="street-address" rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Enter your detailed delivery address" /></label></div></fieldset>
          <fieldset><legend><span>03</span> Delivery area</legend><div className="form-grid"><label className="full-field">Choose your delivery area<select required value={zoneId} onChange={e=>setZoneId(e.target.value)}><option value="">Select Inside or Outside Rajshahi</option>{(zones??[]).filter((item:DeliveryZone)=>item.name==="Inside Rajshahi"||item.name==="Outside Rajshahi").map((item:DeliveryZone)=><option key={item.id} value={String(item.id)}>{item.name} · {money(item.fee)}</option>)}</select></label></div>{zone&&<div className="zone-auto-note"><strong>{zone.name}</strong><span>{zone.districts}</span><b>{orderSubtotal>=2000?"FREE delivery on this order":money(zone.fee)+(totalWeight>1000?" + ৳20 weight surcharge":"")}</b></div>}</fieldset>
          <fieldset><legend><span>04</span> bKash advance payment</legend><div className="bkash-instructions"><div className="bkash-step"><span>01</span><div><strong>Send the advance using bKash</strong><p>Choose <b>Payment</b> and send exactly {money(advancePaymentAmount)} to the DEQANT number below.</p></div></div><div className="bkash-receiver"><span>PAYMENT NUMBER</span><strong>{bkashNumber||"Store payment number not configured"}</strong>{bkashNumber&&<button type="button" onClick={()=>void navigator.clipboard?.writeText(bkashNumber)}>Copy number</button>}</div><div className="bkash-step"><span>02</span><div><strong>Enter your transaction details</strong><p>After the payment succeeds, enter the TrxID and the mobile number you paid from. Your order is confirmed after our team verifies the payment.</p></div></div></div><div className="form-grid"><label>Transaction ID (TrxID)<input required minLength={6} maxLength={32} autoComplete="off" value={trxId} onChange={e=>setTrxId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="Enter your bKash TrxID"/></label><label>Sender mobile number<input required inputMode="tel" autoComplete="tel" minLength={11} maxLength={16} value={senderPhone} onChange={e=>setSenderPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label></div>{!bkashNumber&&<p className="form-error">The store’s bKash receiving number is not configured. Please contact DEQANT before placing your order.</p>}</fieldset>
        </div>
        <aside className="order-summary checkout-summary"><h2>Your order</h2>{cart.items.map((item: CheckoutLine) => <div className="checkout-item" key={item.id}><img src={item.product.imageUrl} alt="" /><span><strong>{item.product.name}</strong><small>{item.variant.sizeMl}ml × {item.quantity}</small></span><b>{money(item.lineTotal)}</b></div>)}<div><span>Subtotal</span><strong>{money(orderSubtotal)}</strong></div><div><span>Delivery</span><strong>{zone ? deliveryFee===0?"FREE":money(deliveryFee) : "Choose a district"}</strong></div>{couponPercent>0&&<div><span>Coupon ({couponCode})</span><strong>−{money(discountAmount)}</strong></div>}<div className="coupon-entry"><label htmlFor="checkout-coupon">Coupon code</label><div><input id="checkout-coupon" disabled={couponBusy} value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCouponPercent(0);setCouponMessage("");}} placeholder="Enter coupon code" /><button type="button" onClick={()=>void applyCoupon()} disabled={couponBusy||!couponCode.trim()}>{couponBusy?"Checking…":"Apply"}</button></div>{couponMessage&&<small className={couponPercent>0?"coupon-success":"coupon-error"} role="status">{couponMessage}</small>}</div><div className="summary-total"><span>Order total</span><strong>{zone ? money(total) : 'Choose a district'}</strong></div><div className="bkash-checkout-note"><img className="bkash-logo-image" src="https://www.logo.wine/a/logo/BKash/BKash-Logo.wine.svg" alt="bKash" /><span><strong>{money(advancePaymentAmount)} advance payment</strong><small>Remaining {money(Math.max(0,total-advancePaymentAmount))} is payable on delivery. Your order is confirmed only after manual payment approval.</small></span></div>{checkout.error && <p className="form-error" role="alert">{checkout.error.message}</p>}<button className="button button-burgundy" type="submit" disabled={!zone || form.address.trim().length<8 || !bkashNumber || trxId.trim().length<6 || !senderPhone.trim() || checkout.isPending || couponBusy || paymentSettings.isLoading}>{checkout.isPending ? "Placing your order…" : "Place order"}<ArrowRight /></button><p className="checkout-consent">{(cart?.subtotal??0)>=2000?"Free delivery unlocked on orders of ৳2,000 or more.":totalWeight>1000?"Orders over 1 kg include a ৳20 handling surcharge.":"Choose your delivery area above. Orders over 1 kg include a ৳20 handling surcharge."} By placing your order, you agree to our terms and delivery policy.</p></aside>
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
  const order = query.data?.order;
  const paymentStatus = order?.advancePaymentStatus;
  return <PageShell><section className="success-page">
    <div className="success-hero"><span className="success-check"><Check /></span><p>ORDER RECEIVED</p><h1>Your signature<br /><em>is on its way.</em></h1><span>Order <strong>{orderNumber}</strong></span><p>Your payment details have been received. Our team will manually verify the bKash transaction before confirming your order.</p></div>
    {!verifiedPhone ? <form className="verify-order" onSubmit={(e) => { e.preventDefault(); setVerifiedPhone(phone); }}><label>Confirm your mobile number to view this order<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button button-burgundy">View order</button></form> : query.isLoading ? <LoadingState label="Retrieving your order…" /> : query.error ? <ErrorState message={query.error.message} /> : query.data ? <>
      <div className="success-details">
        <div className="success-status"><PackageCheck /><div><p>Current order status</p><h2>{query.data.order.status}</h2></div><strong>{money(query.data.order.total)}</strong></div>
        <div className="success-grid"><div><h3>Delivery to</h3><p>{query.data.order.customerName}<br />{query.data.order.address}<br />{query.data.order.phone}</p></div><div><h3>Your fragrances</h3>{query.data.items.map((item: OrderLine) => <p key={item.id}>{item.productName} · {item.sizeMl}ml × {item.quantity}<strong>{money(item.lineTotal)}</strong></p>)}<p>Delivery <strong>{query.data.order.deliveryFee===0?"FREE":money(query.data.order.deliveryFee)}</strong></p>{query.data.order.discountAmount>0&&<p>Coupon discount <strong>−{money(query.data.order.discountAmount)}</strong></p>}{query.data.order.couponCode&&<p>Coupon code <strong>{query.data.order.couponCode}</strong></p>}</div></div>
        <div className="success-actions"><Link className="button button-burgundy" to="/track" state={{ orderNumber, phone: verifiedPhone }}>Track this order <ArrowRight /></Link><Link className="text-link" to="/shop">Continue exploring <ArrowRight /></Link></div>
      </div>
      {order.advancePaymentRequired && <section className="bkash-payment-panel" aria-labelledby="bkash-payment-title"><div className="bkash-panel-top"><span className="bkash-brand-lockup"><img className="bkash-logo-image" src="https://www.logo.wine/a/logo/BKash/BKash-Logo.wine.svg" alt="bKash"/><span><small>SECURE MANUAL PAYMENT</small><strong id="bkash-payment-title">bKash advance</strong></span></span><span className="bkash-amount">৳{Number(order.advancePaymentAmount??0).toLocaleString("en-BD")}</span></div>{paymentStatus==="verified"?<div className="bkash-state bkash-state-success"><Check/><div><strong>Advance payment verified</strong><p>Your order is now confirmed. Remaining cash on delivery: {money(Math.max(0,Number(order.total)-Number(order.advancePaymentAmount??0)))}.</p></div></div>:paymentStatus==="submitted"?<div className="bkash-state bkash-state-pending"><PackageCheck/><div><strong>Payment details received · under manual review</strong><p>Your order has been received but is not confirmed yet. Our team will verify your TrxID and sender number before approving it.</p><small>Transaction ID: {order.bkashTrxId}</small><small>Sender: {order.bkashSenderPhone}</small></div></div>:<div className="bkash-rejection"><strong>Payment review requires attention.</strong><p>{order.bkashReviewNote||"Please contact DEQANT support with your order number."}</p></div>}<div className="bkash-cod-note"><span>REMAINING ON DELIVERY</span><strong>{money(Math.max(0,Number(order.total)-Number(order.advancePaymentAmount??0)))}</strong><small>{money(Number(order.advancePaymentAmount??0))} advance is deducted from your order total, not added on top.</small></div></section>}
    </> : null}
  </section></PageShell>;
}
