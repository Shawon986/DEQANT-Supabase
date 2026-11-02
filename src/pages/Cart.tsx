import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { LoadingState, money, PageShell } from "@/components/Storefront";
import { useCart } from "@/providers/cart";

export default function Cart() {
  const { cart, isLoading, update, remove, isMutating } = useCart();
  return <PageShell>
    <section className="cart-page">
      <div className="cart-heading"><p>YOUR FRAGRANCE WARDROBE</p><h1>Shopping bag</h1><span>{cart?.count ?? 0} {cart?.count === 1 ? "item" : "items"}, each chosen by you.</span></div>
      {isLoading ? <LoadingState label="Opening your fragrance wardrobe…" /> : !cart?.items.length ? <div className="empty-state cart-empty"><ShoppingBag /><h2>Your bag is waiting for a signature.</h2><p>Begin with a decant, or choose an intact bottle from our collection.</p><Link className="button button-burgundy" to="/shop">Explore fragrances <ArrowRight /></Link></div> : <div className="cart-layout">
        <div className="cart-items">{cart.items.map((item) => <article className="cart-item" key={item.id}>
          <Link to={`/product/${item.product.slug}`}><img src={item.product.imageUrl} alt={item.product.name} /></Link>
          <div className="cart-item-info"><p>{item.product.brand} · {item.product.category === "decant" ? "Decant" : "Intact bottle"}</p><Link to={`/product/${item.product.slug}`}><h2>{item.product.name}</h2></Link><span>{item.variant.sizeMl}ml · {money(item.variant.price)} each</span>{item.variant.originalPrice > item.variant.price && <small>You save {money((item.variant.originalPrice - item.variant.price) * item.quantity)}</small>}
            <div className="cart-item-actions"><div className="quantity"><button disabled={isMutating || item.quantity <= 1} onClick={() => update(item.id, item.quantity - 1)} aria-label={`Decrease ${item.product.name} quantity`}><Minus /></button><span>{item.quantity}</span><button disabled={isMutating || item.quantity >= Math.min(10, item.variant.stock)} onClick={() => update(item.id, item.quantity + 1)} aria-label={`Increase ${item.product.name} quantity`}><Plus /></button></div><button className="remove-button" disabled={isMutating} onClick={() => remove(item.id)}><Trash2 /> Remove</button></div>
          </div><strong className="cart-line-total">{money(item.lineTotal)}</strong>
        </article>)}</div>
        <aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><div><span>Delivery</span><span>Calculated at checkout</span></div><p>Choose your delivery zone on the next step to see the exact fee.</p><div className="summary-total"><span>Current total</span><strong>{money(cart.subtotal)}</strong></div><Link className="button button-burgundy" to="/checkout">Continue to checkout <ArrowRight /></Link><Link className="text-link" to="/shop"><ArrowLeft /> Continue shopping</Link></aside>
      </div>}
    </section>
  </PageShell>;
}
