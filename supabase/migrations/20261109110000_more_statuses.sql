-- Five more statuses for every project: Weekly Target, Today's Task, Unit Testing, On-hold and Fixed.
-- Categories: Weekly Target and Today's Task are To do; Unit Testing and On-hold are In progress;
-- Fixed is Done. Existing issues keep their status. Columns follow one order for every project.

-- 1. New projects get all eight statuses. The body is the same as before, apart from the status list.
create or replace function public.create_project(
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
    (pr.id, 'Weekly Target', 'todo', 2),
    (pr.id, 'Today''s Task', 'todo', 3),
    (pr.id, 'In progress', 'in_progress', 4),
    (pr.id, 'Unit Testing', 'in_progress', 5),
    (pr.id, 'On-hold', 'in_progress', 6),
    (pr.id, 'Fixed', 'done', 7),
    (pr.id, 'Done', 'done', 8);

  return pr;
end $$;

-- 2. Existing projects get the five new statuses (only where missing).
insert into public.statuses (project_id, name, category, position)
select p.id, v.name, v.category, v.pos
from public.projects as p
cross join (values
  ('Weekly Target', 'todo', 2),
  ('Today''s Task', 'todo', 3),
  ('Unit Testing', 'in_progress', 5),
  ('On-hold', 'in_progress', 6),
  ('Fixed', 'done', 7)
) as v(name, category, pos)
where not exists (
  select 1 from public.statuses as s where s.project_id = p.id and s.name = v.name
);

-- 3. One column order for every project, by status name. Issue links are by id, so nothing moves.
update public.statuses as s
set position = v.pos
from (values
  ('To do', 1),
  ('Weekly Target', 2),
  ('Today''s Task', 3),
  ('In progress', 4),
  ('Unit Testing', 5),
  ('On-hold', 6),
  ('Fixed', 7),
  ('Done', 8)
) as v(name, pos)
where s.name = v.name;
