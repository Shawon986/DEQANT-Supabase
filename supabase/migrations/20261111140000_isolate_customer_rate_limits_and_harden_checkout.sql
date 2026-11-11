-- Prevent anonymous traffic from sharing one fallback rate-limit bucket.
-- Use available trusted proxy headers and retain a stable authenticated fallback.
create or replace function public.consume_rate_limit(p_scope text,p_limit integer,p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
  hdr jsonb;
  client_ip text;
  k text;
  now_at timestamptz:=clock_timestamp();
  existing public.api_rate_limits;
begin
  hdr:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  client_ip:=coalesce(
    nullif(trim(hdr->>'cf-connecting-ip'),''),
    nullif(trim(split_part(coalesce(hdr->>'x-forwarded-for',''),',',1)),''),
    nullif(trim(hdr->>'x-real-ip'),''),
    nullif(auth.uid()::text,''),
    'unknown'
  );
  k:=p_scope||':'||md5(client_ip);
  insert into public.api_rate_limits(bucket_key,window_started_at,request_count)
  values(k,now_at,1)
  on conflict(bucket_key) do update set
    window_started_at=case
      when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now_at then now_at
      else public.api_rate_limits.window_started_at
    end,
    request_count=case
      when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<=now_at then 1
      else public.api_rate_limits.request_count+1
    end
  returning * into existing;
  if existing.request_count>p_limit then
    raise exception 'Too many requests. Please wait before trying again.' using errcode='P0001';
  end if;
end;
$fn$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;

-- Scope cart additions to the caller's cart instead of a single site-wide bucket.
create or replace function public.cart_add(p_token uuid,p_variant_id bigint,p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
  c public.carts;
  v public.product_variants;
  next_qty integer;
begin
  if p_token is null then raise exception 'A cart token is required.' using errcode='22023'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>10 then raise exception 'Quantity must be between 1 and 10.'; end if;
  perform public.consume_rate_limit('cart_add:'||md5(p_token::text),120,60);

  select * into v from public.product_variants where id=p_variant_id and active for update;
  if not found or v.stock<1 then raise exception 'This size is currently out of stock.'; end if;
  if not exists(select 1 from public.products where id=v.product_id and active) then raise exception 'This fragrance is not available.'; end if;
  select * into c from public.carts where token=p_token;
  if not found then insert into public.carts(token) values(p_token) returning * into c; end if;
  insert into public.cart_items(cart_id,variant_id,quantity)
  values(c.id,v.id,p_quantity)
  on conflict(cart_id,variant_id) do update set quantity=public.cart_items.quantity+excluded.quantity
  returning quantity into next_qty;
  if next_qty>least(v.stock,10) then raise exception 'Not enough stock available. Only % remain.',v.stock; end if;
  return public.cart_read(c.token);
end;
$fn$;
revoke all on function public.cart_add(uuid,bigint,integer) from public;
grant execute on function public.cart_add(uuid,bigint,integer) to anon,authenticated,service_role;

-- Keep checkout attempts isolated by cart token. Validate all amounts on the server.
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
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
  c public.carts;
  z public.delivery_zones;
  o public.orders;
  cp public.coupons;
  line record;
  sub integer:=0;
  discount integer:=0;
  delivery integer:=0;
  total_weight integer:=0;
  onum text;
  normalized_coupon text:=nullif(upper(trim(coalesce(p_coupon_code,''))),'');
begin
  if p_token is null or p_idempotency_key is null then
    raise exception 'Your checkout session has expired. Refresh your cart and try again.';
  end if;
  perform public.consume_rate_limit('checkout:'||md5(p_token::text),8,600);

  if length(trim(coalesce(p_customer_name,'')))<2
     or length(trim(coalesce(p_phone,'')))<8
     or length(trim(coalesce(p_phone,'')))>30
     or length(trim(coalesce(p_district,'')))<2
     or length(trim(coalesce(p_area,'')))<2
     or length(trim(coalesce(p_address,'')))<8 then
    raise exception 'Please check your name, phone, district, area and delivery address.';
  end if;
  if public.normalize_bd_phone(p_phone) !~ '^01[3-9][0-9]{8}$' then
    raise exception 'Enter a valid Bangladesh mobile number, including its 01 prefix.';
  end if;
  if nullif(trim(coalesce(p_email,'')),'') is not null
     and trim(p_email) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid email address or leave the email field empty.';
  end if;

  select * into o from public.orders where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount); end if;

  select * into c from public.carts where token=p_token;
  if not found or not exists(select 1 from public.cart_items where cart_id=c.id) then
    raise exception 'Your cart is empty.';
  end if;
  select * into z from public.delivery_zones where id=p_zone_id and active;
  if not found then raise exception 'Select a valid delivery zone.'; end if;

  for line in
    select ci.quantity,v.id as variant_id,v.size_ml,v.price,v.original_price,v.stock,
      p.id as product_id,p.name,p.brand,p.category,p.active as product_active,
      v.active as variant_active,p.shipping_weight_grams
    from public.cart_items ci
    join public.product_variants v on v.id=ci.variant_id
    join public.products p on p.id=v.product_id
    where ci.cart_id=c.id
    for update of v
  loop
    if not line.product_active or not line.variant_active or line.stock<line.quantity then
      raise exception 'Stock changed while you were checking out. Please review your cart.';
    end if;
    sub:=sub+(line.price*line.quantity);
    total_weight:=total_weight+(line.shipping_weight_grams*line.quantity);
  end loop;

  delivery:=case when sub>=2000 then 0 else z.fee+case when total_weight>1000 then 20 else 0 end end;
  if normalized_coupon is not null then
    select * into cp from public.coupons
    where code=normalized_coupon and active
      and (expires_at is null or expires_at>now())
      and (usage_limit is null or usage_count<usage_limit)
    for update;
    if not found then raise exception 'This coupon is invalid, expired, or has reached its usage limit.'; end if;
    discount:=floor(sub*cp.discount_percent/100.0)::integer;
  end if;

  onum:='DQ-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
  insert into public.orders(
    order_number,idempotency_key,customer_name,phone,email,district,area,address,instructions,
    delivery_zone_id,subtotal,delivery_fee,total,coupon_code,discount_amount
  )
  values(
    onum,p_idempotency_key,trim(p_customer_name),trim(p_phone),nullif(trim(p_email),''),
    trim(p_district),trim(p_area),trim(p_address),nullif(trim(p_instructions),''),
    z.id,sub,delivery,sub-discount+delivery,normalized_coupon,discount
  )
  returning * into o;

  for line in
    select ci.quantity,v.id as variant_id,v.size_ml,v.price,v.original_price,
      p.id as product_id,p.name,p.brand,p.category
    from public.cart_items ci
    join public.product_variants v on v.id=ci.variant_id
    join public.products p on p.id=v.product_id
    where ci.cart_id=c.id
    for update of v
  loop
    update public.product_variants set stock=stock-line.quantity where id=line.variant_id;
    insert into public.order_items(
      order_id,product_id,variant_id,product_name,brand,category,size_ml,quantity,unit_price,original_price,line_total
    )
    values(
      o.id,line.product_id,line.variant_id,line.name,line.brand,line.category,line.size_ml,
      line.quantity,line.price,line.original_price,line.price*line.quantity
    );
  end loop;

  if normalized_coupon is not null then update public.coupons set usage_count=usage_count+1 where id=cp.id; end if;
  delete from public.cart_items where cart_id=c.id;
  return jsonb_build_object('orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount);
end;
$fn$;
revoke all on function public.place_order(uuid,uuid,text,text,text,text,text,text,text,bigint,text) from public;
grant execute on function public.place_order(uuid,uuid,text,text,text,text,text,text,text,bigint,text) to anon,authenticated,service_role;

-- Coupon validation is rate-limited per cart, not per whole storefront.
drop function if exists public.validate_coupon(text);
create function public.validate_coupon(p_code text,p_cart_token uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare c public.coupons;
begin
  if nullif(trim(coalesce(p_code,'')),'') is null then raise exception 'Enter a coupon code.'; end if;
  perform public.consume_rate_limit(
    'coupon_validate:'||md5(coalesce(p_cart_token::text,upper(trim(p_code)))),
    30,
    600
  );
  select * into c from public.coupons
  where code=upper(trim(p_code)) and active
    and (expires_at is null or expires_at>now())
    and (usage_limit is null or usage_count<usage_limit);
  if not found then raise exception 'This coupon is invalid, expired, or has reached its usage limit.'; end if;
  return jsonb_build_object('code',c.code,'discountPercent',c.discount_percent);
end;
$fn$;
revoke all on function public.validate_coupon(text,uuid) from public;
grant execute on function public.validate_coupon(text,uuid) to anon,authenticated,service_role;

-- Contact form throttling is scoped to the validated sender address.
create or replace function public.submit_contact(p_name text,p_email text,p_message text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
begin
  if length(trim(coalesce(p_name,'')))<2 or length(trim(coalesce(p_name,'')))>180
     or length(trim(coalesce(p_message,'')))<10 or length(trim(coalesce(p_message,'')))>3000
     or nullif(trim(coalesce(p_email,'')),'') is null
     or trim(p_email) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Please enter valid contact details and a message.';
  end if;
  perform public.consume_rate_limit('contact:'||md5(lower(trim(p_email))),5,3600);
  insert into public.contact_messages(name,email,message)
  values(trim(p_name),lower(trim(p_email)),trim(p_message));
  return jsonb_build_object('ok',true);
end;
$fn$;
revoke all on function public.submit_contact(text,text,text) from public;
grant execute on function public.submit_contact(text,text,text) to anon,authenticated,service_role;

-- Do not allow an administrator to create a coupon that is already expired.
create or replace function public.admin_create_coupon(
  p_code text,
  p_discount_percent integer,
  p_usage_limit integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
  v_coupon public.coupons;
  v_code text:=upper(trim(coalesce(p_code,'')));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  if length(v_code)<3 or length(v_code)>32 or v_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'Coupon code must be 3–32 letters, numbers, hyphens or underscores.';
  end if;
  if p_discount_percent is null or p_discount_percent<1 or p_discount_percent>90 then
    raise exception 'Discount must be between 1 and 90 percent.';
  end if;
  if p_usage_limit is not null and p_usage_limit<1 then
    raise exception 'Usage limit must be a positive number.';
  end if;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'Coupon expiry must be in the future.';
  end if;
  insert into public.coupons(code,discount_percent,usage_limit,expires_at)
  values(v_code,p_discount_percent,p_usage_limit,p_expires_at)
  returning * into v_coupon;
  return to_jsonb(v_coupon);
end;
$fn$;
revoke all on function public.admin_create_coupon(text,integer,integer,timestamptz) from public,anon;
grant execute on function public.admin_create_coupon(text,integer,integer,timestamptz) to authenticated,service_role;
