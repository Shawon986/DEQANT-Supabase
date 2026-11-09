-- Persist the admin-entered product shipping weight.
create or replace function public.admin_save_product(p_product jsonb,p_variants jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare saved public.products;
begin
 if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 if coalesce(jsonb_typeof(p_variants),'')<>'array' or jsonb_array_length(p_variants)=0 then raise exception 'Add at least one size and price variant.'; end if;
 if coalesce((p_product->>'shipping_weight_grams')::integer,150)<=0 then raise exception 'Shipping weight must be a positive number of grams.'; end if;
 if p_product ? 'id' and nullif(p_product->>'id','') is not null then
  update public.products set slug=p_product->>'slug',name=p_product->>'name',brand=coalesce(p_product->>'brand','DEQANT'),category=p_product->>'category',
   description=coalesce(p_product->>'description',''),notes=coalesce(p_product->>'notes',''),family=coalesce(p_product->>'family',''),
   shipping_weight_grams=coalesce((p_product->>'shipping_weight_grams')::integer,150),
   image_url=coalesce(p_product->>'image_url',''),image_urls=coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),
   best_seller=coalesce((p_product->>'best_seller')::boolean,false),special_offer=coalesce((p_product->>'special_offer')::boolean,false),
   featured=coalesce((p_product->>'featured')::boolean,false),new_arrival=coalesce((p_product->>'new_arrival')::boolean,true),
   active=coalesce((p_product->>'active')::boolean,false),updated_at=now()
  where id=(p_product->>'id')::bigint returning * into saved;
  if not found then raise exception 'Product not found.'; end if;
 else
  insert into public.products(slug,name,brand,category,description,notes,family,shipping_weight_grams,image_url,image_urls,best_seller,special_offer,featured,new_arrival,active)
  values(p_product->>'slug',p_product->>'name',coalesce(p_product->>'brand','DEQANT'),p_product->>'category',coalesce(p_product->>'description',''),coalesce(p_product->>'notes',''),coalesce(p_product->>'family',''),coalesce((p_product->>'shipping_weight_grams')::integer,150),coalesce(p_product->>'image_url',''),coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),coalesce((p_product->>'best_seller')::boolean,false),coalesce((p_product->>'special_offer')::boolean,false),coalesce((p_product->>'featured')::boolean,false),coalesce((p_product->>'new_arrival')::boolean,true),coalesce((p_product->>'active')::boolean,false)) returning * into saved;
 end if;
 delete from public.product_variants where product_id=saved.id;
 insert into public.product_variants(product_id,size_ml,price,original_price,stock,sku,active)
 select saved.id,v.size_ml,v.price,v.original_price,v.stock,coalesce(nullif(v.sku,''),upper(saved.slug||'-'||v.size_ml||'ml')),coalesce(v.active,true)
 from jsonb_to_recordset(p_variants) as v(size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean);
 return to_jsonb(saved);
end; $$;

-- Include the product's configured weight in the cart RPC response.
create or replace function public.cart_read(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.carts; result jsonb;
begin
 select * into c from public.carts where token=p_token;
 if not found then insert into public.carts(token) values(coalesce(p_token,gen_random_uuid())) returning * into c; end if;
 select jsonb_build_object('token',c.token,'items',coalesce(jsonb_agg(jsonb_build_object(
  'id',ci.id,'quantity',ci.quantity,'variant',jsonb_build_object('id',v.id,'sizeMl',v.size_ml,'price',v.price,'originalPrice',v.original_price,'stock',v.stock),
  'product',jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'brand',p.brand,'category',p.category,'imageUrl',p.image_url,'shippingWeightGrams',p.shipping_weight_grams),
  'lineTotal',v.price*ci.quantity) order by ci.created_at) filter(where ci.id is not null),'[]'::jsonb),
  'subtotal',coalesce(sum(v.price*ci.quantity),0),'count',coalesce(sum(ci.quantity),0)) into result
 from public.cart_items ci join public.product_variants v on v.id=ci.variant_id join public.products p on p.id=v.product_id where ci.cart_id=c.id;
 return result;
end; $$;

-- Return the applied discount details on order lookup.
create or replace function public.order_by_phone(p_order_number text,p_phone text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; items jsonb;
begin
 perform public.consume_rate_limit('order_lookup',30,600);
 select * into o from public.orders where order_number=upper(trim(p_order_number)) and phone=trim(p_phone);
 if not found then raise exception 'We could not find an order with those details.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'productName',i.product_name,'brand',i.brand,'category',i.category,'sizeMl',i.size_ml,'quantity',i.quantity,'unitPrice',i.unit_price,'originalPrice',i.original_price,'lineTotal',i.line_total)),'[]'::jsonb)
 into items from public.order_items i where i.order_id=o.id;
 return jsonb_build_object('order',jsonb_build_object('id',o.id,'orderNumber',o.order_number,'customerName',o.customer_name,'phone',o.phone,'email',o.email,'district',o.district,'area',o.area,'address',o.address,'instructions',o.instructions,'subtotal',o.subtotal,'deliveryFee',o.delivery_fee,'discountAmount',o.discount_amount,'couponCode',o.coupon_code,'total',o.total,'status',o.status,'created_at',o.created_at),'items',items);
end; $$;
