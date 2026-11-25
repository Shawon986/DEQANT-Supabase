create or replace function public.place_order_with_zone(
  p_token uuid,
  p_idempotency_key uuid,
  p_customer_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_instructions text,
  p_delivery_zone_id bigint,
  p_coupon_code text default null,
  p_bkash_trx_id text default null,
  p_bkash_sender_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  result jsonb;
  o public.orders;
  z public.delivery_zones;
  normalized_trx text;
  normalized_sender text;
begin
  perform public.consume_rate_limit('checkout_payment:' || md5(coalesce(p_token::text, '')), 8, 600);
  normalized_trx := upper(regexp_replace(trim(coalesce(p_bkash_trx_id, '')), '[^A-Za-z0-9]', '', 'g'));
  normalized_sender := regexp_replace(trim(coalesce(p_bkash_sender_phone, '')), '[^0-9]', '', 'g');
  if left(normalized_sender, 3) = '880' then normalized_sender := '0' || substr(normalized_sender, 4); end if;
  if length(normalized_trx) < 6 or length(normalized_trx) > 32 or normalized_trx !~ '^[A-Z0-9]+$' then raise exception 'Enter a valid bKash transaction ID.'; end if;
  if normalized_sender !~ '^01[3-9][0-9]{8}$' then raise exception 'Enter a valid Bangladeshi mobile number used to send the payment.'; end if;
  if length(trim(coalesce(p_address, ''))) < 8 then raise exception 'Enter your detailed delivery address (at least 8 characters).'; end if;
  select * into z from public.delivery_zones where id = p_delivery_zone_id and active = true and name in ('Inside Rajshahi', 'Outside Rajshahi') for share;
  if not found then raise exception 'Choose a valid delivery area.'; end if;
  if exists (select 1 from public.orders x where upper(btrim(x.bkash_trx_id)) = normalized_trx and x.idempotency_key is distinct from p_idempotency_key) then
    raise exception 'This transaction ID has already been used for another order.';
  end if;
  result := public.place_order(p_token,p_idempotency_key,p_customer_name,p_phone,p_email,
    case when z.name = 'Inside Rajshahi' then 'Rajshahi' else 'Outside Rajshahi' end,
    'Delivery address',p_address,p_instructions,null,p_coupon_code);
  select * into o from public.orders where order_number = result->>'orderNumber' for update;
  if not found then raise exception 'The order could not be retrieved after checkout.'; end if;
  if o.advance_payment_status = 'verified' then
    if upper(coalesce(o.bkash_trx_id, '')) <> normalized_trx then raise exception 'This checkout has already been completed with a different payment transaction.'; end if;
  elsif o.advance_payment_status = 'submitted' and o.bkash_trx_id is not null then
    if upper(coalesce(o.bkash_trx_id, '')) <> normalized_trx or regexp_replace(coalesce(o.bkash_sender_phone, ''), '[^0-9]', '', 'g') <> normalized_sender then
      raise exception 'This checkout has already been submitted with different payment details.';
    end if;
  else
    update public.orders set division='',district='',area='',address=trim(p_address),delivery_zone_id=z.id,
      status='received',bkash_trx_id=normalized_trx,bkash_sender_phone=normalized_sender,bkash_submitted_at=now(),
      bkash_reviewed_at=null,bkash_review_note=null,advance_payment_required=true,advance_payment_amount=200,
      advance_payment_status='submitted',updated_at=now() where id=o.id;
  end if;
  return jsonb_build_object('orderNumber',o.order_number,'total',o.total,'discount',o.discount_amount,'status','received','advancePaymentStatus','submitted');
end;
$function$;
revoke all on function public.place_order_with_zone(uuid,uuid,text,text,text,text,text,bigint,text,text,text) from public;
grant execute on function public.place_order_with_zone(uuid,uuid,text,text,text,text,text,bigint,text,text,text) to anon, authenticated, service_role;
