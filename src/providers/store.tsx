import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import * as db from "@/lib/supabase";
const client = new QueryClient({defaultOptions:{queries:{staleTime:20_000,retry:1,refetchOnWindowFocus:true},mutations:{retry:0}}});
const key=(name:string,input?:unknown)=>["supabase",name,input];
const publicQueryNames = new Set(["catalog","product","settings","zones"]);
function query(name:string,fn:(input:any)=>Promise<any>){return {useQuery:(input?:any,options:any={})=>useQuery({queryKey:key(name,input),queryFn:()=>fn(input),staleTime:options.staleTime??(publicQueryNames.has(name)?60_000:20_000),...options})};}
function mutation(fn:(input:any)=>Promise<any>,invalidate:string[]=[]){return {useMutation:(options:any={})=>{const qc=useQueryClient();return useMutation({mutationFn:fn,onSuccess:async(data,vars,ctx)=>{for(const n of invalidate)await qc.invalidateQueries({queryKey:["supabase",n]});await options.onSuccess?.(data,vars,ctx);},onError:options.onError});}};}
export const storeApi:any={
 useUtils:()=>{const qc=useQueryClient();return{store:{cart:{invalidate:()=>qc.invalidateQueries({queryKey:["supabase","cart"]})},catalog:{invalidate:()=>qc.invalidateQueries({queryKey:["supabase","catalog"]})}},invalidate:()=>qc.invalidateQueries()};},
 auth:{me:query("profile",()=>db.getProfile()),orders:query("my-orders",()=>db.listMyOrders()),logout:mutation(()=>db.signOut(),["profile","my-orders"])},
 store:{
  catalog:query("catalog",(i)=>db.catalog(i)),product:query("product",(i)=>db.productBySlug(i.slug)),productRating:query("product-rating",(i)=>db.productRating(i.productId)),settings:query("settings",()=>db.settings()),zones:query("zones",()=>db.zones()),cart:query("cart",(i)=>db.getCart(i?.token??null)),
  addToCart:mutation((i)=>db.addCart(i.token,i.variantId,i.quantity),["cart"]),updateCartItem:mutation((i)=>db.updateCart(i.token,i.itemId,i.quantity),["cart"]),removeCartItem:mutation((i)=>db.removeCart(i.token,i.itemId),["cart"]),
  checkout:mutation(db.checkout,["cart"]),validateCoupon:mutation(db.validateCoupon),submitProductRating:mutation((i)=>db.submitProductRating(i.productId,i.rating),["product-rating","catalog","product"]),submitBkashPayment:mutation(db.submitBkashPayment),orderSuccess:query("order-success",async(i)=>{const d=await db.orderByPhone(i);return{order:{...d.order,createdAt:new Date(d.order.created_at)},items:d.items};}),track:query("track",async(i)=>{const d=await db.trackOrder(i);return{...d,createdAt:new Date(d.created_at)};}),cancelOrder:mutation(db.cancelOrder,["track","my-orders"]),contact:mutation(db.sendContact)
 }
};
function RealtimeSync(){
 const qc=useQueryClient();
 useEffect(()=>{
  let active=true;let cleanup:(()=>void)|undefined;
  void import("@/lib/realtime").then(({subscribeStoreChanges})=>{
   if(!active)return;
   cleanup=subscribeStoreChanges((table)=>{
    if(table==="products"||table==="product_variants"){db.invalidateCatalogCache();void qc.invalidateQueries({queryKey:["supabase","catalog"]});void qc.invalidateQueries({queryKey:["supabase","product"]});}
    if(table==="product_ratings"){db.invalidateCatalogCache();void qc.invalidateQueries({queryKey:["supabase","catalog"]});void qc.invalidateQueries({queryKey:["supabase","product-rating"]});void qc.invalidateQueries({queryKey:["supabase","product"]});}
    if(table==="website_settings")void qc.invalidateQueries({queryKey:["supabase","settings"]});
    if(table==="orders")void qc.invalidateQueries({queryKey:["supabase","my-orders"]});
    window.dispatchEvent(new CustomEvent("deqant:database-change",{detail:{table}}));
   });
  }).catch(()=>undefined);
  return()=>{active=false;cleanup?.();};
 },[qc]);
 return null;
}
export function SupabaseProvider({children}:{children:ReactNode}){return <QueryClientProvider client={client}><RealtimeSync/>{children}</QueryClientProvider>;}
