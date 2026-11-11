-- Allow administrators to permanently delete customer enquiries.
-- RLS keeps this capability unavailable to ordinary authenticated customers.
drop policy if exists "admin delete messages" on public.contact_messages;
create policy "admin delete messages" on public.contact_messages
for delete to authenticated
using (public.is_admin());
grant delete on table public.contact_messages to authenticated;
