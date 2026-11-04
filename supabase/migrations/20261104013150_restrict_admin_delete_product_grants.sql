revoke all on function public.admin_delete_product(bigint) from public, anon;
grant execute on function public.admin_delete_product(bigint) to authenticated, service_role;
