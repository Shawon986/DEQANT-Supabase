-- Preserve every existing access condition while avoiding duplicate permissive SELECT policy evaluation.

-- These public SELECT policies already include administrator access. Replace broad ALL
-- administrator policies with write-only policies so SELECT is evaluated once.
drop policy if exists "admin manage zones" on public.delivery_zones;
create policy "admin insert zones" on public.delivery_zones for insert to authenticated with check (public.is_admin());
create policy "admin update zones" on public.delivery_zones for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete zones" on public.delivery_zones for delete to authenticated using (public.is_admin());

drop policy if exists "admin manage images" on public.product_images;
create policy "admin insert images" on public.product_images for insert to authenticated with check (public.is_admin());
create policy "admin update images" on public.product_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete images" on public.product_images for delete to authenticated using (public.is_admin());

drop policy if exists "admin manage variants" on public.product_variants;
create policy "admin insert variants" on public.product_variants for insert to authenticated with check (public.is_admin());
create policy "admin update variants" on public.product_variants for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete variants" on public.product_variants for delete to authenticated using (public.is_admin());

drop policy if exists "admin manage products" on public.products;
create policy "admin insert products" on public.products for insert to authenticated with check (public.is_admin());
create policy "admin update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete products" on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "admin manage settings" on public.website_settings;
create policy "admin insert settings" on public.website_settings for insert to authenticated with check (public.is_admin());
create policy "admin update settings" on public.website_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete settings" on public.website_settings for delete to authenticated using (public.is_admin());

-- Admins and customers retain exactly the same read access, expressed as one policy.
drop policy if exists "admin read orders" on public.orders;
drop policy if exists "customer read own orders" on public.orders;
create policy "read own or admin orders" on public.orders for select to authenticated
using (public.is_admin() or customer_id = (select auth.uid()));

drop policy if exists "admin read order items" on public.order_items;
drop policy if exists "customer read own order items" on public.order_items;
create policy "read own or admin order items" on public.order_items for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
  )
);
