-- Preserve cart-linked variant IDs for both the new editor and the currently deployed
-- editor, which sends variants without IDs. The legacy intact editor only submits one
-- visible size, so keep its hidden intact sizes until the new editor is deployed.

create or replace function public.admin_save_product(p_product jsonb,p_variants jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
 saved public.products;
 previous_category text;
 expected_updates integer;
 actual_updates integer;
 v_category text:=coalesce(p_product->>'category','');
 legacy_payload boolean;
 preserve_hidden_intact_sizes boolean;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 if p_product is null or jsonb_typeof(p_product)<>'object' or p_variants is null or jsonb_typeof(p_variants)<>'array' then raise exception 'Product details and a variant list are required.'; end if;
 if nullif(trim(p_product->>'name'),'') is null or nullif(trim(p_product->>'brand'),'') is null or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Enter a valid product name, brand and URL slug.'; end if;
 if v_category not in ('decant','intact') then raise exception 'Choose a valid product type.'; end if;
 if nullif(trim(p_product->>'image_url'),'') is null then raise exception 'Upload a product image before saving.'; end if;
 if coalesce((p_product->>'shipping_weight_grams')::integer,0)<=0 then raise exception 'Shipping weight must be a positive number of grams.'; end if;
 if jsonb_array_length(p_variants)<1 or (v_category='decant' and jsonb_array_length(p_variants)>5) or (v_category='intact' and jsonb_array_length(p_variants)>3) then raise exception 'Too many or too few size options for this product type.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
  where v.size_ml is null or v.price is null or v.original_price is null or v.stock is null or v.size_ml<=0 or v.price<0 or v.original_price<v.price or v.stock<0
   or (v.sku is not null and length(trim(v.sku))>100) or (v_category='decant' and v.size_ml not in (3,6,10,15,30)) or (v_category='intact' and v.size_ml not in (60,100,150))) then
  raise exception 'Invalid size, price or stock. Use approved DEQANT sizes and valid amounts.';
 end if;
 if exists(select v.size_ml from jsonb_to_recordset(p_variants) as v(size_ml integer) group by v.size_ml having count(*)>1) then raise exception 'Each size can only be added once.'; end if;

 if nullif(p_product->>'id','') is not null then
  select category into previous_category from public.products where id=(p_product->>'id')::bigint for update;
  if not found then raise exception 'Product not found.'; end if;
  update public.products set slug=p_product->>'slug',name=trim(p_product->>'name'),brand=trim(p_product->>'brand'),category=v_category,
   description=coalesce(p_product->>'description',''),notes=coalesce(p_product->>'notes',''),family=coalesce(p_product->>'family',''),
   shipping_weight_grams=(p_product->>'shipping_weight_grams')::integer,image_url=p_product->>'image_url',
   image_urls=coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),
   shop_categories=coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'shop_categories','[]'::jsonb))),'{}'),
   best_seller=coalesce((p_product->>'best_seller')::boolean,false),special_offer=coalesce((p_product->>'special_offer')::boolean,false),
   featured=coalesce((p_product->>'featured')::boolean,false),new_arrival=coalesce((p_product->>'new_arrival')::boolean,true),
   active=coalesce((p_product->>'active')::boolean,false),updated_at=now()
  where id=(p_product->>'id')::bigint returning * into saved;
 else
  previous_category:=null;
  insert into public.products(slug,name,brand,category,description,notes,family,shipping_weight_grams,image_url,image_urls,shop_categories,best_seller,special_offer,featured,new_arrival,active)
  values(p_product->>'slug',trim(p_product->>'name'),trim(p_product->>'brand'),v_category,coalesce(p_product->>'description',''),coalesce(p_product->>'notes',''),coalesce(p_product->>'family',''),
   (p_product->>'shipping_weight_grams')::integer,p_product->>'image_url',
   coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'image_urls','[]'::jsonb))),'{}'),
   coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'shop_categories','[]'::jsonb))),'{}'),
   coalesce((p_product->>'best_seller')::boolean,false),coalesce((p_product->>'special_offer')::boolean,false),coalesce((p_product->>'featured')::boolean,false),
   coalesce((p_product->>'new_arrival')::boolean,true),coalesce((p_product->>'active')::boolean,false)) returning * into saved;
 end if;

 select not exists(select 1 from jsonb_to_recordset(p_variants) as v(id bigint) where v.id is not null) into legacy_payload;
 preserve_hidden_intact_sizes:=legacy_payload and previous_category='intact' and v_category='intact';
 if not preserve_hidden_intact_sizes then
  delete from public.product_variants pv where pv.product_id=saved.id and not exists(
   select 1 from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer)
   where (v.id is not null and v.id=pv.id) or (v.id is null and v.size_ml=pv.size_ml)
  );
 end if;

 select count(*) into expected_updates from jsonb_to_recordset(p_variants) as v(id bigint) where v.id is not null;
 update public.product_variants pv set size_ml=v.size_ml,price=v.price,original_price=v.original_price,stock=v.stock,
  sku=coalesce(nullif(trim(v.sku),''),upper(saved.slug||'-'||v.size_ml||'ml')),active=coalesce(v.active,true)
 from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
 where v.id is not null and pv.id=v.id and pv.product_id=saved.id;
 get diagnostics actual_updates=row_count;
 if actual_updates<>expected_updates then raise exception 'One or more size options no longer belong to this product. Refresh and try again.'; end if;

 update public.product_variants pv set price=v.price,original_price=v.original_price,stock=v.stock,
  sku=coalesce(nullif(trim(v.sku),''),upper(saved.slug||'-'||v.size_ml||'ml')),active=coalesce(v.active,true)
 from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
 where v.id is null and pv.product_id=saved.id and pv.size_ml=v.size_ml;

 insert into public.product_variants(product_id,size_ml,price,original_price,stock,sku,active)
 select saved.id,v.size_ml,v.price,v.original_price,v.stock,coalesce(nullif(trim(v.sku),''),upper(saved.slug||'-'||v.size_ml||'ml')),coalesce(v.active,true)
 from jsonb_to_recordset(p_variants) as v(id bigint,size_ml integer,price integer,original_price integer,stock integer,sku text,active boolean)
 where v.id is null and not exists(select 1 from public.product_variants pv where pv.product_id=saved.id and pv.size_ml=v.size_ml);

 return to_jsonb(saved);
end;
$fn$;
