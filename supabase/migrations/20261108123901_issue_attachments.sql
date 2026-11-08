-- Issue attachments: a private storage bucket plus the rules for who can add, read and remove files.
-- Files are stored at <issue_id>/<file name>. The rules follow the issue's project access (BRD §6.5).

insert into storage.buckets (id, name, public, file_size_limit)
values ('issue-attachments', 'issue-attachments', false, 26214400)
on conflict (id) do nothing;

-- Read: anyone who can see the issue.
create policy issue_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-attachments'
    and exists (
      select 1 from public.issues as i
      where i.id::text = split_part(name, '/', 1)
        and private.can_see_project(i.project_id)
    )
  );

-- Upload: members who can edit the issue (not guests).
create policy issue_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'issue-attachments'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id::text = split_part(name, '/', 1)
        and private.can_edit_project(i.project_id)
    )
  );

-- Remove: only the person who uploaded the file, and only while they can edit the issue.
create policy issue_attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'issue-attachments'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id::text = split_part(name, '/', 1)
        and private.can_edit_project(i.project_id)
    )
  );

-- Attachment rows: the table already has a read policy. Add write rules that match storage.
grant delete on public.attachments to authenticated;

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = attachments.issue_id
        and private.can_edit_project(i.project_id)
    )
  );

create policy attachments_delete_own on public.attachments
  for delete to authenticated
  using (uploader_id = (select auth.uid()));

grant insert (issue_id, uploader_id, storage_path, file_name, mime_type, size_bytes) on public.attachments to authenticated;
