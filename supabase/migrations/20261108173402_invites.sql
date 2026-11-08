-- Invites: an owner or admin creates a link for one email. The link works with or without a Tikka account.
-- The token is random and unique. The invited email must match the account that accepts.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role text not null check (role in ('admin', 'member', 'guest')),
  project_id uuid references public.projects (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index on public.invites (workspace_id);
create index on public.invites (project_id);

alter table public.invites enable row level security;

-- Owners and admins of the workspace can see its invites. Nothing is written directly.
create policy invites_select on public.invites
  for select to authenticated
  using (private.workspace_role(workspace_id) in ('owner', 'admin'));

grant select on public.invites to authenticated;

-- Owners and admins can invite. Only an owner can invite an admin. Reuses an open invite for the same email.
create function public.create_invite(p_workspace uuid, p_email text, p_role text, p_project uuid)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := private.workspace_role(p_workspace);
  v_email text := lower(trim(p_email));
  inv public.invites;
begin
  if auth.uid() is null or caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite people' using errcode = '42501';
  end if;
  if p_role = 'admin' and caller_role <> 'owner' then
    raise exception 'Only the owner can invite an admin' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member', 'guest') then
    raise exception 'Choose a role: admin, member or guest' using errcode = '22023';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if p_project is not null and not exists (
    select 1 from public.projects as pr where pr.id = p_project and pr.workspace_id = p_workspace
  ) then
    raise exception 'That project is not in this workspace' using errcode = '22023';
  end if;

  select * into inv
  from public.invites as i
  where i.workspace_id = p_workspace and i.email = v_email
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  limit 1;

  if found then
    update public.invites set role = p_role, project_id = p_project, invited_by = auth.uid()
    where id = inv.id
    returning * into inv;
  else
    insert into public.invites (workspace_id, email, role, project_id, invited_by)
    values (p_workspace, v_email, p_role, p_project, auth.uid())
    returning * into inv;
  end if;

  return inv;
end $$;

-- Public read of what the invite page needs. The token is the only key, so nothing else is exposed.
create function public.get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  ws public.workspaces;
  inviter text;
  status text;
begin
  select * into inv from public.invites as i where i.token = p_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into ws from public.workspaces as w where w.id = inv.workspace_id;
  select p.display_name into inviter from public.profiles as p where p.id = inv.invited_by;

  status := case
    when inv.revoked_at is not null then 'revoked'
    when inv.accepted_at is not null then 'used'
    when inv.expires_at <= now() then 'expired'
    else 'valid'
  end;

  return jsonb_build_object(
    'status', status,
    'workspace_name', ws.name,
    'inviter_name', coalesce(inviter, 'A teammate'),
    'role', inv.role,
    'email', inv.email
  );
end $$;

-- Accepts for the signed-in account. The account's email must match the invited email.
create function public.accept_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  ws public.workspaces;
  me uuid := auth.uid();
  my_email text;
begin
  if me is null then
    raise exception 'Log in to accept this invite' using errcode = '42501';
  end if;

  select * into inv from public.invites as i where i.token = p_token for update;
  if not found then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  if inv.revoked_at is not null then
    raise exception 'This invite was revoked. Ask for a new one' using errcode = '22023';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invite was already used' using errcode = '22023';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invite has expired. Ask for a new one' using errcode = '22023';
  end if;

  select lower(u.email) into my_email from auth.users as u where u.id = me;
  if my_email is distinct from inv.email then
    raise exception 'This invite was sent to a different email. Log in with %.', inv.email using errcode = '42501';
  end if;

  select * into ws from public.workspaces as w where w.id = inv.workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, me, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  if inv.project_id is not null then
    insert into public.project_members (project_id, user_id)
    values (inv.project_id, me)
    on conflict (project_id, user_id) do nothing;
  end if;

  update public.invites set accepted_by = me, accepted_at = now() where id = inv.id;

  return ws.slug;
end $$;

-- Owners and admins can revoke an open invite.
create function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites as i where i.id = p_invite;
  if not found or private.workspace_role(inv.workspace_id) not in ('owner', 'admin') then
    raise exception 'You cannot revoke this invite' using errcode = '42501';
  end if;
  update public.invites set revoked_at = now() where id = inv.id and accepted_at is null;
end $$;

revoke execute on function public.create_invite(uuid, text, text, uuid) from public, anon;
revoke execute on function public.get_invite(text) from public;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.create_invite(uuid, text, text, uuid) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
