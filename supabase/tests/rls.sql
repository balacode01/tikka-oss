-- RLS tests for M2 (BRD §6.5 and §1).
-- Run: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Everything runs in one transaction that is rolled back, so no test data is kept.
-- A failed check raises an error with the FAIL prefix and stops the run.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures, created as the owner (bypasses RLS).
-- User A owns workspace A. User B owns workspace B. Guest G is a guest in A.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'rls-a@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Ann"}'),
  ('b1000000-0000-0000-0000-000000000002', 'rls-b@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Ben"}'),
  ('c1000000-0000-0000-0000-000000000003', 'rls-g@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Gus"}');

insert into public.workspaces (id, name, slug, created_by) values
  ('a2000000-0000-0000-0000-000000000001', 'RLS A', 'rls-a-ws', 'a1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'RLS B', 'rls-b-ws', 'b1000000-0000-0000-0000-000000000002');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('a2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'guest'),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'owner');

insert into public.projects (id, workspace_id, key, name, template, lead_id, access) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'RLA', 'Open A', 'scrum', 'a1000000-0000-0000-0000-000000000001', 'open'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'RLI', 'Invite A', 'kanban', 'a1000000-0000-0000-0000-000000000001', 'invite_only'),
  ('b3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000002', 'RLB', 'Open B', 'scrum', 'b1000000-0000-0000-0000-000000000002', 'open');

insert into public.project_members (project_id, user_id) values
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001');

insert into public.statuses (id, project_id, name, category, position) values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'To do', 'todo', 1),
  ('a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'Done', 'done', 2),
  ('b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000003', 'To do', 'todo', 1);

insert into public.issues (id, project_id, type, title, status_id, reporter_id) values
  ('a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'task', 'A one', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000003', 'task', 'B one', 'b4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Helpers. They switch the role and the JWT subject for this transaction only.
-- ---------------------------------------------------------------------------

create function pg_temp.expect(ok boolean, msg text)
returns void
language plpgsql
as $$
begin
  if not ok then
    raise exception 'FAIL: %', msg using errcode = 'XX999';
  end if;
end $$;

create function pg_temp.act_as(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
end $$;

create function pg_temp.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end $$;

create function pg_temp.act_as_owner()
returns void
language plpgsql
as $$
begin
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- User A (owner of workspace A)
-- ---------------------------------------------------------------------------

select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');

select pg_temp.expect((select count(*) from public.workspaces) = 1, 'A should see exactly one workspace');
select pg_temp.expect((select count(*) from public.workspaces where id = 'b2000000-0000-0000-0000-000000000002') = 0, 'A must not see workspace B');
select pg_temp.expect((select count(*) from public.projects) = 2, 'A should see the 2 projects in workspace A (open and invite-only, as a member)');
select pg_temp.expect((select count(*) from public.projects where id = 'b3000000-0000-0000-0000-000000000003') = 0, 'A must not see project B');
select pg_temp.expect((select count(*) from public.issues) = 1, 'A should see only issue A one');
select pg_temp.expect((select count(*) from public.issues where project_id = 'b3000000-0000-0000-0000-000000000003') = 0, 'A must not see issues of project B');
select pg_temp.expect((select count(*) from public.statuses where project_id = 'b3000000-0000-0000-0000-000000000003') = 0, 'A must not see statuses of project B');
select pg_temp.expect((select count(*) from public.workspace_members) = 2, 'A should see both members of workspace A');
select pg_temp.expect((select count(*) from public.profiles) = 2, 'A should see own profile and guest Gus (shared workspace), not Ben');
select pg_temp.expect((select count(*) from public.profiles where id = 'b1000000-0000-0000-0000-000000000002') = 0, 'A must not see Ben profile');

-- Denied writes: RLS rejects these with insufficient_privilege (42501).
do $$
begin
  insert into public.issues (project_id, type, title, status_id, reporter_id)
  values ('b3000000-0000-0000-0000-000000000003', 'task', 'sneaky', 'b4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: A created an issue in project B' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

do $$
begin
  insert into public.issues (project_id, type, title, status_id, reporter_id)
  values ('a3000000-0000-0000-0000-000000000001', 'task', 'spoof', 'a4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: A set reporter to Ben' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

do $$
begin
  insert into public.issues (project_id, type, title, status_id, reporter_id, assignee_id)
  values ('a3000000-0000-0000-0000-000000000001', 'task', 'outsider', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: A assigned an issue to a user outside the workspace' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

-- Silent filtering: an update to a row A cannot see changes nothing.
do $$
declare
  n int;
begin
  update public.issues set title = 'hacked' where id = 'b5000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: A updated Ben issue (% rows)', n using errcode = 'XX999';
  end if;
end $$;

-- Identity guard: an issue cannot move to another project.
do $$
begin
  update public.issues set project_id = 'a3000000-0000-0000-0000-000000000002' where id = 'a5000000-0000-0000-0000-000000000001';
  raise exception 'FAIL: an issue moved between projects' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

-- Allowed writes for A.
insert into public.issues (project_id, type, title, status_id, reporter_id)
values ('a3000000-0000-0000-0000-000000000001', 'task', 'A two', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

select pg_temp.expect((select count(*) from public.issues) = 2, 'A should now see two issues');

update public.issues set status_id = 'a4000000-0000-0000-0000-000000000002' where id = 'a5000000-0000-0000-0000-000000000001';

select pg_temp.expect(
  (select count(*) from public.issue_history
   where issue_id = 'a5000000-0000-0000-0000-000000000001' and field = 'status_id' and actor_id = 'a1000000-0000-0000-0000-000000000001') = 1,
  'the status change should write one history row with A as actor'
);
select pg_temp.expect((select count(*) from public.issue_history where project_id = 'b3000000-0000-0000-0000-000000000003') = 0, 'A must not see history of project B');

-- ---------------------------------------------------------------------------
-- Guest Gus (guest in workspace A)
-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select pg_temp.act_as('c1000000-0000-0000-0000-000000000003');

select pg_temp.expect((select count(*) from public.projects) = 0, 'a guest must not see open projects without membership');
select pg_temp.expect((select count(*) from public.issues) = 0, 'a guest must not see issues without membership');

-- Add Gus to the open project as a member (owner-side setup).
select pg_temp.act_as_owner();
insert into public.project_members (project_id, user_id) values
  ('a3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003');
select pg_temp.act_as('c1000000-0000-0000-0000-000000000003');

select pg_temp.expect((select count(*) from public.projects) = 1, 'a guest member should see only the project they belong to');
select pg_temp.expect((select count(*) from public.issues) = 2, 'a guest member should see the issues of that project');

insert into public.comments (issue_id, author_id, body)
values ('a5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Looks good');
select pg_temp.expect((select count(*) from public.comments) = 1, 'a guest should be able to comment');

do $$
begin
  insert into public.comments (issue_id, author_id, body)
  values ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'impersonation');
  raise exception 'FAIL: a guest commented as another user' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

do $$
declare
  n int;
begin
  update public.issues set status_id = 'a4000000-0000-0000-0000-000000000001' where id = 'a5000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: a guest changed an issue status' using errcode = 'XX999';
  end if;
end $$;

do $$
begin
  insert into public.issues (project_id, type, title, status_id, reporter_id)
  values ('a3000000-0000-0000-0000-000000000001', 'task', 'guest issue', 'a4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003');
  raise exception 'FAIL: a guest created an issue' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

do $$
declare
  n int;
begin
  update public.projects set name = 'renamed by guest' where id = 'a3000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: a guest changed project settings' using errcode = 'XX999';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- User B (owner of workspace B)
-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');

select pg_temp.expect((select count(*) from public.workspaces) = 1, 'B should see only workspace B');
select pg_temp.expect((select count(*) from public.projects) = 1, 'B should see only project B');
select pg_temp.expect((select count(*) from public.issues) = 1, 'B should see only issue B one');
select pg_temp.expect((select count(*) from public.issues where project_id = 'a3000000-0000-0000-0000-000000000001') = 0, 'B must not see issues of workspace A');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'B should see only their own profile');
select pg_temp.expect((select count(*) from public.comments) = 0, 'B must not see comments from workspace A');

-- ---------------------------------------------------------------------------
-- Anonymous (no session)
-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select pg_temp.act_as_anon();

do $$
begin
  perform 1 from public.issues limit 1;
  raise exception 'FAIL: anonymous read issues' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

do $$
begin
  perform 1 from public.backlog_view limit 1;
  raise exception 'FAIL: anonymous read backlog_view' using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then null;
end $$;

-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select 'all RLS checks passed' as result;

rollback;
