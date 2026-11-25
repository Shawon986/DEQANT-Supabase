-- Collect manual bKash payment details during checkout and remove the pending order lifecycle.
begin;

drop trigger if exists orders_guard_deqant_fulfilment on public.orders;
alter table public.orders drop constraint if exists orders_status_check;

-- Translate existing orders without deleting order history.
update public.orders
set status = case
  when status = 'pending' and advance_payment_status = 'verified' then 'confirmed'
  when status = 'pending' then 'received'
  else status
end,
advance_payment_status = case
  when advance_payment_status = 'awaiting_payment' then 'rejected'
  else advance_payment_status
end,
bkash_review_note = case
  when advance_payment_status = 'awaiting_payment'
    then coalesce(bkash_review_note, 'Legacy order placed before payment details were collected at checkout. Contact the customer to resolve payment.')
  else bkash_review_note
end,
updated_at = now()
where status = 'pending' or advance_payment_status = 'awaiting_payment';

alter table public.orders alter column status set default 'received';
alter table public.orders add constraint orders_status_check
  check (status in ('received','confirmed','cancelled'));
alter table public.orders drop constraint if exists orders_advance_payment_status_check;
alter table public.orders add constraint orders_advance_payment_status_check
  check (advance_payment_status in ('not_required','submitted','verified','rejected'));

create or replace function public.set_deqant_advance_payment_defaults()
returns trigger language plpgsql set search_path=pg_catalog,public as $fn$
begin
  new.advance_payment_required := true;
  new.advance_payment_amount := 200;
  -- The checkout RPC fills the actual TrxID and sender phone before the transaction commits.
  new.advance_payment_status := 'submitted';
  new.bkash_trx_id := null;
  new.bkash_sender_phone := null;
  new.bkash_submitted_at := now();
  new.bkash_reviewed_at := null;
  new.bkash_review_note := null;
  return new;
end;
$fn$;

create or replace function public.guard_deqant_order_fulfilment()
returns trigger language plpgsql set search_path=pg_catalog,public as $fn$
begin
  if new.status is distinct from old.status then
    if old.status = 'cancelled' then
      raise exception 'This order is already cancelled and its status cannot be changed.';
    end if;
    if not (
      (old.status = 'received' and new.status in ('confirmed','cancelled'))
      or (old.status = 'confirmed' and new.status = 'cancelled')
    ) then
      raise exception 'Orders can only move from received to confirmed or cancelled, and from confirmed to cancelled.';
    end if;
  end if;
  if new.advance_payment_required and new.status = 'confirmed'
     and new.advance_payment_status <> 'verified' then
    raise exception 'The bKash advance payment must be manually verified before confirming this order.';
  end if;
  return new;
end;
$fn$;
create trigger orders_guard_deqant_fulfilment
before update of status, advance_payment_status on public.orders
for each row execute function public.guard_deqant_order_fulfilment();

create or replace function public.admin_update_order(
  p_order_id bigint, p_status text, p_internal_notes text default null
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $fn$
declare o public.orders;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode='42501';
  end if;
  if p_order_id is null or p_status not in ('received','confirmed','cancelled') then
    raise exception 'Choose a valid order status.';
  end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if p_status <> o.status and not (
    (o.status='received' and p_status in ('confirmed','cancelled'))
    or (o.status='confirmed' and p_status='cancelled')
  ) then
    raise exception 'This order cannot move from % to %. Orders can only move from received to confirmed or cancelled, and from confirmed to cancelled.',o.status,p_status;
  end if;
  update public.orders
  set status=p_status,
      internal_notes=case when p_internal_notes is null then internal_notes else left(trim(p_internal_notes),2000) end,
      updated_at=now()
  where id=o.id;
  return jsonb_build_object('success',true,'orderId',o.id,'orderNumber',o.order_number,'status',p_status);
end;
$fn$;
revoke all on function public.admin_update_order(bigint,text,text) from public,anon;
grant execute on function public.admin_update_order(bigint,text,text) to authenticated;

drop function if exists public.place_order_with_location(uuid,uuid,text,text,text,text,text,text,text,text,text);
create function public.place_order_with_location(
  p_token uuid, p_idempotency_key uuid, p_customer_name text, p_phone text, p_email text,
  p_division text, p_district text, p_upazila text, p_address text, p_instructions text,
  p_coupon_code text default null, p_bkash_trx_id text default null, p_bkash_sender_phone text default null
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $fn$
declare
  result jsonb;
  o public.orders;
  normalized_trx text;
  normalized_sender text;
  normalized_division text := lower(trim(coalesce(p_division,'')));
  normalized_district text := lower(trim(coalesce(p_district,'')));
begin
  perform public.consume_rate_limit('checkout_payment:'||md5(coalesce(p_token::text,'')),8,600);
  normalized_trx := upper(regexp_replace(trim(coalesce(p_bkash_trx_id,'')),'[^A-Za-z0-9]','','g'));
  normalized_sender := regexp_replace(trim(coalesce(p_bkash_sender_phone,'')),'[^0-9]','','g');
  if left(normalized_sender,3)='880' then normalized_sender := '0'||substr(normalized_sender,4); end if;
  if length(normalized_trx)<6 or length(normalized_trx)>32 or normalized_trx !~ '^[A-Z0-9]+$' then
    raise exception 'Enter a valid bKash transaction ID.';
  end if;
  if normalized_sender !~ '^01[3-9][0-9]{8}$' then
    raise exception 'Enter a valid Bangladeshi mobile number used to send the payment.';
  end if;
  if length(trim(coalesce(p_division,'')))<2 or length(trim(coalesce(p_district,'')))<2 or length(trim(coalesce(p_upazila,'')))<2 then
    raise exception 'Select a valid division, district and city/upazila.';
  end if;
  if normalized_district='rajshahi' and normalized_division<>'rajshahi' then
    raise exception 'Rajshahi District must belong to Rajshahi Division.';
  end if;
  if exists (
    select 1 from public.orders x
    where upper(btrim(x.bkash_trx_id))=normalized_trx
      and x.idempotency_key is distinct from p_idempotency_key
  ) then
    raise exception 'This transaction ID has already been used for another order.';
  end if;

  result := public.place_order(
    p_token,p_idempotency_key,p_customer_name,p_phone,p_email,
    p_district,p_upazila,p_address,p_instructions,null,p_coupon_code
  );
  select * into o from public.orders
  where order_number=result->>'orderNumber'
  for update;
  if not found then raise exception 'The order could not be retrieved after checkout.'; end if;

  if o.advance_payment_status='verified' then
    if upper(coalesce(o.bkash_trx_id,''))<>normalized_trx then
      raise exception 'This checkout has already been completed with a different payment transaction.';
    end if;
  elsif o.advance_payment_status='submitted' and o.bkash_trx_id is not null then
    if upper(coalesce(o.bkash_trx_id,''))<>normalized_trx
       or regexp_replace(coalesce(o.bkash_sender_phone,''),'[^0-9]','','g')<>normalized_sender then
      raise exception 'This checkout has already been submitted with different payment details.';
    end if;
  else
    update public.orders
    set division=trim(p_division), area=trim(p_upazila), status='received',
        bkash_trx_id=normalized_trx, bkash_sender_phone=normalized_sender,
        bkash_submitted_at=now(), bkash_reviewed_at=null, bkash_review_note=null,
        advance_payment_required=true, advance_payment_amount=200,
        advance_payment_status='submitted', updated_at=now()
    where id=o.id;
  end if;
  return jsonb_build_object(
    'orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount,
    'status','received','advancePaymentStatus','submitted'
  );
end;
$fn$;
revoke all on function public.place_order_with_location(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.place_order_with_location(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;

-- Only the checkout RPC can create an order; the legacy payment and customer-cancel endpoints are retired.
revoke all on function public.place_order(uuid,uuid,text,text,text,text,text,text,text,bigint,text) from public,anon,authenticated;
drop function if exists public.submit_bkash_payment(text,text,text,text);
drop function if exists public.cancel_order(text,text);

commit;
