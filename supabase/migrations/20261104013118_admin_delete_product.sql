create or replace function public.admin_delete_product(p_product_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  deleted_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  delete from public.products
  where id = p_product_id
  returning * into deleted_product;

  if not found then
    raise exception 'Product not found.';
  end if;

  return to_jsonb(deleted_product);
end;
$function$;

revoke all on function public.admin_delete_product(bigint) from public;
grant execute on function public.admin_delete_product(bigint) to authenticated;
