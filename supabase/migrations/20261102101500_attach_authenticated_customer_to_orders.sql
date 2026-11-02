-- Associate signed-in checkouts with the authenticated customer.
-- Guest checkouts continue to store NULL in customer_id.
create or replace function public.place_order(
 p_token uuid,
 p_idempotency_key uuid,
 p_customer_name text,
 p_phone text,
 p_email text,
 p_district text,
 p_area text,
 p_address text,
 p_instructions text,
 p_zone_id bigint
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
 c public.carts;
 z public.delivery_zones;
 o public.orders;
 line record;
 sub integer := 0;
 onum text;
begin
 perform public.consume_rate_limit('checkout', 8, 600);
 if length(trim(p_customer_name)) < 2 or length(trim(p_phone)) < 8 or length(trim(p_phone)) > 30 or length(trim(p_address)) < 8 then
  raise exception 'Please check your name, phone and delivery address.';
 end if;
 select * into o from public.orders where idempotency_key = p_idempotency_key;
 if found then
  return jsonb_build_object('orderNumber', o.order_number, 'total', o.total);
 end if;
 select * into c from public.carts where token = p_token;
 if not found then raise exception 'Your cart is empty.'; end if;
 if not exists(select 1 from public.cart_items where cart_id = c.id) then raise exception 'Your cart is empty.'; end if;
 select * into z from public.delivery_zones where id = p_zone_id and active;
 if not found then raise exception 'Select a valid delivery zone.'; end if;
 for line in
  select ci.id as cart_item_id, ci.quantity, v.id as variant_id, v.size_ml, v.price, v.original_price, v.stock,
         p.id as product_id, p.name, p.brand, p.category, p.active as product_active, v.active as variant_active
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = c.id
  for update of v
 loop
  if not line.product_active or not line.variant_active or line.stock < line.quantity then
   raise exception 'Stock changed while you were checking out. Please review your cart.';
  end if;
  sub := sub + (line.price * line.quantity);
 end loop;
 onum := 'DQ-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
 insert into public.orders(
  customer_id, order_number, idempotency_key, customer_name, phone, email, district, area, address,
  instructions, delivery_zone_id, subtotal, delivery_fee, total
 )
 values (
  auth.uid(), onum, p_idempotency_key, trim(p_customer_name), trim(p_phone), nullif(trim(p_email), ''),
  trim(p_district), trim(p_area), trim(p_address), nullif(trim(p_instructions), ''), z.id, sub, z.fee, sub + z.fee
 ) returning * into o;
 for line in
  select ci.quantity, v.id as variant_id, v.size_ml, v.price, v.original_price,
         p.id as product_id, p.name, p.brand, p.category
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = c.id
  for update of v
 loop
  update public.product_variants set stock = stock - line.quantity where id = line.variant_id;
  insert into public.order_items(
   order_id, product_id, variant_id, product_name, brand, category, size_ml, quantity, unit_price, original_price, line_total
  ) values (
   o.id, line.product_id, line.variant_id, line.name, line.brand, line.category, line.size_ml, line.quantity,
   line.price, line.original_price, line.price * line.quantity
  );
 end loop;
 delete from public.cart_items where cart_id = c.id;
 return jsonb_build_object('orderNumber', o.order_number, 'total', o.total);
end;
$function$;
