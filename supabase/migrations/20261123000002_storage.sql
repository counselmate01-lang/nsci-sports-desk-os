-- =====================================================================
-- Private file storage for uploaded documents (quotations, PDFs, images).
-- Files are only readable by signed-in team members, via short-lived links.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "team reads documents" on storage.objects;
create policy "team reads documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_team_member());

drop policy if exists "editors upload documents" on storage.objects;
create policy "editors upload documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.can_edit());

drop policy if exists "editors delete documents" on storage.objects;
create policy "editors delete documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.can_edit());
