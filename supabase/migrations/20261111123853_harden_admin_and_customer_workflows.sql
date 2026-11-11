-- Complete workflow hardening: preserve cart-linked variants during product edits,
-- make admin cancellations restore inventory, enforce safe order transitions,
-- and stop exposing individual customer rating records publicly.

create or replace function public.admin_save_product(p_product jsonb, p_variants jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  saved public.products;
  expected_updates integer;
  actual_updates integer;
  v_category text := coalesce(p_product->>'category','');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object'
     or p_variants is null or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Product details and a variant list are required.';
  end if;
  if nullif(trim(p_product->>'name'),'') is null
     or nullif(trim(p_product->>'brand'),'') is null
     or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Enter a valid product name, brand and URL slug.';
  end if;
  if v_category not in ('decant','intact') then
    raise exception 'Choose a valid product type.';
  end if;
  if nullif(trim(p_product->>'image_url'),'') is null then
    raise exception 'Upload a product image before saving.';
  end if;
  if coalesce((p_product->>'shipping_weight_grams')::integer,0) <= 0 then
    raise exception 'Shipping weight must be a positive number of grams.';
  end if;
  if jsonb_array_length(p_variants) < 1
     or (v_category='decant' and jsonb_array_length(p_variants)>5)
     or (v_category='intact' and jsonb_array_length(p_variants)>3) then
    raise exception 'Too many or too few size options for this product type.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
    where v.size_ml is null or v.price is null or v.original_price is null or v.stock is null
       or v.size_ml <= 0 or v.price < 0 or v.original_price < v.price or v.stock < 0
       or (v.sku is not null and length(trim(v.sku)) > 100)
       or (v_category='decant' and v.size_ml not in (3,6,10,15,30))
       or (v_category='intact' and v.size_ml not in (60,100,150))
  ) then
    raise exception 'Check sizes, prices, and stock. Decants support 3, 6, 10, 15 or 30 ml; intact bottles support 60, 100 or 150 ml.';
  end if;
  if exists (
    select v.size_ml
    from jsonb_to_recordset(p_variants) as v(size_ml integer)
    group by v.size_ml having count(*) > 1
  ) then
    raise exception 'Each size can only be added once.';
  end if;

  if nullif(p_product->>'id','') is not null then
    update public.products
    set slug=p_product->>'slug',
        name=trim(p_product->>'name'),
        brand=trim(p_product->>'brand'),
        category=v_category,
        description=coalesce(p_product->>'description',''),
        notes=coalesce(p_product->>'notes',''),
        family=coalesce(p_product->>'family',''),
        shipping_weight_grams=(p_product->>'shipping_weight_grams')::integer,
        image_url=p_product->>'image_url',
        image_urls=coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),
        shop_categories=coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'shop_categories','[]'::jsonb))),'{}'),
        best_seller=coalesce((p_product->>'best_seller')::boolean,false),
        special_offer=coalesce((p_product->>'special_offer')::boolean,false),
        featured=coalesce((p_product->>'featured')::boolean,false),
        new_arrival=coalesce((p_product->>'new_arrival')::boolean,true),
        active=coalesce((p_product->>'active')::boolean,false),
        updated_at=now()
    where id=(p_product->>'id')::bigint
    returning * into saved;
    if not found then raise exception 'Product not found.'; end if;
  else
    insert into public.products(
      slug,name,brand,category,description,notes,family,shipping_weight_grams,
      image_url,image_urls,shop_categories,best_seller,special_offer,featured,new_arrival,active
    ) values (
      p_product->>'slug',trim(p_product->>'name'),trim(p_product->>'brand'),v_category,
      coalesce(p_product->>'description',''),coalesce(p_product->>'notes',''),coalesce(p_product->>'family',''),
      (p_product->>'shipping_weight_grams')::integer,p_product->>'image_url',
      coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'shop_categories','[]'::jsonb))),'{}'),
      coalesce((p_product->>'best_seller')::boolean,false),coalesce((p_product->>'special_offer')::boolean,false),
      coalesce((p_product->>'featured')::boolean,false),coalesce((p_product->>'new_arrival')::boolean,true),
      coalesce((p_product->>'active')::boolean,false)
    ) returning * into saved;
  end if;

  -- Remove only variants deliberately removed in the editor. Retained IDs keep
  -- their cart_items foreign keys and therefore preserve customers' saved carts.
  delete from public.product_variants pv
  where pv.product_id=saved.id
    and not exists (
      select 1 from jsonb_to_recordset(p_variants) as v(id bigint)
      where v.id=pv.id
    );

  select count(*) into expected_updates
  from jsonb_to_recordset(p_variants) as v(id bigint)
  where v.id is not null;

  update public.product_variants pv
  set size_ml=v.size_ml,
      price=v.price,
      original_price=v.original_price,
      stock=v.stock,
      sku=coalesce(nullif(trim(v.sku),''),upper(saved.slug||'-'||v.size_ml||'ml')),
      active=coalesce(v.active,true)
  from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
  where v.id is not null and pv.id=v.id and pv.product_id=saved.id;
  get diagnostics actual_updates = row_count;
  if actual_updates <> expected_updates then
    raise exception 'One or more size options no longer belong to this product. Refresh and try again.';
  end if;

  insert into public.product_variants(product_id,size_ml,price,original_price,stock,sku,active)
  select saved.id,v.size_ml,v.price,v.original_price,v.stock,
         coalesce(nullif(trim(v.sku),''),upper(saved.slug||'-'||v.size_ml||'ml')),
         coalesce(v.active,true)
  from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
  where v.id is null;

  return to_jsonb(saved);
end;
$fn$;

create or replace function public.admin_update_order(
  p_order_id bigint,
  p_status text,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  o public.orders;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  if p_order_id is null or p_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception 'Choose a valid order and status.';
  end if;

  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if p_status <> o.status and not (
    (o.status='pending' and p_status in ('confirmed','cancelled'))
    or (o.status='confirmed' and p_status in ('processing','cancelled'))
    or (o.status='processing' and p_status in ('shipped','cancelled'))
    or (o.status='shipped' and p_status='delivered')
  ) then
    raise exception 'This order cannot move from % to %. Follow the order status sequence.',o.status,p_status;
  end if;

  if p_status='cancelled' and o.status<>'cancelled' then
    update public.product_variants v
    set stock=v.stock+oi.quantity
    from public.order_items oi
    where oi.order_id=o.id and oi.variant_id=v.id;
  end if;

  update public.orders
  set status=p_status,
      internal_notes=case when p_internal_notes is null then internal_notes else left(trim(p_internal_notes),2000) end,
      updated_at=now()
  where id=o.id;

  return jsonb_build_object('success',true,'orderId',o.id,'orderNumber',o.order_number,'status',p_status);
end;
$fn$;

revoke all on function public.admin_update_order(bigint,text,text) from public, anon;
grant execute on function public.admin_update_order(bigint,text,text) to authenticated;

-- Order status changes must go through the transactional RPC so admin cancellation
-- cannot silently consume stock or bypass the valid status sequence.
drop policy if exists "admin update orders" on public.orders;
revoke update on table public.orders from authenticated;

-- Product rating aggregates remain public, but individual rating rows and user IDs
-- are visible only to the rating owner and administrators.
drop policy if exists "Public can read product ratings" on public.product_ratings;
drop policy if exists "Customers can read own rating or admin" on public.product_ratings;
create policy "Customers can read own rating or admin" on public.product_ratings
  for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
revoke all on table public.product_ratings from anon, authenticated;
grant select, insert, update on table public.product_ratings to authenticated;

-- Scope cart writes to each cart token and reject stale/inactive items before changing quantity.
create or replace function public.cart_update(p_token uuid,p_item_id bigint,p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare c public.carts; v public.product_variants;
begin
  perform public.consume_rate_limit('cart_update:'||md5(coalesce(p_token::text,'missing')),120,60);
  if p_token is null then raise exception 'A cart token is required.' using errcode='22023'; end if;
  if p_quantity<1 or p_quantity>10 then raise exception 'Quantity must be between 1 and 10.'; end if;
  select * into c from public.carts where token=p_token;
  if not found then raise exception 'Cart not found.'; end if;
  select pv.* into v
  from public.cart_items ci
  join public.product_variants pv on pv.id=ci.variant_id
  join public.products p on p.id=pv.product_id
  where ci.id=p_item_id and ci.cart_id=c.id and pv.active and p.active
  for update of pv;
  if not found then raise exception 'This fragrance is no longer available. Remove it from your cart and choose another.'; end if;
  if p_quantity>v.stock then raise exception 'Requested quantity is unavailable. Only % remain.',v.stock; end if;
  update public.cart_items set quantity=p_quantity where id=p_item_id and cart_id=c.id;
  return public.cart_read(c.token);
end;
$fn$;

create or replace function public.cart_remove(p_token uuid,p_item_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare c public.carts;
begin
  perform public.consume_rate_limit('cart_remove:'||md5(coalesce(p_token::text,'missing')),120,60);
  if p_token is null then raise exception 'A cart token is required.' using errcode='22023'; end if;
  select * into c from public.carts where token=p_token;
  if found then delete from public.cart_items where id=p_item_id and cart_id=c.id; end if;
  return public.cart_read(p_token);
end;
$fn$;

revoke all on function public.cart_update(uuid,bigint,integer) from public;
grant execute on function public.cart_update(uuid,bigint,integer) to anon,authenticated,service_role;
revoke all on function public.cart_remove(uuid,bigint) from public;
grant execute on function public.cart_remove(uuid,bigint) to anon,authenticated,service_role;

create or replace function public.guard_deqant_order_fulfilment()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn$
begin
  if new.advance_payment_required
     and new.status in ('confirmed','processing','shipped','delivered')
     and new.advance_payment_status <> 'verified' then
    raise exception 'The required bKash advance payment must be verified before fulfilment.';
  end if;
  return new;
end;
$fn$;
