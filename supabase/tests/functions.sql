-- Function tests for M3 (BRD §6.4 and M3 "Done when").
-- Run: (echo 'begin;'; cat supabase/migrations/*_functions.sql; cat supabase/tests/functions.sql) | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
-- Runs in one transaction that is rolled back. A failed check raises FAIL and stops the run.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two users, created as the owner (bypasses RLS).
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'fn-a@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Ann"}'),
  ('b1000000-0000-0000-0000-000000000002', 'fn-b@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Ben"}');

-- ---------------------------------------------------------------------------
-- Helpers
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

-- Runs stmt and expects an error whose message contains must_contain.
create function pg_temp.expect_error(stmt text, must_contain text)
returns void
language plpgsql
as $$
begin
  execute stmt;
  raise exception 'FAIL: expected an error containing "%"', must_contain using errcode = 'XX999';
exception
  when sqlstate 'XX999' then
    raise;
  when others then
    if sqlerrm not like '%' || must_contain || '%' then
      raise exception 'FAIL: got "%" but expected "%"', sqlerrm, must_contain using errcode = 'XX999';
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
-- User A: workspace, project, statuses
-- ---------------------------------------------------------------------------

select pg_temp.act_as_anon();
select pg_temp.expect_error($x$ select * from public.create_workspace('Anon', 'anon-ws') $x$, 'permission denied');

select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');

select set_config('test.ws', (select w.id from public.create_workspace('Test A', 'test-a-ws') as w)::text, true);
select pg_temp.expect(
  (select m.role from public.workspace_members as m
   where m.workspace_id = current_setting('test.ws')::uuid and m.user_id = 'a1000000-0000-0000-0000-000000000001') = 'owner',
  'creator should be the workspace owner'
);

select pg_temp.expect_error($x$ select * from public.create_workspace('Dup', 'test-a-ws') $x$, 'is taken');

select pg_temp.expect_error(
  $x$ select * from public.create_project(current_setting('test.ws')::uuid, 'Bad', 'mob', 'scrum', 'open') $x$,
  'capital letters'
);
select pg_temp.expect_error(
  $x$ select * from public.create_project(current_setting('test.ws')::uuid, 'Bad', 'MOBILEAPPLICATION', 'scrum', 'open') $x$,
  'capital letters'
);

select set_config('test.proj', (select p.id from public.create_project(current_setting('test.ws')::uuid, 'Mobile app', 'MOB', 'scrum', 'open') as p)::text, true);
select pg_temp.expect(
  (select count(*) from public.statuses where project_id = current_setting('test.proj')::uuid) = 8,
  'create_project should create the eight default statuses, from To do to Done'
);
select pg_temp.expect(
  (select count(*) from public.project_members
   where project_id = current_setting('test.proj')::uuid and user_id = 'a1000000-0000-0000-0000-000000000001') = 1,
  'create_project should add the caller as a project member'
);

select pg_temp.expect_error(
  $x$ select * from public.create_project(current_setting('test.ws')::uuid, 'Again', 'MOB', 'scrum', 'open') $x$,
  'already used'
);

select set_config('test.todo', (select st.id from public.statuses as st
  where st.project_id = current_setting('test.proj')::uuid and st.name = 'To do')::text, true);
select set_config('test.done', (select st.id from public.statuses as st
  where st.project_id = current_setting('test.proj')::uuid and st.name = 'Done')::text, true);

-- ---------------------------------------------------------------------------
-- Issues: numbering, labels, default status, rank and history
-- ---------------------------------------------------------------------------

select set_config('test.i1', (select i.id from public.create_issue(
  current_setting('test.proj')::uuid, 'story', 'First', null, null, null, null, null, null, null,
  3, null, array['frontend', ' ', 'frontend']) as i)::text, true);
select set_config('test.i2', (select i.id from public.create_issue(
  current_setting('test.proj')::uuid, 'task', 'Second', null, null, null, null, null, null, null,
  null, null, null) as i)::text, true);
select set_config('test.i3', (select i.id from public.create_issue(
  current_setting('test.proj')::uuid, 'bug', 'Third', null, null, null, null, null, null, null,
  null, null, null) as i)::text, true);

select pg_temp.expect(
  (select i.key from public.issues as i where i.id = current_setting('test.i1')::uuid) = 'MOB-1',
  'first issue should be MOB-1'
);
select pg_temp.expect(
  (select i.status_id from public.issues as i where i.id = current_setting('test.i1')::uuid) = current_setting('test.todo')::uuid,
  'a new issue should default to the To do status'
);
select pg_temp.expect(
  (select i.rank from public.issues as i where i.id = current_setting('test.i3')::uuid) = 3000,
  'a new issue should go to the bottom of the column (rank 3000)'
);
select pg_temp.expect(
  (select count(*) from public.issue_labels where issue_id = current_setting('test.i1')::uuid) = 1,
  'labels should be trimmed, de-duplicated and blanks skipped'
);

-- Move Third between First (above) and Second (below): rank should be the midpoint.
select public.move_issue(
  current_setting('test.i3')::uuid, null,
  current_setting('test.i1')::uuid, current_setting('test.i2')::uuid
);
select pg_temp.expect(
  (select i.rank from public.issues as i where i.id = current_setting('test.i3')::uuid) = 1500,
  'move_issue should place the issue at the midpoint of its neighbours'
);

-- Move Second to Done: status changes and one history row is written.
select public.move_issue(current_setting('test.i2')::uuid, current_setting('test.done')::uuid, null, null);
select pg_temp.expect(
  (select count(*) from public.issue_history
   where issue_id = current_setting('test.i2')::uuid and field = 'status_id'
     and actor_id = 'a1000000-0000-0000-0000-000000000001') = 1,
  'a status move should write one history row with the caller as actor'
);

-- ---------------------------------------------------------------------------
-- Sprints: one active sprint per project, and completion moves open issues
-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select set_config('test.s1', 'a6000000-0000-0000-0000-000000000001', true);
select set_config('test.s2', 'a6000000-0000-0000-0000-000000000002', true);
insert into public.sprints (id, project_id, name, state) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('test.proj')::uuid, 'Sprint 1', 'planned'),
  ('a6000000-0000-0000-0000-000000000002', current_setting('test.proj')::uuid, 'Sprint 2', 'planned');

select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');

select public.start_sprint(current_setting('test.s1')::uuid, 'Ship the thing', null);
select pg_temp.expect(
  (select s.state from public.sprints as s where s.id = current_setting('test.s1')::uuid) = 'active',
  'start_sprint should make the sprint active'
);
select pg_temp.expect_error(
  $x$ select * from public.start_sprint(current_setting('test.s2')::uuid, null, null) $x$,
  'Another sprint is already active'
);

select set_config('test.i4', (select i.id from public.create_issue(
  current_setting('test.proj')::uuid, 'task', 'Open in sprint', null, null, null, null,
  current_setting('test.s1')::uuid, null, null, null, null, null) as i)::text, true);

select public.complete_sprint(current_setting('test.s1')::uuid, current_setting('test.s2')::uuid);
select pg_temp.expect(
  (select i.sprint_id from public.issues as i where i.id = current_setting('test.i4')::uuid) = current_setting('test.s2')::uuid,
  'completing a sprint should move its open issues to the chosen sprint'
);
select pg_temp.expect(
  (select s.state from public.sprints as s where s.id = current_setting('test.s1')::uuid) = 'completed',
  'complete_sprint should mark the sprint completed'
);

-- ---------------------------------------------------------------------------
-- Bulk update, views, search, delete and home
-- ---------------------------------------------------------------------------

select pg_temp.expect(
  public.bulk_update_issues(
    array[current_setting('test.i1')::uuid, current_setting('test.i3')::uuid],
    null, 'a1000000-0000-0000-0000-000000000001', false, true
  ) = 2,
  'bulk_update_issues should assign both issues'
);

select public.record_view(current_setting('test.i1')::uuid);
select public.record_view(current_setting('test.i1')::uuid);
select pg_temp.expect(
  (select count(*) from public.recently_viewed) = 1,
  'record_view should keep one row per issue, not one per visit'
);

select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, 'MOB')->'issues') = 4,
  'search by key prefix should find the four open MOB issues'
);
select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, 'First')->'issues') = 1,
  'search by title should find the matching issue'
);
select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, '%')->'issues') = 0,
  'a wildcard in the query should match literally, not everything'
);

select pg_temp.expect(
  public.delete_issues(array[current_setting('test.i4')::uuid]) = 1,
  'delete_issues should soft delete one issue'
);
select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, 'MOB')->'issues') = 3,
  'soft-deleted issues should not appear in search'
);

select pg_temp.expect(
  jsonb_array_length(public.home(current_setting('test.ws')::uuid)->'assigned') = 2,
  'home should list the open issues assigned to the caller (First and Third)'
);
select pg_temp.expect(
  jsonb_array_length(public.home(current_setting('test.ws')::uuid)->'recently_viewed') = 1,
  'home should include recently viewed issues'
);
select pg_temp.expect(
  (public.home(current_setting('test.ws')::uuid)->'projects'->0->'active_sprint') = 'null'::jsonb,
  'home should show no active sprint once Sprint 1 is completed'
);

-- ---------------------------------------------------------------------------
-- User B: no access to A's workspace
-- ---------------------------------------------------------------------------

select pg_temp.act_as('b1000000-0000-0000-0000-000000000002');

select set_config('test.wsb', (select w.id from public.create_workspace('Test B', 'test-b-ws') as w)::text, true);

select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, 'MOB')->'issues') = 0,
  'search must not return issues from another workspace'
);
select pg_temp.expect(
  jsonb_array_length(public.search(current_setting('test.ws')::uuid, 'MOB')->'projects') = 0,
  'search must not return projects from another workspace'
);
select pg_temp.expect(
  jsonb_array_length(public.home(current_setting('test.ws')::uuid)->'assigned') = 0,
  'home for another workspace should show nothing'
);
select pg_temp.expect_error(
  $x$ select * from public.create_issue(current_setting('test.proj')::uuid, 'task', 'Sneaky', null, current_setting('test.todo')::uuid, null, null, null, null, null, null, null, null) $x$,
  'row-level security'
);
select pg_temp.expect_error(
  $x$ select * from public.move_issue(current_setting('test.i1')::uuid, null, null, null) $x$,
  'not found'
);
select pg_temp.expect_error(
  $x$ select * from public.create_project(current_setting('test.ws')::uuid, 'Intruder', 'INT', 'scrum', 'open') $x$,
  'Only workspace members'
);

-- ---------------------------------------------------------------------------

select pg_temp.act_as_owner();
select 'all function checks passed' as result;

rollback;
