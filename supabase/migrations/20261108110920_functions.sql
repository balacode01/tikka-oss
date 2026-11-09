-- M3: functions (BRD §6.4).
-- Security invoker: the function runs with the caller's rights, so RLS and grants apply.
-- Security definer: used only where the caller must write rows they cannot write
-- directly (workspaces, projects, sprint state). Each one checks auth.uid() and
-- permissions itself, and sets an empty search_path.

-- ---------------------------------------------------------------------------
-- Workspaces and projects
-- ---------------------------------------------------------------------------

create function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ws public.workspaces;
begin
  if uid is null then
    raise exception 'Sign in before creating a workspace' using errcode = '42501';
  end if;
  if length(trim(p_name)) = 0 then
    raise exception 'Give the workspace a name' using errcode = '22023';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' then
    raise exception 'The workspace URL can use lowercase letters, numbers and hyphens only' using errcode = '22023';
  end if;
  if exists (select 1 from public.workspaces as w where w.slug = p_slug) then
    raise exception 'The workspace URL % is taken. Try another one, such as %-2.', p_slug, p_slug using errcode = '23505';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (trim(p_name), p_slug, uid)
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, uid, 'owner');

  return ws;
end $$;

create function public.create_project(
  p_workspace uuid,
  p_name text,
  p_key text,
  p_template text,
  p_access text
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  caller_role text;
  pr public.projects;
begin
  if uid is null then
    raise exception 'Sign in before creating a project' using errcode = '42501';
  end if;

  select m.role into caller_role
  from public.workspace_members as m
  where m.workspace_id = p_workspace and m.user_id = uid;

  if caller_role is null or caller_role not in ('owner', 'admin', 'member') then
    raise exception 'Only workspace members, not guests, can create projects' using errcode = '42501';
  end if;
  if length(trim(p_name)) = 0 then
    raise exception 'Give the project a name' using errcode = '22023';
  end if;
  if p_key !~ '^[A-Z]{2,10}$' then
    raise exception 'The project key must be 2 to 10 capital letters, such as MOB' using errcode = '22023';
  end if;
  if exists (select 1 from public.projects as p where p.workspace_id = p_workspace and p.key = p_key) then
    raise exception 'The key % is already used in this workspace. Try another key, such as %2.', p_key, p_key using errcode = '23505';
  end if;
  if p_template not in ('scrum', 'kanban') then
    raise exception 'Choose Scrum or Kanban' using errcode = '22023';
  end if;
  if p_access not in ('open', 'invite_only') then
    raise exception 'Choose an access level for the project' using errcode = '22023';
  end if;

  insert into public.projects (workspace_id, key, name, template, lead_id, access)
  values (p_workspace, p_key, trim(p_name), p_template, uid, p_access)
  returning * into pr;

  insert into public.project_members (project_id, user_id)
  values (pr.id, uid);

  insert into public.statuses (project_id, name, category, position) values
    (pr.id, 'To do', 'todo', 1),
    (pr.id, 'In progress', 'in_progress', 2),
    (pr.id, 'Done', 'done', 3);

  return pr;
end $$;

-- ---------------------------------------------------------------------------
-- Issues
-- ---------------------------------------------------------------------------

create function public.create_issue(
  p_project uuid,
  p_type text,
  p_title text,
  p_description text,
  p_status uuid,
  p_priority text,
  p_assignee uuid,
  p_sprint uuid,
  p_epic uuid,
  p_parent uuid,
  p_points numeric,
  p_due date,
  p_labels text[]
)
returns public.issues
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status uuid;
  iss public.issues;
  lbl text;
begin
  if length(trim(p_title)) = 0 then
    raise exception 'Give the issue a title' using errcode = '22023';
  end if;
  if length(trim(p_title)) > 255 then
    raise exception 'The title is too long. Keep it under 255 characters' using errcode = '22023';
  end if;

  v_status := coalesce(
    p_status,
    (select st.id from public.statuses as st
     where st.project_id = p_project and st.category = 'todo'
     order by st.position limit 1)
  );
  if v_status is null then
    raise exception 'This project has no To do status yet' using errcode = '22023';
  end if;

  insert into public.issues
    (project_id, type, title, description, status_id, priority, reporter_id,
     assignee_id, sprint_id, epic_id, parent_id, story_points, due_date)
  values
    (p_project, p_type, trim(p_title), p_description, v_status, coalesce(p_priority, 'medium'),
     auth.uid(), p_assignee, p_sprint, p_epic, p_parent, p_points, p_due)
  returning * into iss;

  foreach lbl in array coalesce(p_labels, '{}') loop
    if length(trim(lbl)) > 0 then
      insert into public.issue_labels (issue_id, label)
      values (iss.id, trim(lbl))
      on conflict do nothing;
    end if;
  end loop;

  return iss;
end $$;

-- Places the issue between two neighbours in the target column.
-- p_before is the card above the new spot, p_after is the card below it.
-- Lower rank is higher on the board. Without a neighbour, the issue goes to that end.
create function public.move_issue(p_issue uuid, p_status uuid, p_before uuid, p_after uuid)
returns public.issues
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cur public.issues;
  target uuid;
  lo numeric;
  hi numeric;
  new_rank numeric;
begin
  select * into cur from public.issues as i where i.id = p_issue and i.deleted_at is null;
  if not found then
    raise exception 'This issue was not found' using errcode = 'P0002';
  end if;
  if not private.can_edit_project(cur.project_id) then
    raise exception 'You need edit access to move issues in this project' using errcode = '42501';
  end if;

  target := coalesce(p_status, cur.status_id);

  if target <> cur.status_id
     and exists (select 1 from public.status_transitions as t where t.project_id = cur.project_id)
     and not exists (
       select 1 from public.status_transitions as t
       where t.from_status_id = cur.status_id and t.to_status_id = target
     ) then
    raise exception 'This status change is not allowed in this project' using errcode = '22023';
  end if;

  if p_before is not null then
    select i.rank into lo from public.issues as i
    where i.id = p_before and i.project_id = cur.project_id and i.status_id = target;
    if not found then
      raise exception 'The card above must be in the target column' using errcode = '22023';
    end if;
  end if;
  if p_after is not null then
    select i.rank into hi from public.issues as i
    where i.id = p_after and i.project_id = cur.project_id and i.status_id = target;
    if not found then
      raise exception 'The card below must be in the target column' using errcode = '22023';
    end if;
  end if;

  -- No room left between the neighbours: renumber the column in steps of 1000.
  if lo is not null and hi is not null and hi - lo < 0.000001 then
    with ordered as (
      select i.id, row_number() over (order by i.rank, i.id) * 1000 as renumbered
      from public.issues as i
      where i.project_id = cur.project_id and i.status_id = target and i.id <> p_issue
    )
    update public.issues as i
    set rank = o.renumbered
    from ordered as o
    where i.id = o.id;

    select i.rank into lo from public.issues as i where i.id = p_before;
    select i.rank into hi from public.issues as i where i.id = p_after;
  end if;

  if lo is null and hi is null then
    select coalesce(max(i.rank), 0) + 1000 into new_rank
    from public.issues as i
    where i.project_id = cur.project_id and i.status_id = target and i.id <> p_issue;
  elsif lo is null then
    new_rank := hi - 1000;
  elsif hi is null then
    new_rank := lo + 1000;
  else
    new_rank := (lo + hi) / 2;
  end if;

  update public.issues
  set status_id = target, rank = new_rank
  where id = p_issue
  returning * into cur;

  return cur;
end $$;

create function public.bulk_update_issues(
  p_ids uuid[],
  p_sprint uuid,
  p_assignee uuid,
  p_set_sprint boolean,
  p_set_assignee boolean
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  update public.issues
  set sprint_id = case when p_set_sprint then p_sprint else sprint_id end,
      assignee_id = case when p_set_assignee then p_assignee else assignee_id end
  where id = any (p_ids)
    and deleted_at is null;

  get diagnostics n = row_count;
  return n;
end $$;

create function public.delete_issues(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  update public.issues
  set deleted_at = now()
  where id = any (p_ids)
    and deleted_at is null;

  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Sprints. Sprint state is not writable by API users, so these run as definer
-- and check edit permission themselves.
-- ---------------------------------------------------------------------------

create function public.start_sprint(p_sprint uuid, p_goal text, p_end_date date)
returns public.sprints
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.sprints;
begin
  select * into sp from public.sprints as s where s.id = p_sprint;
  if not found or not private.can_edit_project(sp.project_id) then
    raise exception 'This sprint was not found, or you cannot change it' using errcode = 'P0002';
  end if;
  if sp.state <> 'planned' then
    raise exception 'This sprint is already %', sp.state using errcode = '22023';
  end if;
  if exists (
    select 1 from public.sprints as s
    where s.project_id = sp.project_id and s.state = 'active'
  ) then
    raise exception 'Another sprint is already active. Complete it before you start this one' using errcode = '23505';
  end if;

  update public.sprints
  set state = 'active',
      start_date = current_date,
      goal = coalesce(p_goal, goal),
      end_date = coalesce(p_end_date, end_date)
  where id = sp.id
  returning * into sp;

  return sp;
end $$;

-- Unfinished issues move to p_move_open_to, or to the backlog when it is null.
create function public.complete_sprint(p_sprint uuid, p_move_open_to uuid)
returns public.sprints
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.sprints;
begin
  select * into sp from public.sprints as s where s.id = p_sprint;
  if not found or not private.can_edit_project(sp.project_id) then
    raise exception 'This sprint was not found, or you cannot change it' using errcode = 'P0002';
  end if;
  if sp.state <> 'active' then
    raise exception 'Only an active sprint can be completed' using errcode = '22023';
  end if;
  if p_move_open_to is not null and not exists (
    select 1 from public.sprints as s
    where s.id = p_move_open_to
      and s.project_id = sp.project_id
      and s.state = 'planned'
  ) then
    raise exception 'Choose a planned sprint in this project, or leave it empty to move issues to the backlog' using errcode = '22023';
  end if;

  update public.issues as i
  set sprint_id = p_move_open_to
  from public.statuses as st
  where st.id = i.status_id
    and i.sprint_id = sp.id
    and st.category <> 'done'
    and i.deleted_at is null;

  update public.sprints
  set state = 'completed', completed_at = now()
  where id = sp.id
  returning * into sp;

  return sp;
end $$;

-- ---------------------------------------------------------------------------
-- Recently viewed, search and home
-- ---------------------------------------------------------------------------

-- Keeps the newest 20 per user.
create function public.record_view(p_issue uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.recently_viewed (user_id, issue_id, viewed_at)
  values (auth.uid(), p_issue, now())
  on conflict (user_id, issue_id) do update set viewed_at = excluded.viewed_at;

  delete from public.recently_viewed as rv
  where rv.user_id = auth.uid()
    and rv.issue_id not in (
      select keep.issue_id
      from public.recently_viewed as keep
      where keep.user_id = auth.uid()
      order by keep.viewed_at desc
      limit 20
    );
end $$;

-- Returns only rows the caller can see, because RLS applies to the invoker.
create function public.search(p_workspace uuid, p_query text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  q text := trim(coalesce(p_query, ''));
  pattern text;
  issues_json jsonb;
  projects_json jsonb;
begin
  if length(q) = 0 then
    return jsonb_build_object('issues', '[]'::jsonb, 'projects', '[]'::jsonb);
  end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into issues_json
  from (
    select i.id, i.key, i.title, i.project_id
    from public.issues as i
    join public.projects as p on p.id = i.project_id
    where p.workspace_id = p_workspace
      and i.deleted_at is null
      and (i.key ilike pattern or i.title ilike pattern)
    order by (i.key ilike q) desc, i.updated_at desc
    limit 20
  ) as r;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into projects_json
  from (
    select p.id, p.key, p.name
    from public.projects as p
    where p.workspace_id = p_workspace
      and p.archived_at is null
      and (p.name ilike pattern or p.key ilike pattern)
    order by p.name
    limit 10
  ) as r;

  return jsonb_build_object('issues', issues_json, 'projects', projects_json);
end $$;

-- Everything the Your work page needs, for the signed-in user, in one call.
create function public.home(p_workspace uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    return null;
  end if;

  select jsonb_build_object(
    'assigned', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from (
        select i.id, i.key, i.title, i.due_date, st.name as status
        from public.issues as i
        join public.projects as p on p.id = i.project_id
        join public.statuses as st on st.id = i.status_id
        where p.workspace_id = p_workspace
          and i.assignee_id = uid
          and i.deleted_at is null
          and st.category <> 'done'
        order by i.due_date nulls last, i.updated_at desc
        limit 20
      ) as a
    ),
    'due_this_week', (
      select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from (
        select i.id, i.key, i.title, i.due_date
        from public.issues as i
        join public.projects as p on p.id = i.project_id
        join public.statuses as st on st.id = i.status_id
        where p.workspace_id = p_workspace
          and i.assignee_id = uid
          and i.deleted_at is null
          and st.category <> 'done'
          and i.due_date between current_date and current_date + 7
        order by i.due_date
      ) as d
    ),
    'projects', (
      select coalesce(jsonb_agg(to_jsonb(pj)), '[]'::jsonb) from (
        select p.id, p.key, p.name,
          (
            select jsonb_build_object(
              'name', s.name,
              'done', count(i.id) filter (where st.category = 'done'),
              'total', count(i.id)
            )
            from public.sprints as s
            left join public.issues as i
              on i.sprint_id = s.id and i.deleted_at is null
            left join public.statuses as st
              on st.id = i.status_id
            where s.project_id = p.id and s.state = 'active'
            group by s.id, s.name
          ) as active_sprint
        from public.projects as p
        where p.workspace_id = p_workspace and p.archived_at is null
        order by p.name
      ) as pj
    ),
    'recently_viewed', (
      select coalesce(jsonb_agg(to_jsonb(rv)), '[]'::jsonb) from (
        select i.id, i.key, i.title
        from public.recently_viewed as v
        join public.issues as i on i.id = v.issue_id
        join public.projects as p on p.id = i.project_id
        where v.user_id = uid and p.workspace_id = p_workspace
        order by v.viewed_at desc
        limit 10
      ) as rv
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from (
        select h.field, h.old_value, h.new_value, h.actor_id, h.created_at, i.key
        from public.issue_history as h
        join public.issues as i on i.id = h.issue_id
        where h.workspace_id = p_workspace
        order by h.created_at desc
        limit 20
      ) as h
    )
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: API users can call these, and nobody else can.
-- ---------------------------------------------------------------------------

revoke execute on function public.create_workspace(text, text) from public, anon;
revoke execute on function public.create_project(uuid, text, text, text, text) from public, anon;
revoke execute on function public.create_issue(uuid, text, text, text, uuid, text, uuid, uuid, uuid, uuid, numeric, date, text[]) from public, anon;
revoke execute on function public.move_issue(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.bulk_update_issues(uuid[], uuid, uuid, boolean, boolean) from public, anon;
revoke execute on function public.delete_issues(uuid[]) from public, anon;
revoke execute on function public.start_sprint(uuid, text, date) from public, anon;
revoke execute on function public.complete_sprint(uuid, uuid) from public, anon;
revoke execute on function public.record_view(uuid) from public, anon;
revoke execute on function public.search(uuid, text) from public, anon;
revoke execute on function public.home(uuid) from public, anon;

grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.create_project(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_issue(uuid, text, text, text, uuid, text, uuid, uuid, uuid, uuid, numeric, date, text[]) to authenticated;
grant execute on function public.move_issue(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.bulk_update_issues(uuid[], uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.delete_issues(uuid[]) to authenticated;
grant execute on function public.start_sprint(uuid, text, date) to authenticated;
grant execute on function public.complete_sprint(uuid, uuid) to authenticated;
grant execute on function public.record_view(uuid) to authenticated;
grant execute on function public.search(uuid, text) to authenticated;
grant execute on function public.home(uuid) to authenticated;
