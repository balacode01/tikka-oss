-- M2: helper functions, RLS policies and grants (BRD §6.5).
-- Each policy has a matching grant. Anything without a policy stays closed.

-- ---------------------------------------------------------------------------
-- Private helpers. Not exposed through the Data API.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

create function private.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_members as m
  where m.workspace_id = ws
    and m.user_id = (select auth.uid());
$$;

-- Open projects are visible to every workspace member except guests.
-- Invite-only projects are visible only to project members.
create function private.can_see_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects as pr
    where pr.id = p
      and private.is_workspace_member(pr.workspace_id)
      and (
        (pr.access = 'open' and private.workspace_role(pr.workspace_id) <> 'guest')
        or exists (
          select 1
          from public.project_members as pm
          where pm.project_id = pr.id
            and pm.user_id = (select auth.uid())
        )
      )
  );
$$;

-- An assignee must be a non-guest member of the project's workspace (or unassigned).
create function private.is_assignable(p uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select u is null or exists (
    select 1
    from public.projects as pr
    join public.workspace_members as m
      on m.workspace_id = pr.workspace_id
    where pr.id = p
      and m.user_id = u
      and m.role <> 'guest'
  );
$$;

-- Guests can see and comment, but cannot change issues, sprints or settings.
create function private.can_edit_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects as pr
    where pr.id = p
      and private.can_see_project(p)
      and private.workspace_role(pr.workspace_id) in ('owner', 'admin', 'member')
  );
$$;

-- True when the caller and the profile share a workspace.
create function private.shares_workspace_with(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as mine
    join public.workspace_members as theirs
      on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profile_id
  );
$$;

revoke execute on function private.is_workspace_member(uuid) from public, anon;
revoke execute on function private.workspace_role(uuid) from public, anon;
revoke execute on function private.can_see_project(uuid) from public, anon;
revoke execute on function private.can_edit_project(uuid) from public, anon;
revoke execute on function private.shares_workspace_with(uuid) from public, anon;
revoke execute on function private.is_assignable(uuid, uuid) from public, anon;

grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.can_see_project(uuid) to authenticated;
grant execute on function private.can_edit_project(uuid) to authenticated;
grant execute on function private.shares_workspace_with(uuid) to authenticated;
grant execute on function private.is_assignable(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard: an issue cannot move between projects, and its number and key are
-- fixed once assigned. Policies cannot express this, so a trigger does.
-- ---------------------------------------------------------------------------

create function public.protect_issue_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id <> old.project_id
     or new.number <> old.number
     or new.key <> old.key then
    raise exception 'an issue cannot change project, number or key';
  end if;
  return new;
end $$;

revoke execute on function public.protect_issue_identity() from public, anon, authenticated;

-- Numbering bumps projects.next_number, a column API users cannot update. Run the
-- trigger as its owner (empty search_path, so no name hijacking) so inserts work.
alter function public.assign_issue_number() security definer;
revoke execute on function public.assign_issue_number() from public, anon, authenticated;

create trigger issues_protect_identity
before update on public.issues
for each row execute function public.protect_issue_identity();

-- ---------------------------------------------------------------------------
-- Policies (BRD §6.5). Direct writes exist only where BRD allows them.
-- Create workspace, create project and the other §6.4 functions do the rest.
-- ---------------------------------------------------------------------------

-- profiles: see people you share a workspace with (and yourself); edit only your own row.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace_with(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- workspaces, workspace_members: read only. Created by create_workspace.
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (private.is_workspace_member(id));

create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- projects: read when visible; update when the caller can edit (not guests).
-- Insert goes through create_project.
create policy projects_select on public.projects
  for select to authenticated
  using (private.can_see_project(id));

create policy projects_update on public.projects
  for update to authenticated
  using (private.can_edit_project(id))
  with check (private.can_edit_project(id));

create policy project_members_select on public.project_members
  for select to authenticated
  using (private.can_see_project(project_id));

-- statuses, status_transitions, sprints: read only in MVP. Default statuses
-- come from create_project; sprint state changes go through start/complete_sprint.
create policy statuses_select on public.statuses
  for select to authenticated
  using (private.can_see_project(project_id));

create policy status_transitions_select on public.status_transitions
  for select to authenticated
  using (private.can_see_project(project_id));

create policy sprints_select on public.sprints
  for select to authenticated
  using (private.can_see_project(project_id));

-- issues: read when visible; create, edit and soft-delete when the caller can edit.
create policy issues_select on public.issues
  for select to authenticated
  using (private.can_see_project(project_id));

create policy issues_insert on public.issues
  for insert to authenticated
  with check (
    private.can_edit_project(project_id)
    and reporter_id = (select auth.uid())
    and private.is_assignable(project_id, assignee_id)
  );

create policy issues_update on public.issues
  for update to authenticated
  using (private.can_edit_project(project_id))
  with check (
    private.can_edit_project(project_id)
    and private.is_assignable(project_id, assignee_id)
  );

-- issue_labels, issue_links, watchers: follow the issue's project.
create policy issue_labels_select on public.issue_labels
  for select to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = issue_labels.issue_id
      and private.can_see_project(i.project_id)
  ));

create policy issue_labels_write on public.issue_labels
  for all to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = issue_labels.issue_id
      and private.can_edit_project(i.project_id)
  ))
  with check (exists (
    select 1 from public.issues as i
    where i.id = issue_labels.issue_id
      and private.can_edit_project(i.project_id)
  ));

create policy issue_links_select on public.issue_links
  for select to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = issue_links.source_issue_id
      and private.can_see_project(i.project_id)
  ));

-- Links stay inside one project: the target must be in the source's project.
create policy issue_links_write on public.issue_links
  for all to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = issue_links.source_issue_id
      and private.can_edit_project(i.project_id)
  ))
  with check (exists (
    select 1
    from public.issues as s
    join public.issues as t on t.project_id = s.project_id
    where s.id = issue_links.source_issue_id
      and t.id = issue_links.target_issue_id
      and private.can_edit_project(s.project_id)
  ));

create policy watchers_select on public.watchers
  for select to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = watchers.issue_id
      and private.can_see_project(i.project_id)
  ));

create policy watchers_own on public.watchers
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = watchers.issue_id
        and private.can_see_project(i.project_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = watchers.issue_id
        and private.can_see_project(i.project_id)
    )
  );

-- comments: anyone who can see the issue can comment, guests included.
-- Authors edit and soft-delete their own comments. No hard delete.
create policy comments_select on public.comments
  for select to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = comments.issue_id
      and private.can_see_project(i.project_id)
  ));

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = comments.issue_id
        and private.can_see_project(i.project_id)
    )
  );

create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- attachments and issue_history: read only. Uploads come later (BRD §9);
-- history is written by the trigger.
create policy attachments_select on public.attachments
  for select to authenticated
  using (exists (
    select 1 from public.issues as i
    where i.id = attachments.issue_id
      and private.can_see_project(i.project_id)
  ));

create policy issue_history_select on public.issue_history
  for select to authenticated
  using (private.can_see_project(project_id));

-- recently_viewed: each user manages only their own rows, for visible issues.
create policy recently_viewed_own on public.recently_viewed
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = recently_viewed.issue_id
        and private.can_see_project(i.project_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.issues as i
      where i.id = recently_viewed.issue_id
        and private.can_see_project(i.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Grants: each one matches a policy above, and only the listed columns.
-- Everything else stays revoked from the API roles (see the core migration).
-- ---------------------------------------------------------------------------

grant select on public.profiles, public.workspaces, public.workspace_members,
  public.projects, public.project_members, public.statuses,
  public.status_transitions, public.sprints, public.issues,
  public.issue_labels, public.issue_links, public.watchers,
  public.comments, public.attachments, public.issue_history,
  public.recently_viewed
to authenticated;

grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (name, lead_id, access, archived_at) on public.projects to authenticated;

grant insert (project_id, type, title, description, status_id, priority,
  assignee_id, reporter_id, sprint_id, epic_id, parent_id, story_points,
  due_date, rank)
  on public.issues to authenticated;
grant update (type, title, description, status_id, priority, assignee_id,
  sprint_id, epic_id, parent_id, story_points, due_date, rank, deleted_at)
  on public.issues to authenticated;

grant insert, delete on public.issue_labels to authenticated;
grant insert, delete on public.issue_links to authenticated;
grant insert, delete on public.watchers to authenticated;

grant insert (issue_id, author_id, body) on public.comments to authenticated;
grant update (body, edited_at, deleted_at) on public.comments to authenticated;

grant insert, update, delete on public.recently_viewed to authenticated;

grant select on public.backlog_view, public.sprint_summary to authenticated;
