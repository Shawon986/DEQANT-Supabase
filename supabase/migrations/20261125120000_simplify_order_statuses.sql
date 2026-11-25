-- Simplify DEQANT order lifecycle to pending, confirmed and cancelled.
-- Map former fulfilment stages to confirmed without bypassing normal stock or payment triggers.
drop trigger if exists orders_guard_deqant_fulfilment on public.orders;

update public.orders
set status = 'confirmed', updated_at = now()
where status in ('processing', 'shipped', 'delivered');

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

create or replace function public.guard_deqant_order_fulfilment()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn$
begin
  if new.status is distinct from old.status then
    if old.status = 'cancelled' then
      raise exception 'This order is already cancelled and its status cannot be changed.';
    end if;
    if not (
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status = 'cancelled')
    ) then
      raise exception 'Orders can only move from pending to confirmed or cancelled, and from confirmed to cancelled.';
    end if;
  end if;

  if new.advance_payment_required
     and new.status = 'confirmed'
     and new.advance_payment_status <> 'verified' then
    raise exception 'The required bKash advance payment must be verified before confirming this order.';
  end if;
  return new;
end;
$fn$;

create trigger orders_guard_deqant_fulfilment
before update of status, advance_payment_status on public.orders
for each row execute function public.guard_deqant_order_fulfilment();

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
