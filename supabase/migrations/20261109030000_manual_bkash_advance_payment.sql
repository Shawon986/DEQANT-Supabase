-- DEQANT manual bKash advance-payment workflow.
alter table public.orders
  add column if not exists advance_payment_required boolean not null default false,
  add column if not exists advance_payment_amount integer not null default 0,
  add column if not exists advance_payment_status text not null default 'not_required',
  add column if not exists bkash_trx_id text,
  add column if not exists bkash_sender_phone text,
  add column if not exists bkash_submitted_at timestamptz,
  add column if not exists bkash_reviewed_at timestamptz,
  add column if not exists bkash_review_note text;

alter table public.orders drop constraint if exists orders_advance_payment_amount_check;
alter table public.orders add constraint orders_advance_payment_amount_check
  check ((advance_payment_required = false and advance_payment_amount = 0) or (advance_payment_required = true and advance_payment_amount = 200));
alter table public.orders drop constraint if exists orders_advance_payment_status_check;
alter table public.orders add constraint orders_advance_payment_status_check
  check (advance_payment_status in ('not_required','awaiting_payment','submitted','verified','rejected'));

create unique index if not exists orders_bkash_trx_id_unique on public.orders (upper(btrim(bkash_trx_id)))
where bkash_trx_id is not null and btrim(bkash_trx_id) <> '';
create index if not exists orders_advance_payment_status_idx on public.orders (advance_payment_status, created_at desc);

create or replace function public.set_deqant_advance_payment_defaults()
returns trigger language plpgsql set search_path=public as $$
begin
  new.advance_payment_required := true;
  new.advance_payment_amount := 200;
  new.advance_payment_status := 'awaiting_payment';
  new.bkash_trx_id := null;
  new.bkash_sender_phone := null;
  new.bkash_submitted_at := null;
  new.bkash_reviewed_at := null;
  new.bkash_review_note := null;
  return new;
end;
$$;
drop trigger if exists orders_set_deqant_advance_payment on public.orders;
create trigger orders_set_deqant_advance_payment before insert on public.orders
for each row execute function public.set_deqant_advance_payment_defaults();

create or replace function public.guard_deqant_order_fulfilment()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.advance_payment_required and new.status in ('confirmed','processing','shipped','delivered')
     and new.advance_payment_status <> 'verified' then
    raise exception 'The ৳200 bKash advance payment must be verified before fulfilment.';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_guard_deqant_fulfilment on public.orders;
create trigger orders_guard_deqant_fulfilment before update of status, advance_payment_status on public.orders
for each row execute function public.guard_deqant_order_fulfilment();

create or replace function public.submit_bkash_payment(p_order_number text,p_phone text,p_trx_id text,p_sender_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; normalized_trx text; normalized_sender text;
begin
  perform public.consume_rate_limit('bkash_payment_submit',8,600);
  normalized_trx := upper(regexp_replace(trim(coalesce(p_trx_id,'')), '[^A-Za-z0-9]', '', 'g'));
  normalized_sender := regexp_replace(trim(coalesce(p_sender_phone,'')), '[^0-9]', '', 'g');
  if left(normalized_sender,3)='880' then normalized_sender := '0'||substr(normalized_sender,4); end if;
  if length(normalized_trx)<6 or length(normalized_trx)>32 then raise exception 'Enter a valid bKash transaction ID.'; end if;
  if normalized_sender !~ '^01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladeshi mobile number used to send the payment.'; end if;
  select * into o from public.orders where order_number=upper(trim(p_order_number)) and phone=trim(p_phone) for update;
  if not found then raise exception 'We could not find an order with those details.'; end if;
  if not o.advance_payment_required then raise exception 'This order does not require an advance payment.'; end if;
  if o.status='cancelled' then raise exception 'This order has been cancelled.'; end if;
  if o.advance_payment_status='verified' then raise exception 'The advance payment for this order is already verified.'; end if;
  if o.advance_payment_status='submitted' then raise exception 'Your transaction is already submitted and awaiting manual review.'; end if;
  if exists(select 1 from public.orders x where upper(btrim(x.bkash_trx_id))=normalized_trx and x.id<>o.id) then
    raise exception 'This transaction ID has already been used for another order.';
  end if;
  update public.orders set bkash_trx_id=normalized_trx,bkash_sender_phone=normalized_sender,bkash_submitted_at=now(),
    bkash_reviewed_at=null,bkash_review_note=null,advance_payment_status='submitted',updated_at=now() where id=o.id;
  return jsonb_build_object('orderNumber',o.order_number,'advancePaymentStatus','submitted','advancePaymentAmount',200);
end;
$$;

create or replace function public.admin_review_bkash_payment(p_order_id bigint,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if not o.advance_payment_required then raise exception 'This order does not require an advance payment.'; end if;
  if o.advance_payment_status <> 'submitted' then raise exception 'Only submitted bKash payments can be reviewed.'; end if;
  if p_approve then
    update public.orders set advance_payment_status='verified',bkash_reviewed_at=now(),
      bkash_review_note=nullif(left(trim(coalesce(p_note,'')),500),''),status='confirmed',updated_at=now() where id=o.id;
  else
    update public.orders set advance_payment_status='rejected',bkash_reviewed_at=now(),
      bkash_review_note=coalesce(nullif(left(trim(coalesce(p_note,'')),500),''),'Please check the transaction details and submit again.'),
      updated_at=now() where id=o.id;
  end if;
  return jsonb_build_object('success',true,'advancePaymentStatus',case when p_approve then 'verified' else 'rejected' end);
end;
$$;

create or replace function public.order_by_phone(p_order_number text,p_phone text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.orders; items jsonb;
begin
  perform public.consume_rate_limit('order_lookup',30,600);
  select * into o from public.orders where order_number=upper(trim(p_order_number)) and phone=trim(p_phone);
  if not found then raise exception 'We could not find an order with those details.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'productName',i.product_name,'brand',i.brand,'category',i.category,
    'sizeMl',i.size_ml,'quantity',i.quantity,'unitPrice',i.unit_price,'originalPrice',i.original_price,'lineTotal',i.line_total)),'[]'::jsonb)
  into items from public.order_items i where i.order_id=o.id;
  return jsonb_build_object('order',jsonb_build_object('id',o.id,'orderNumber',o.order_number,'customerName',o.customer_name,
    'phone',o.phone,'email',o.email,'district',o.district,'area',o.area,'address',o.address,'instructions',o.instructions,
    'subtotal',o.subtotal,'deliveryFee',o.delivery_fee,'discountAmount',o.discount_amount,'couponCode',o.coupon_code,
    'total',o.total,'status',o.status,'created_at',o.created_at,'advancePaymentRequired',o.advance_payment_required,
    'advancePaymentAmount',o.advance_payment_amount,'advancePaymentStatus',o.advance_payment_status,
    'bkashTrxId',o.bkash_trx_id,'bkashSenderPhone',o.bkash_sender_phone,'bkashSubmittedAt',o.bkash_submitted_at,
    'bkashReviewedAt',o.bkash_reviewed_at,'bkashReviewNote',o.bkash_review_note),'items',items);
end;
$$;

insert into public.website_settings(setting_key,setting_value) values ('bkashNumber','') on conflict(setting_key) do nothing;
revoke all on function public.set_deqant_advance_payment_defaults() from public,anon,authenticated;
revoke all on function public.guard_deqant_order_fulfilment() from public,anon,authenticated;
revoke all on function public.submit_bkash_payment(text,text,text,text) from public;
grant execute on function public.submit_bkash_payment(text,text,text,text) to anon,authenticated;
revoke all on function public.admin_review_bkash_payment(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_review_bkash_payment(bigint,boolean,text) to authenticated;
revoke all on function public.order_by_phone(text,text) from public;
grant execute on function public.order_by_phone(text,text) to anon,authenticated;
