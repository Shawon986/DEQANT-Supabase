import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {toast} from "sonner";
import {storeApi} from "@/providers/store";

type CartContextValue={
  token:string|null;
  cart:any;
  isLoading:boolean;
  error:unknown;
  refetch:()=>Promise<unknown>;
  add:(variantId:number,quantity?:number)=>void;
  update:(itemId:number,quantity:number)=>void;
  remove:(itemId:number)=>void;
  isMutating:boolean;
};
const CartContext=createContext<CartContextValue|null>(null);

export function CartProvider({children}:{children:ReactNode}){
  const[token,setToken]=useState<string|null>(()=>{let t=localStorage.getItem("deqant-cart-token");if(!t){t=crypto.randomUUID();localStorage.setItem("deqant-cart-token",t);}return t;});
  const query=storeApi.store.cart.useQuery({token},{retry:false});
  useEffect(()=>{if(query.data?.token&&query.data.token!==token){localStorage.setItem("deqant-cart-token",query.data.token);setToken(query.data.token);}},[query.data?.token,token]);
  const utils=storeApi.useUtils();
  const refresh=()=>utils.store.cart.invalidate();
  const onError=(e:{message:string})=>toast.error(e.message);
  const addMutation=storeApi.store.addToCart.useMutation({onSuccess:(data:any)=>{if(data?.token){localStorage.setItem("deqant-cart-token",data.token);setToken(data.token);}void refresh();toast.success("Added to your fragrance wardrobe");},onError});
  const updateMutation=storeApi.store.updateCartItem.useMutation({onSuccess:refresh,onError});
  const removeMutation=storeApi.store.removeCartItem.useMutation({onSuccess:()=>{void refresh();toast.message("Removed from your cart");},onError});
  const value=useMemo<CartContextValue>(()=>({
    token,cart:query.data,isLoading:query.isLoading,error:query.error,
    refetch:()=>query.refetch(),
    add:(id,q=1)=>{if(token)addMutation.mutate({token,variantId:id,quantity:q});},
    update:(id,q)=>{if(token)updateMutation.mutate({token,itemId:id,quantity:q});},
    remove:(id)=>{if(token)removeMutation.mutate({token,itemId:id});},
    isMutating:addMutation.isPending||updateMutation.isPending||removeMutation.isPending
  }),[token,query.data,query.isLoading,query.error,query.refetch,addMutation,updateMutation,removeMutation]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart(){const value=useContext(CartContext);if(!value)throw new Error("useCart must be used within CartProvider");return value;}
