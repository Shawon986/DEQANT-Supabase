-- Keep public reads independent from the admin-only is_admin() helper.
-- Anonymous requests must never evaluate a function they cannot execute.

drop policy if exists "published products public read" on public.products;
create policy "published products public read" on public.products
  for select to anon using (active);
create policy "authenticated products read" on public.products
  for select to authenticated using (active or public.is_admin());

drop policy if exists "published variants public read" on public.product_variants;
create policy "published variants public read" on public.product_variants
  for select to anon using (
    active and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.active
    )
  );
create policy "authenticated variants read" on public.product_variants
  for select to authenticated using (
    (active and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.active
    )) or public.is_admin()
  );

drop policy if exists "published images public read" on public.product_images;
create policy "published images public read" on public.product_images
  for select to anon using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.active
    )
  );
create policy "authenticated images read" on public.product_images
  for select to authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.active
    ) or public.is_admin()
  );

drop policy if exists "active zones public read" on public.delivery_zones;
create policy "active zones public read" on public.delivery_zones
  for select to anon using (active);
create policy "authenticated zones read" on public.delivery_zones
  for select to authenticated using (active or public.is_admin());
