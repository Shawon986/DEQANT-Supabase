-- Admin-only coupon writes through narrowly scoped RPCs.
-- Existing public coupon validation remains read-only.
create or replace function public.admin_create_coupon(
  p_code text,
  p_discount_percent integer,
  p_usage_limit integer default null,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_coupon public.coupons;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if length(v_code) < 3 or length(v_code) > 32 or v_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'Coupon code must be 3–32 letters, numbers, hyphens or underscores.';
  end if;
  if p_discount_percent is null or p_discount_percent < 1 or p_discount_percent > 90 then
    raise exception 'Discount must be between 1 and 90 percent.';
  end if;
  if p_usage_limit is not null and p_usage_limit < 1 then
    raise exception 'Usage limit must be a positive number.';
  end if;
  insert into public.coupons(code, discount_percent, usage_limit, expires_at)
  values(v_code, p_discount_percent, p_usage_limit, p_expires_at)
  returning * into v_coupon;
  return to_jsonb(v_coupon);
end;
$$;

create or replace function public.admin_set_coupon_active(
  p_coupon_id bigint,
  p_active boolean
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_coupon public.coupons;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_coupon_id is null or p_active is null then
    raise exception 'Coupon and status are required.';
  end if;
  update public.coupons set active = p_active where id = p_coupon_id returning * into v_coupon;
  if not found then raise exception 'Coupon not found.'; end if;
  return to_jsonb(v_coupon);
end;
$$;

revoke all on function public.admin_create_coupon(text, integer, integer, timestamptz) from public, anon;
revoke all on function public.admin_set_coupon_active(bigint, boolean) from public, anon;
grant execute on function public.admin_create_coupon(text, integer, integer, timestamptz) to authenticated;
grant execute on function public.admin_set_coupon_active(bigint, boolean) to authenticated;
grant select, insert, update, delete on table public.coupons to authenticated;
grant usage, select on sequence public.coupons_id_seq to authenticated;
