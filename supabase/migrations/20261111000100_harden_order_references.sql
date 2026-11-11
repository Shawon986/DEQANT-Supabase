begin;

-- Increase guest order-reference entropy from 24 bits to 96 bits.
-- Existing order numbers remain valid; only newly created orders use the stronger format.
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
  p_zone_id bigint,
  p_coupon_code text default null::text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  c public.carts; z public.delivery_zones; o public.orders; cp public.coupons;
  line record; sub integer:=0; discount integer:=0; delivery integer:=0;
  total_weight integer:=0; onum text; normalized_coupon text:=nullif(upper(trim(coalesce(p_coupon_code,''))), '');
begin
  perform public.consume_rate_limit('checkout',8,600);
  if length(trim(p_customer_name))<2 or length(trim(p_phone))<8 or length(trim(p_phone))>30 or length(trim(p_address))<8 then
    raise exception 'Please check your name, phone and delivery address.';
  end if;
  select * into o from public.orders where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount); end if;
  select * into c from public.carts where token=p_token;
  if not found or not exists(select 1 from public.cart_items where cart_id=c.id) then raise exception 'Your cart is empty.'; end if;
  select * into z from public.delivery_zones where id=p_zone_id and active;
  if not found then raise exception 'Select a valid delivery zone.'; end if;
  for line in
    select ci.quantity,v.id as variant_id,v.size_ml,v.price,v.original_price,v.stock,
      p.id as product_id,p.name,p.brand,p.category,p.active as product_active,
      v.active as variant_active,p.shipping_weight_grams
    from public.cart_items ci join public.product_variants v on v.id=ci.variant_id
    join public.products p on p.id=v.product_id where ci.cart_id=c.id for update of v
  loop
    if not line.product_active or not line.variant_active or line.stock<line.quantity then
      raise exception 'Stock changed while you were checking out. Please review your cart.';
    end if;
    sub:=sub+(line.price*line.quantity);
    total_weight:=total_weight+(line.shipping_weight_grams*line.quantity);
  end loop;
  delivery:=case when sub>=2000 then 0 else z.fee + case when total_weight>1000 then 20 else 0 end end;
  if normalized_coupon is not null then
    select * into cp from public.coupons where code=normalized_coupon and active
      and (expires_at is null or expires_at>now())
      and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'This coupon is invalid, expired, or has reached its usage limit.'; end if;
    discount:=floor(sub*cp.discount_percent/100.0)::integer;
  end if;
  onum:='DQ-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
  insert into public.orders(order_number,idempotency_key,customer_name,phone,email,district,area,address,instructions,delivery_zone_id,subtotal,delivery_fee,total,coupon_code,discount_amount)
  values(onum,p_idempotency_key,trim(p_customer_name),trim(p_phone),nullif(trim(p_email),''),trim(p_district),trim(p_area),trim(p_address),nullif(trim(p_instructions),''),z.id,sub,delivery,sub-discount+delivery,normalized_coupon,discount)
  returning * into o;
  for line in
    select ci.quantity,v.id as variant_id,v.size_ml,v.price,v.original_price,p.id as product_id,p.name,p.brand,p.category
    from public.cart_items ci join public.product_variants v on v.id=ci.variant_id
    join public.products p on p.id=v.product_id where ci.cart_id=c.id for update of v
  loop
    update public.product_variants set stock=stock-line.quantity where id=line.variant_id;
    insert into public.order_items(order_id,product_id,variant_id,product_name,brand,category,size_ml,quantity,unit_price,original_price,line_total)
    values(o.id,line.product_id,line.variant_id,line.name,line.brand,line.category,line.size_ml,line.quantity,line.price,line.original_price,line.price*line.quantity);
  end loop;
  if normalized_coupon is not null then update public.coupons set usage_count=usage_count+1 where id=cp.id; end if;
  delete from public.cart_items where cart_id=c.id;
  return jsonb_build_object('orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount);
end;
$function$;

-- Lower unauthenticated order lookup and tracking attempts per IP from 30 to 10 per 10 minutes.
create or replace function public.order_by_phone(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare o public.orders; items jsonb;
begin
  perform public.consume_rate_limit('order_lookup',10,600);
  select * into o from public.orders
   where order_number=upper(trim(p_order_number)) and phone=trim(p_phone);
  if not found then raise exception 'We could not find an order with those details.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'productName',i.product_name,'brand',i.brand,'category',i.category,
    'sizeMl',i.size_ml,'quantity',i.quantity,'unitPrice',i.unit_price,
    'originalPrice',i.original_price,'lineTotal',i.line_total
  )),'[]'::jsonb) into items from public.order_items i where i.order_id=o.id;
  return jsonb_build_object(
    'order',jsonb_build_object(
      'id',o.id,'orderNumber',o.order_number,'customerName',o.customer_name,'phone',o.phone,
      'email',o.email,'district',o.district,'area',o.area,'address',o.address,
      'instructions',o.instructions,'subtotal',o.subtotal,'deliveryFee',o.delivery_fee,
      'discountAmount',o.discount_amount,'couponCode',o.coupon_code,'total',o.total,
      'status',o.status,'created_at',o.created_at,
      'advancePaymentRequired',o.advance_payment_required,
      'advancePaymentAmount',o.advance_payment_amount,
      'advancePaymentStatus',o.advance_payment_status,
      'bkashTrxId',o.bkash_trx_id,'bkashSenderPhone',o.bkash_sender_phone,
      'bkashSubmittedAt',o.bkash_submitted_at,'bkashReviewedAt',o.bkash_reviewed_at,
      'bkashReviewNote',o.bkash_review_note
    ),
    'items',items
  );
end;
$function$;

create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare o public.orders;
begin
  perform public.consume_rate_limit('tracking',10,600);
  select * into o from public.orders
   where order_number=upper(trim(p_order_number)) and phone=trim(p_phone);
  if not found then raise exception 'No matching order. Check your order ID and phone number.'; end if;
  return jsonb_build_object('orderNumber',o.order_number,'status',o.status,'total',o.total,'created_at',o.created_at);
end;
$function$;

-- Keep cancellation's existing 10-per-10-minute limit; harden its function search path.
alter function public.cancel_order(text,text) set search_path = pg_catalog, public;

commit;