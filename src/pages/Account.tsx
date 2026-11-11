import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Clock3, LogOut, Package, ShieldCheck, ShoppingBag, UserRound, XCircle } from "lucide-react";
import { LoadingState, money, PageShell } from "@/components/Storefront";
import { signOut } from "@/lib/supabase";
import { storeApi } from "@/providers/store";

type AccountOrder = {
  id: number; order_number: string; customer_name: string; phone: string;
  district: string; area: string; subtotal: number; delivery_fee: number;
  total: number; discount_amount:number; coupon_code:string|null; advance_payment_required:boolean; advance_payment_amount:number; advance_payment_status:string; payment_method: string; status: string; created_at: string;
  order_items?: Array<{ id: number; product_name: string; size_ml: number; quantity: number; line_total: number }>;
};

export default function Account() {
  const navigate = useNavigate();
  const queryClient = storeApi.useUtils();
  const [now, setNow] = useState(() => Date.now());
  const cancelMutation = storeApi.store.cancelOrder.useMutation();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const profileQuery = storeApi.auth.me.useQuery();
  const profile = profileQuery.data;
  const ordersQuery = storeApi.auth.orders.useQuery(undefined, { enabled: Boolean(profile), retry: false });
  useEffect(() => {
    if (!profileQuery.isLoading && !profileQuery.error && !profile) navigate("/login?next=%2Faccount", { replace: true });
  }, [profile, profileQuery.isLoading, profileQuery.error, navigate]);
  const cancelOrder = async (order: AccountOrder) => {
    if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
    try { await cancelMutation.mutateAsync({ orderNumber: order.order_number, phone: order.phone }); await ordersQuery.refetch(); }
    catch { /* The mutation error is shown in the order card. */ }
  };
  const logout = async () => {
    await signOut();
    await queryClient.invalidate();
    navigate("/", { replace: true });
  };
  if (profileQuery.isLoading || (!profile && !profileQuery.error)) return <PageShell><LoadingState label="Opening your DEQANT account…" /></PageShell>;
  if (profileQuery.error) return <PageShell><section className="account-page"><div className="account-empty"><h1>We couldn’t verify your session.</h1><p>Please sign in again to securely access your account.</p><Link className="button button-burgundy" to="/login">Sign in</Link></div></section></PageShell>;
  if (!profile) return null;
  const orders = (ordersQuery.data ?? []) as AccountOrder[];
  return <PageShell>
    <section className="account-page">
      <div className="account-heading"><div><p>YOUR PRIVATE SPACE</p><h1>Welcome back,<br/><em>{profile.full_name || "Fragrance lover"}.</em></h1><span>Your DEQANT account and order history, together in one place.</span></div><button className="account-signout" onClick={() => void logout()}><LogOut size={16}/> Sign out</button></div>
      <div className="account-profile-card"><span className="account-avatar"><UserRound/></span><div><small>ACCOUNT HOLDER</small><strong>{profile.full_name || "DEQANT customer"}</strong><span>{profile.email}</span></div><ShieldCheck className="account-verified" size={22}/></div>
      <div className="account-orders-heading"><div><p>YOUR PURCHASES</p><h2>Order history</h2></div><Link to="/track">Track an order <ArrowRight size={15}/></Link></div>
      {ordersQuery.isLoading ? <LoadingState label="Retrieving your orders…"/> : ordersQuery.error ? <div className="account-empty"><p>We couldn’t load your order history. Your orders remain safe—please try again.</p><button className="button button-burgundy" onClick={() => void ordersQuery.refetch()}>Try again</button></div> : orders.length ? <div className="account-order-list">{orders.map(order => <article key={order.id}><div className="account-order-top"><div><small>ORDER REFERENCE</small><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</span></div><span className={`account-order-status status-${order.status}`}>{order.status}</span><Link className="text-link" to="/track" state={{ orderNumber: order.order_number, phone: order.phone }}>Track order <ArrowRight size={14}/></Link></div><div className="account-order-items">{(order.order_items ?? []).map(item => <div key={item.id}><span>{item.product_name} · {item.size_ml}ml × {item.quantity}</span><strong>{money(item.line_total)}</strong></div>)}</div><div className="account-order-bottom"><span>{order.area}, {order.district} · {order.advance_payment_required ? `${money(order.advance_payment_amount)} bKash advance · ${money(Math.max(0,order.total-order.advance_payment_amount))} cash on delivery (${order.advance_payment_status==='verified'?'advance verified':order.advance_payment_status==='submitted'?'awaiting payment review':order.advance_payment_status==='rejected'?'advance rejected':'advance required'})` : 'Cash on delivery'}</span><strong>{money(order.total)}</strong></div>{order.status === "cancelled" ? <p className="account-cancel-note">This order has been cancelled.</p> : ["pending","confirmed","processing"].includes(order.status) && new Date(order.created_at).getTime() + 3 * 60 * 60 * 1000 > now ? <div className="account-cancel-row"><span><Clock3 size={14}/> Cancellation available for {(() => { const left = Math.max(0, Math.floor((new Date(order.created_at).getTime() + 3 * 60 * 60 * 1000 - now) / 1000)); return [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map(v => String(v).padStart(2,"0")).join(":"); })()}</span><button onClick={() => void cancelOrder(order)} disabled={cancelMutation.isPending}><XCircle size={14}/>{cancelMutation.isPending ? "Cancelling…" : "Cancel order"}</button></div> : ["pending","confirmed","processing"].includes(order.status) ? <p className="account-cancel-note">The 3-hour cancellation period has ended.</p> : null}{cancelMutation.error && <p className="account-cancel-error">{cancelMutation.error.message}</p>}</article>)}</div> : <div className="account-empty"><Package size={28}/><h3>Your fragrance story starts here.</h3><p>Orders placed while signed in will appear here. You can also place an order as a guest without creating an account.</p><Link className="button button-burgundy" to="/shop"><ShoppingBag size={16}/> Explore fragrances</Link></div>}
      <div className="account-guest-note"><strong>Prefer checkout without an account?</strong><span>Guest checkout is always available. Just add your fragrance to the bag and continue to checkout.</span><Link to="/shop">Continue as guest <ArrowRight size={14}/></Link></div>
    </section>
  </PageShell>;
}
