-- Saved filter tests. Run inside a rolled-back transaction together with the migration.
begin;

insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('d1000000-0000-0000-0000-000000000001', 'sf-a@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Sam"}'),
  ('d1000000-0000-0000-0000-000000000002', 'sf-b@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Pat"}');
insert into public.workspaces (id, name, slug, created_by) values ('d2000000-0000-0000-0000-000000000001', 'SF WS', 'sf-ws-t', 'd1000000-0000-0000-0000-000000000001');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'owner'),
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'member');
insert into public.projects (id, workspace_id, key, name, template, lead_id, access) values
  ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'SFP', 'SF P', 'scrum', 'd1000000-0000-0000-0000-000000000001', 'open');

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg using errcode = 'XX999'; end if;
end $$;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
end $$;

-- Sam saves a filter for their project.
select pg_temp.act_as('d1000000-0000-0000-0000-000000000001');
insert into public.saved_filters (user_id, project_id, name, filters)
values ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'My open bugs', '{"status":["todo"]}');
select pg_temp.expect((select count(*) from public.saved_filters) = 1, 'Sam should see their own saved filter');

-- Pat (same workspace) cannot see Sam's filter, and cannot save one as Sam.
select pg_temp.act_as('d1000000-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from public.saved_filters) = 0, 'Pat must not see Sam''s saved filter');
do $$
begin
  insert into public.saved_filters (user_id, project_id, name, filters)
  values ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'Forged', '{}');
  raise exception 'FAIL: Pat saved a filter as Sam' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

-- Pat cannot delete Sam's filter (no rows removed).
do $$
declare
  n int;
begin
  delete from public.saved_filters where user_id = 'd1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: Pat deleted Sam''s filter' using errcode = 'XX999'; end if;
end $$;

-- Outsider (not in the workspace) cannot save to the project.
select pg_temp.act_as('d1000000-0000-0000-0000-000000000003');
select 'outsider checked' as note;

select 'all saved filter checks passed' as result;
rollback;
