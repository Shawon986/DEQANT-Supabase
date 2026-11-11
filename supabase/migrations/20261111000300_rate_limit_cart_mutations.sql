-- Apply per-IP throttles to guest cart mutations and reject missing capability tokens.
create or replace function public.cart_update(p_token uuid,p_item_id bigint,p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare c public.carts; v public.product_variants;
begin
  perform public.consume_rate_limit('cart_update',120,60);
  if p_token is null then raise exception 'A cart token is required.' using errcode='22023'; end if;
  if p_quantity<1 or p_quantity>10 then raise exception 'Quantity must be between 1 and 10.'; end if;
  select * into c from public.carts where token=p_token;
  if not found then raise exception 'Cart not found.'; end if;
  select pv.* into v from public.cart_items ci
    join public.product_variants pv on pv.id=ci.variant_id
    where ci.id=p_item_id and ci.cart_id=c.id;
  if not found or p_quantity>v.stock then raise exception 'Requested quantity is unavailable.'; end if;
  update public.cart_items set quantity=p_quantity where id=p_item_id and cart_id=c.id;
  return public.cart_read(c.token);
end;
$function$;

create or replace function public.cart_remove(p_token uuid,p_item_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare c public.carts;
begin
  perform public.consume_rate_limit('cart_remove',120,60);
  if p_token is null then raise exception 'A cart token is required.' using errcode='22023'; end if;
  select * into c from public.carts where token=p_token;
  if found then delete from public.cart_items where id=p_item_id and cart_id=c.id; end if;
  return public.cart_read(p_token);
end;
$function$;
