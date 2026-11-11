do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'supabase_realtime publication does not exist';
  end if;
  foreach target_table in array array['products','product_variants','product_ratings','website_settings','orders','coupons'] loop
    if to_regclass('public.' || target_table) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = target_table
       ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
