-- Keep order status transitions and cancellation stock updates consistent for both
-- RPC-based and currently deployed direct admin updates.

create or replace function public.guard_deqant_order_fulfilment()
returns trigger language plpgsql set search_path=pg_catalog,public
as $fn$
declare old_rank integer; new_rank integer;
begin
 if new.status is distinct from old.status then
  if old.status in ('cancelled','delivered') then raise exception 'This order is already closed and its status cannot be changed.'; end if;
  if new.status='cancelled' then
   if old.status not in ('pending','confirmed','processing') then raise exception 'An order can only be cancelled before shipment.'; end if;
  else
   old_rank:=case old.status when 'pending' then 0 when 'confirmed' then 1 when 'processing' then 2 when 'shipped' then 3 when 'delivered' then 4 else -1 end;
   new_rank:=case new.status when 'pending' then 0 when 'confirmed' then 1 when 'processing' then 2 when 'shipped' then 3 when 'delivered' then 4 else -1 end;
   if old_rank<0 or new_rank<=old_rank then raise exception 'Order status cannot move backwards. Follow the fulfilment sequence.'; end if;
  end if;
 end if;
 if new.advance_payment_required and new.status in ('confirmed','processing','shipped','delivered') and new.advance_payment_status<>'verified' then
  raise exception 'The required bKash advance payment must be verified before fulfilment.';
 end if;
 return new;
end;
$fn$;

create or replace function public.restore_stock_after_order_cancellation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $fn$
begin
 if old.status is distinct from 'cancelled' and new.status='cancelled' then
  update public.product_variants v set stock=v.stock+items.quantity
  from (select oi.variant_id,sum(oi.quantity)::integer quantity from public.order_items oi where oi.order_id=new.id and oi.variant_id is not null group by oi.variant_id) items
  where v.id=items.variant_id;
 end if;
 return new;
end;
$fn$;
revoke all on function public.restore_stock_after_order_cancellation() from public,anon,authenticated;
drop trigger if exists orders_restore_stock_after_cancellation on public.orders;
create trigger orders_restore_stock_after_cancellation after update of status on public.orders
for each row when (old.status is distinct from 'cancelled' and new.status='cancelled')
execute function public.restore_stock_after_order_cancellation();

create or replace function public.admin_update_order(p_order_id bigint,p_status text,p_internal_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare o public.orders;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 if p_order_id is null or p_status is null or p_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then raise exception 'Choose a valid order and status.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 if p_status<>o.status and not ((o.status='pending' and p_status in ('confirmed','cancelled')) or (o.status='confirmed' and p_status in ('processing','cancelled')) or (o.status='processing' and p_status in ('shipped','cancelled')) or (o.status='shipped' and p_status='delivered')) then
  raise exception 'This order cannot move from % to %. Follow the order status sequence.',o.status,p_status;
 end if;
 update public.orders set status=p_status,internal_notes=case when p_internal_notes is null then internal_notes else left(trim(p_internal_notes),2000) end,updated_at=now() where id=o.id;
 return jsonb_build_object('success',true,'orderId',o.id,'orderNumber',o.order_number,'status',p_status);
end;
$fn$;
revoke all on function public.admin_update_order(bigint,text,text) from public,anon;
grant execute on function public.admin_update_order(bigint,text,text) to authenticated;

create or replace function public.cancel_order(p_order_number text,p_phone text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare o public.orders; normalized_order text:=upper(trim(coalesce(p_order_number,''))); normalized_phone text:=public.normalize_bd_phone(p_phone);
begin
 perform public.consume_rate_limit('order_cancel:'||md5(normalized_order||':'||coalesce(normalized_phone,'')),10,600);
 select * into o from public.orders where order_number=normalized_order and public.normalize_bd_phone(phone)=normalized_phone for update;
 if not found then raise exception 'We could not find an order with those details.'; end if;
 if o.status not in ('pending','confirmed','processing') then raise exception 'This order can no longer be cancelled because its fulfilment has progressed.'; end if;
 if o.created_at<=now()-interval '3 hours' then raise exception 'The 3-hour cancellation period has ended. This order can no longer be cancelled online.'; end if;
 update public.orders set status='cancelled',updated_at=now() where id=o.id;
 return jsonb_build_object('ok',true,'orderNumber',o.order_number,'status','cancelled');
end;
$fn$;

drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant update on table public.orders to authenticated;
