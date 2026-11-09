-- Do not allow an administrator to resurrect a cancelled order while reviewing a payment.
create or replace function public.admin_review_bkash_payment(p_order_id bigint,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if not o.advance_payment_required then raise exception 'This order does not require an advance payment.'; end if;
  if o.advance_payment_status <> 'submitted' then raise exception 'Only submitted bKash payments can be reviewed.'; end if;
  if p_approve and o.status='cancelled' then raise exception 'A cancelled order cannot be approved. Keep it cancelled and handle the payment separately.'; end if;
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
revoke all on function public.admin_review_bkash_payment(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_review_bkash_payment(bigint,boolean,text) to authenticated;
