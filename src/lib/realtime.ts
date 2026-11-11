import { createClient } from "@supabase/supabase-js";
import { getAccessToken } from "@/lib/supabase";

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;

export function subscribeStoreChanges(onChange:(table:string)=>void){
 if(!url||!key)return()=>undefined;
 const client=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  accessToken:async()=>await getAccessToken()??key,
 });
 const tables=["products","product_variants","product_ratings","website_settings","orders","coupons","contact_messages"] as const;
 let channel=client.channel("deqant-store-live");
 for(const table of tables){
  channel=channel.on("postgres_changes",{event:"*",schema:"public",table},()=>onChange(table));
 }
 channel.subscribe();
 return()=>{void client.removeChannel(channel);};
}
