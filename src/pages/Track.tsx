import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { Check, Package, Search, XCircle } from "lucide-react";
import { PageShell, money } from "@/components/Storefront";
import { storeApi } from "@/providers/store";

const statuses = ["received", "confirmed"];
export default function Track() {
 const location=useLocation(); const routeOrder=location.state as {orderNumber?:string;phone?:string}|null;
 const [orderNumber,setOrderNumber]=useState(()=>routeOrder?.orderNumber??(typeof window!=="undefined"?localStorage.getItem("deqant.lastOrderNumber")??"":""));
 const [phone,setPhone]=useState(()=>routeOrder?.phone??"");
 const [search,setSearch]=useState<{orderNumber:string;phone:string}|null>(()=>routeOrder?.orderNumber&&routeOrder?.phone?{orderNumber:routeOrder.orderNumber,phone:routeOrder.phone}:null);
 const query=storeApi.store.track.useQuery(search!,{enabled:Boolean(search),retry:false});
 const submit=(event:FormEvent)=>{event.preventDefault();setSearch({orderNumber:orderNumber.trim().toUpperCase(),phone:phone.trim()});};
 const activeIndex=query.data?statuses.indexOf(query.data.status):-1;
 return <PageShell><section className="track-page"><div className="track-intro"><p>CLIENT CARE</p><h1>Follow your<br/><em>fragrance.</em></h1><span>Enter your order ID and the mobile number used at checkout. We only show delivery status—never your private details.</span></div>
 <form className="tracking-form" onSubmit={submit}><label>Order ID<input required value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} placeholder="DQ-20261111-7F3A91C8D24B5E6A9F0C1B2D"/></label><label>Mobile number<input required minLength={8} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label><button className="button button-burgundy" disabled={query.isFetching}><Search/>{query.isFetching?"Finding order…":"Track order"}</button></form>
 {query.error&&<div className="tracking-error" role="alert">{query.error.message}</div>}
 {query.data&&<div className="tracking-result" aria-live="polite"><div className="tracking-summary"><Package/><div><p>ORDER {query.data.orderNumber}</p><h2>{query.data.status==="cancelled"?"This order was cancelled":query.data.status==="confirmed"?"Your order is confirmed":"Your order is pending"}</h2><span>Placed {query.data.createdAt.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · {money(query.data.total)}</span></div></div>
 {query.data.status==="cancelled"?<div className="status-timeline cancelled" aria-label="Order status: cancelled"><div className="complete current"><span><XCircle/></span><strong>cancelled</strong><small>Order cancelled</small></div></div>:<div className="status-timeline" aria-label={"Order progress: "+query.data.status}>{statuses.map((status,index)=><div key={status} className={(index<=activeIndex?"complete ":"")+(index===activeIndex?"current":"")}><span className={status==="confirmed"&&index===activeIndex?"confirmed-fireworks":undefined}>{index<activeIndex?<Check/>:index+1}{status==="confirmed"&&index===activeIndex&&<span className="confirmed-firework-burst" aria-hidden="true">{Array.from({length:12},(_,particle)=><i key={particle}/>)}</span>}</span><strong>{status==="received"?"Pending":status}</strong><small>{index===activeIndex?(status==="received"?"Payment review in progress":"Current status"):index<activeIndex?"Completed":"After payment approval"}</small></div>)}</div>}
 {query.data.status==="received"&&<p className="tracking-cancel-closed">Your bKash transaction details have been received. DEQANT will confirm the order after manually verifying the payment.</p>}</div>}
 <div className="tracking-help"><h2>Need a hand?</h2><p>If your tracking details are unavailable or your order seems delayed, our concierge can help.</p><a className="text-link" href="mailto:concierge@deqant.com">Contact concierge</a></div></section></PageShell>;
}
