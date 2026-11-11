-- Existing published and draft products remain discoverable in the All brands collection.
update public.products
set shop_categories = array['all-brands']::text[]
where cardinality(coalesce(shop_categories, '{}'::text[])) = 0;
