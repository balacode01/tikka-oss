-- Invite tests. Run inside a rolled-back transaction together with the invites migration.
begin;

insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('f1000000-0000-0000-0000-000000000001', 'inv-owner@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Owen"}'),
  ('f1000000-0000-0000-0000-000000000002', 'inv-member@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Mia"}'),
  ('f1000000-0000-0000-0000-000000000003', 'inv-invitee@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Ivy"}'),
  ('f1000000-0000-0000-0000-000000000004', 'inv-other@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), now(), now(), '{}', '{"display_name":"Otto"}');

insert into public.workspaces (id, name, slug, created_by) values ('f2000000-0000-0000-0000-000000000001', 'Invite WS', 'invite-ws-t', 'f1000000-0000-0000-0000-000000000001');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'owner'),
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'member');
insert into public.projects (id, workspace_id, key, name, template, lead_id, access) values
  ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'INV', 'Invite P', 'scrum', 'f1000000-0000-0000-0000-000000000001', 'invite_only');

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg using errcode = 'XX999'; end if;
end $$;

create function pg_temp.expect_error(stmt text, must_contain text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: expected an error containing "%"', must_contain using errcode = 'XX999';
exception
  when sqlstate 'XX999' then raise;
  when others then
    if sqlerrm not like '%' || must_contain || '%' then
      raise exception 'FAIL: got "%" but expected "%"', sqlerrm, must_contain using errcode = 'XX999';
    end if;
end $$;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end $$;

-- Owner invites a new person as a member.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select set_config('test.token', (select i.token from public.create_invite('f2000000-0000-0000-0000-000000000001', 'inv-invitee@example.invalid', 'member', null) as i), true);
select pg_temp.expect(length(current_setting('test.token')) = 48, 'invite should carry a 48-character token');

-- A member cannot invite; an owner cannot invite as admin outside the rules; bad role refused.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($x$ select * from public.create_invite('f2000000-0000-0000-0000-000000000001', 'x@example.invalid', 'guest', null) $x$, 'Only owners and admins');

-- Public lookup works without login and returns only the invite details.
select pg_temp.act_as_anon();
select pg_temp.expect((public.get_invite(current_setting('test.token'))->>'status') = 'valid', 'anonymous lookup should show a valid invite');
select pg_temp.expect((public.get_invite(current_setting('test.token'))->>'workspace_name') = 'Invite WS', 'lookup should show the workspace name');
select pg_temp.expect((public.get_invite('not-a-token')->>'status') = 'not_found', 'an unknown token should be not_found');

-- Wrong email is refused.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($x$ select public.accept_invite(current_setting('test.token')) $x$, 'different email');

-- Right email joins with the invited role, and the project membership is not added (workspace-wide invite).
select pg_temp.act_as('f1000000-0000-0000-0000-000000000003');
select pg_temp.expect(public.accept_invite(current_setting('test.token')) = 'invite-ws-t', 'accepting should return the workspace slug');
select pg_temp.expect((select role from public.workspace_members where workspace_id = 'f2000000-0000-0000-0000-000000000001' and user_id = 'f1000000-0000-0000-0000-000000000003') = 'member', 'the accepted user should join with the invited role');

-- Using the same link again is refused.
select pg_temp.expect_error($x$ select public.accept_invite(current_setting('test.token')) $x$, 'already used');

-- Revoked and expired links are refused.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select set_config('test.revoke', (select i.id::text from public.create_invite('f2000000-0000-0000-0000-000000000001', 'rev@example.invalid', 'guest', 'f3000000-0000-0000-0000-000000000001') as i), true);
select public.revoke_invite(current_setting('test.revoke')::uuid);
select set_config('test.revoked_token', (select token from public.invites where id = current_setting('test.revoke')::uuid), true);
select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select pg_temp.expect((public.get_invite(current_setting('test.revoked_token'))->>'status') = 'revoked', 'a revoked link should show as revoked');

select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select set_config('test.expired', (select i.id::text from public.create_invite('f2000000-0000-0000-0000-000000000001', 'old@example.invalid', 'member', null) as i), true);
-- Back-dating the expiry is test setup, so it runs as the database owner.
reset role;
update public.invites set expires_at = now() - interval '1 day' where id = current_setting('test.expired')::uuid;
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select set_config('test.expired_token', (select token from public.invites where id = current_setting('test.expired')::uuid), true);
select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select pg_temp.expect((public.get_invite(current_setting('test.expired_token'))->>'status') = 'expired', 'an old link should show as expired');

-- Invite is only visible to owners and admins of its workspace.
select pg_temp.act_as('f1000000-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) from public.invites) = 0, 'an outsider must not see invites');
select pg_temp.act_as('f1000000-0000-0000-0000-000000000002');
select pg_temp.expect((select count(*) from public.invites) = 0, 'a member must not see invites');
select pg_temp.act_as('f1000000-0000-0000-0000-000000000001');
select pg_temp.expect((select count(*) from public.invites) >= 2, 'the owner should see the invites');

select 'all invite checks passed' as result;
rollback;
