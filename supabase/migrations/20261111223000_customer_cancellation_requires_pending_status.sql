-- Customer self-service cancellation is available only before admin confirmation.
-- Admin-initiated cancellation remains available through admin_update_order.
create or replace function public.cancel_order(p_order_number text,p_phone text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $fn$
declare
 o public.orders;
 normalized_order text:=upper(trim(coalesce(p_order_number,'')));
 normalized_phone text:=public.normalize_bd_phone(p_phone);
begin
 perform public.consume_rate_limit('order_cancel:'||md5(normalized_order||':'||coalesce(normalized_phone,'')),10,600);
 select * into o
 from public.orders
 where order_number=normalized_order
   and public.normalize_bd_phone(phone)=normalized_phone
 for update;
 if not found then
  raise exception 'We could not find an order with those details.';
 end if;
 if o.status<>'pending' then
  raise exception 'This order can no longer be cancelled online because the administrator has confirmed or progressed it.';
 end if;
 if o.created_at<=now()-interval '3 hours' then
  raise exception 'The 3-hour cancellation period has ended. This order can no longer be cancelled online.';
 end if;
 update public.orders set status='cancelled',updated_at=now() where id=o.id;
 return jsonb_build_object('ok',true,'orderNumber',o.order_number,'status','cancelled');
end;
$fn$;
revoke all on function public.cancel_order(text,text) from public;
grant execute on function public.cancel_order(text,text) to anon,authenticated;
