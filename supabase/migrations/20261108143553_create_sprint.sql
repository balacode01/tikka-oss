-- create_sprint (BRD §6.4 gap): sprints cannot be inserted directly by API users,
-- so this function checks edit permission and creates a planned sprint.

create function public.create_sprint(p_project uuid, p_name text, p_goal text)
returns public.sprints
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.sprints;
begin
  if auth.uid() is null or not private.can_edit_project(p_project) then
    raise exception 'You need edit access to create sprints in this project' using errcode = '42501';
  end if;
  if length(trim(p_name)) = 0 then
    raise exception 'Give the sprint a name' using errcode = '22023';
  end if;

  insert into public.sprints (project_id, name, goal, state)
  values (p_project, trim(p_name), nullif(trim(coalesce(p_goal, '')), ''), 'planned')
  returning * into sp;

  return sp;
end $$;

revoke execute on function public.create_sprint(uuid, text, text) from public, anon;
grant execute on function public.create_sprint(uuid, text, text) to authenticated;
