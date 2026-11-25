-- Simplify DEQANT order lifecycle to pending, confirmed and cancelled.
-- Preserve legacy orders by mapping their former fulfilment stages to confirmed.
update public.orders
set status = 'confirmed', updated_at = now()
where status in ('processing', 'shipped', 'delivered');

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

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
  if p_order_id is null or p_status not in ('pending','confirmed','cancelled') then
    raise exception 'Choose a valid order and status.';
  end if;

  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if p_status <> o.status and not (
    (o.status='pending' and p_status in ('confirmed','cancelled'))
    or (o.status='confirmed' and p_status='cancelled')
  ) then
    raise exception 'This order cannot move from % to %. Orders can only move from pending to confirmed or cancelled, and from confirmed to cancelled.',o.status,p_status;
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
