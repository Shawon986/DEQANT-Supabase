-- Expose only product-level rating averages and counts to anonymous storefront visitors.
alter view public.product_rating_summary set (security_invoker=true);
revoke all on public.product_rating_summary from anon,authenticated;

create or replace function public.get_product_rating_summary(p_product_id bigint default null)
returns table(product_id bigint,average_rating numeric,rating_count bigint)
language sql
security definer
set search_path=pg_catalog,public
as $fn$
  select r.product_id,round(avg(r.rating)::numeric,1),count(*)::bigint
  from public.product_ratings r
  where p_product_id is null or r.product_id=p_product_id
  group by r.product_id;
$fn$;
revoke all on function public.get_product_rating_summary(bigint) from public;
grant execute on function public.get_product_rating_summary(bigint) to anon,authenticated;
