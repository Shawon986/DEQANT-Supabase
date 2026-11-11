-- Preserve the legacy storefront query while keeping individual rating rows private.
-- This view uses the narrowly scoped aggregate-only SECURITY DEFINER RPC.
create or replace view public.product_rating_summary with (security_invoker=true) as
select product_id,average_rating,rating_count::integer as rating_count
from public.get_product_rating_summary(null);

grant select on public.product_rating_summary to anon,authenticated;
