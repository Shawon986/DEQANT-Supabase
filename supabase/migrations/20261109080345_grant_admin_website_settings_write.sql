-- Allow authenticated requests to reach INSERT/UPDATE on website_settings.
-- The existing "admin manage settings" RLS policy still restricts rows to is_admin().
-- SELECT is already granted and remains available for the existing public settings reader.
revoke insert, update on table public.website_settings from anon;
grant insert, update on table public.website_settings to authenticated;
