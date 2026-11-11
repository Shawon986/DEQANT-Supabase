-- Repair customer order lookup, restore cart weight data, and make the bKash advance
-- amount safe for discounted orders whose payable total is below ৳200.

create or replace function public.normalize_bd_phone(p_phone text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $function$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as value
  )
  select case
    when length(value) = 13 and left(value, 3) = '880' then '0' || substr(value, 4)
    when length(value) = 10 then '0' || value
    else value
  end
  from digits;
$function$;

revoke all on function public.normalize_bd_phone(text) from public, anon, authenticated;

-- Preserve the product's configured shipping weight in the cart response.
-- The checkout preview must use the same weight as place_order().
create or replace function public.cart_read(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  c public.carts;
  result jsonb;
begin
  perform public.consume_rate_limit('cart_read:' || md5(coalesce(p_token::text, 'missing')), 120, 60);
  if p_token is null then
    raise exception 'A cart token is required.' using errcode = '22023';
  end if;

  select * into c from public.carts where token = p_token;
  if not found then
    insert into public.carts(token) values (p_token) returning * into c;
  end if;

  select jsonb_build_object(
    'token', c.token,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ci.id,
          'quantity', ci.quantity,
          'variant', jsonb_build_object(
            'id', v.id,
            'sizeMl', v.size_ml,
            'price', v.price,
            'originalPrice', v.original_price,
            'stock', v.stock
          ),
          'product', jsonb_build_object(
            'id', p.id,
            'slug', p.slug,
            'name', p.name,
            'brand', p.brand,
            'category', p.category,
            'imageUrl', p.image_url,
            'shippingWeightGrams', p.shipping_weight_grams
          ),
          'lineTotal', v.price * ci.quantity
        ) order by ci.created_at
      ) filter (where ci.id is not null),
      '[]'::jsonb
    ),
    'subtotal', coalesce(sum(v.price * ci.quantity), 0),
    'count', coalesce(sum(ci.quantity), 0)
  )
  into result
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = c.id;

  return result;
end;
$function$;

-- Match Bangladesh numbers independent of spaces, hyphens, or +880/880 prefix.
-- Rate-limit each order/phone pair separately so one visitor cannot block all tracking.
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  o public.orders;
  normalized_order text := upper(trim(coalesce(p_order_number, '')));
  normalized_phone text := public.normalize_bd_phone(p_phone);
begin
  perform public.consume_rate_limit(
    'tracking:' || md5(normalized_order || ':' || coalesce(normalized_phone, '')),
    10,
    600
  );

  if normalized_order = '' or normalized_phone = '' then
    raise exception 'Enter your order ID and the mobile number used at checkout.';
  end if;

  select * into o
  from public.orders
  where order_number = normalized_order
    and public.normalize_bd_phone(phone) = normalized_phone;

  if not found then
    raise exception 'No matching order. Check your order ID and phone number.';
  end if;

  return jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.status,
    'total', o.total,
    'created_at', o.created_at
  );
end;
$function$;

create or replace function public.order_by_phone(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  o public.orders;
  items jsonb;
  normalized_order text := upper(trim(coalesce(p_order_number, '')));
  normalized_phone text := public.normalize_bd_phone(p_phone);
begin
  perform public.consume_rate_limit(
    'order_lookup:' || md5(normalized_order || ':' || coalesce(normalized_phone, '')),
    10,
    600
  );

  if normalized_order = '' or normalized_phone = '' then
    raise exception 'Enter your order ID and the mobile number used at checkout.';
  end if;

  select * into o
  from public.orders
  where order_number = normalized_order
    and public.normalize_bd_phone(phone) = normalized_phone;

  if not found then
    raise exception 'We could not find an order with those details.';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', i.id,
      'productName', i.product_name,
      'brand', i.brand,
      'category', i.category,
      'sizeMl', i.size_ml,
      'quantity', i.quantity,
      'unitPrice', i.unit_price,
      'originalPrice', i.original_price,
      'lineTotal', i.line_total
    )),
    '[]'::jsonb
  )
  into items
  from public.order_items i
  where i.order_id = o.id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'customerName', o.customer_name,
      'phone', o.phone,
      'district', o.district,
      'area', o.area,
      'address', o.address,
      'subtotal', o.subtotal,
      'deliveryFee', o.delivery_fee,
      'discountAmount', o.discount_amount,
      'couponCode', o.coupon_code,
      'total', o.total,
      'status', o.status,
      'created_at', o.created_at,
      'advancePaymentRequired', o.advance_payment_required,
      'advancePaymentAmount', o.advance_payment_amount,
      'advancePaymentStatus', o.advance_payment_status,
      'bkashTrxId', o.bkash_trx_id,
      'bkashSenderPhone', o.bkash_sender_phone,
      'bkashSubmittedAt', o.bkash_submitted_at,
      'bkashReviewedAt', o.bkash_reviewed_at,
      'bkashReviewNote', o.bkash_review_note
    ),
    'items', items
  );
end;
$function$;

create or replace function public.cancel_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  o public.orders;
  normalized_order text := upper(trim(coalesce(p_order_number, '')));
  normalized_phone text := public.normalize_bd_phone(p_phone);
begin
  perform public.consume_rate_limit(
    'order_cancel:' || md5(normalized_order || ':' || coalesce(normalized_phone, '')),
    10,
    600
  );

  select * into o
  from public.orders
  where order_number = normalized_order
    and public.normalize_bd_phone(phone) = normalized_phone
  for update;

  if not found then
    raise exception 'We could not find an order with those details.';
  end if;
  if o.status not in ('pending', 'confirmed', 'processing') then
    raise exception 'This order can no longer be cancelled because its fulfilment has progressed.';
  end if;
  if o.created_at <= now() - interval '3 hours' then
    raise exception 'The 3-hour cancellation period has ended. This order can no longer be cancelled online.';
  end if;

  update public.product_variants v
  set stock = v.stock + oi.quantity
  from public.order_items oi
  where oi.order_id = o.id
    and oi.variant_id = v.id;

  update public.orders
  set status = 'cancelled', updated_at = now()
  where id = o.id;

  return jsonb_build_object('ok', true, 'orderNumber', o.order_number, 'status', 'cancelled');
end;
$function$;

create or replace function public.submit_bkash_payment(
  p_order_number text,
  p_phone text,
  p_trx_id text,
  p_sender_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  o public.orders;
  normalized_trx text;
  normalized_sender text;
  normalized_order text := upper(trim(coalesce(p_order_number, '')));
  normalized_phone text := public.normalize_bd_phone(p_phone);
begin
  perform public.consume_rate_limit(
    'bkash_payment_submit:' || md5(normalized_order || ':' || coalesce(normalized_phone, '')),
    8,
    600
  );

  normalized_trx := upper(regexp_replace(trim(coalesce(p_trx_id, '')), '[^A-Za-z0-9]', '', 'g'));
  normalized_sender := regexp_replace(trim(coalesce(p_sender_phone, '')), '[^0-9]', '', 'g');
  if left(normalized_sender, 3) = '880' then
    normalized_sender := '0' || substr(normalized_sender, 4);
  end if;

  if length(normalized_trx) < 6 or length(normalized_trx) > 32 or normalized_trx !~ '^[A-Z0-9]+$' then
    raise exception 'Enter a valid bKash transaction ID.';
  end if;
  if normalized_sender !~ '^01[3-9][0-9]{8}$' then
    raise exception 'Enter a valid Bangladeshi mobile number used to send the payment.';
  end if;

  select * into o
  from public.orders
  where order_number = normalized_order
    and public.normalize_bd_phone(phone) = normalized_phone
  for update;

  if not found then
    raise exception 'We could not find an order with those details.';
  end if;
  if not o.advance_payment_required then
    raise exception 'This order does not require an advance payment.';
  end if;
  if o.status = 'cancelled' then
    raise exception 'This order has been cancelled.';
  end if;
  if o.advance_payment_status = 'verified' then
    raise exception 'The advance payment for this order is already verified.';
  end if;
  if o.advance_payment_status = 'submitted' then
    raise exception 'Your transaction is already submitted and awaiting manual review.';
  end if;
  if exists (
    select 1 from public.orders x
    where upper(btrim(x.bkash_trx_id)) = normalized_trx and x.id <> o.id
  ) then
    raise exception 'This transaction ID has already been used for another order.';
  end if;

  update public.orders
  set bkash_trx_id = normalized_trx,
      bkash_sender_phone = normalized_sender,
      bkash_submitted_at = now(),
      bkash_reviewed_at = null,
      bkash_review_note = null,
      advance_payment_status = 'submitted',
      updated_at = now()
  where id = o.id;

  return jsonb_build_object(
    'orderNumber', o.order_number,
    'advancePaymentStatus', 'submitted',
    'advancePaymentAmount', o.advance_payment_amount
  );
end;
$function$;

-- Never ask a customer to pay a fixed ৳200 when the discounted payable total is lower.
alter table public.orders
  drop constraint if exists orders_advance_payment_amount_check;
alter table public.orders
  add constraint orders_advance_payment_amount_check
  check (
    (advance_payment_required = false and advance_payment_amount = 0)
    or
    (advance_payment_required = true and advance_payment_amount between 1 and 200
      and advance_payment_amount <= total)
  );

create or replace function public.set_deqant_advance_payment_defaults()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.advance_payment_required := new.total > 0;
  new.advance_payment_amount := least(200, greatest(0, new.total));
  new.advance_payment_status := case
    when new.advance_payment_required then 'awaiting_payment'
    else 'not_required'
  end;
  new.bkash_trx_id := null;
  new.bkash_sender_phone := null;
  new.bkash_submitted_at := null;
  new.bkash_reviewed_at := null;
  new.bkash_review_note := null;
  return new;
end;
$function$;

revoke all on function public.set_deqant_advance_payment_defaults() from public, anon, authenticated;
