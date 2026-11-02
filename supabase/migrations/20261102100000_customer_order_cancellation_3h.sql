-- Allow customers (including guest-checkout customers) to cancel a verified order
-- only during the first three hours after placement.
create or replace function public.cancel_order(p_order_number text,p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  perform public.consume_rate_limit('order_cancel', 10, 600);

  select *
    into o
    from public.orders
   where order_number = upper(trim(p_order_number))
     and phone = trim(p_phone)
   for update;

  if not found then
    raise exception 'We could not find an order with those details.';
  end if;

  if o.status not in ('pending', 'confirmed', 'processing') then
    raise exception 'This order can no longer be cancelled because its fulfilment has progressed.';
  end if;

  if o.created_at < now() - interval '3 hours' then
    raise exception 'The 3-hour cancellation period has ended. This order can no longer be cancelled online.';
  end if;

  -- Restore reserved stock in the same transaction as the status change.
  update public.product_variants as v
     set stock = v.stock + oi.quantity
    from public.order_items as oi
   where oi.order_id = o.id
     and oi.variant_id = v.id;

  update public.orders
     set status = 'cancelled',
         updated_at = now()
   where id = o.id;

  return jsonb_build_object(
    'ok', true,
    'orderNumber', o.order_number,
    'status', 'cancelled'
  );
end;
$$;

revoke all on function public.cancel_order(text, text) from public;
grant execute on function public.cancel_order(text, text) to anon, authenticated;
