-- Extends public.home for the "Your work" design: issue type and priority, project names, status names
-- and categories, sprint end dates and points, open and in-review counts, project members, recently viewed
-- times and an activity feed that includes comments and readable status names.
-- Same signature and grants as before; create or replace keeps the existing execute grant.

create or replace function public.home(p_workspace uuid)
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
        select i.id, i.key, i.title, i.type, i.priority, i.due_date,
          st.name as status, st.category as status_category,
          p.name as project_name, p.key as project_key
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
        select i.id, i.key, i.title, i.type, i.due_date, p.key as project_key
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
        select p.id, p.key, p.name, p.template,
          (
            select jsonb_build_object(
              'name', s.name,
              'end_date', s.end_date,
              'done', count(i.id) filter (where st.category = 'done'),
              'total', count(i.id),
              'points_done', coalesce(sum(i.story_points) filter (where st.category = 'done'), 0),
              'points_total', coalesce(sum(i.story_points), 0)
            )
            from public.sprints as s
            left join public.issues as i
              on i.sprint_id = s.id and i.deleted_at is null
            left join public.statuses as st
              on st.id = i.status_id
            where s.project_id = p.id and s.state = 'active'
            group by s.id, s.name, s.end_date
          ) as active_sprint,
          (
            select count(*)
            from public.issues as i
            join public.statuses as st on st.id = i.status_id
            where i.project_id = p.id and i.deleted_at is null and st.category <> 'done'
          ) as open_count,
          (
            select count(*)
            from public.issues as i
            join public.statuses as st on st.id = i.status_id
            where i.project_id = p.id and i.deleted_at is null
              and st.category <> 'done' and lower(st.name) = 'in review'
          ) as in_review_count,
          (
            select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name) order by m.display_name), '[]'::jsonb)
            from public.project_members as pm
            join public.profiles as m on m.id = pm.user_id
            where pm.project_id = p.id
          ) as members
        from public.projects as p
        where p.workspace_id = p_workspace and p.archived_at is null
        order by p.name
      ) as pj
    ),
    'recently_viewed', (
      select coalesce(jsonb_agg(to_jsonb(rv)), '[]'::jsonb) from (
        select i.id, i.key, i.title, i.type, v.viewed_at, p.name as project_name, p.key as project_key
        from public.recently_viewed as v
        join public.issues as i on i.id = v.issue_id
        join public.projects as p on p.id = i.project_id
        where v.user_id = uid and p.workspace_id = p_workspace
        order by v.viewed_at desc
        limit 10
      ) as rv
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from (
        select events.kind, events.key, events.field, events.new_value, events.new_status,
          events.actor_name, events.created_at
        from (
          select 'change' as kind, i.key, h.field, h.new_value,
            case when h.field = 'status_id' then (
              select jsonb_build_object('name', st.name, 'category', st.category)
              from public.statuses as st
              where st.id = h.new_value::uuid
            ) end as new_status,
            pr.display_name as actor_name, h.created_at
          from public.issue_history as h
          join public.issues as i on i.id = h.issue_id
          left join public.profiles as pr on pr.id = h.actor_id
          where h.workspace_id = p_workspace
          union all
          select 'comment', i.key, null, null, null, pr.display_name, c.created_at
          from public.comments as c
          join public.issues as i on i.id = c.issue_id
          left join public.profiles as pr on pr.id = c.author_id
          where c.deleted_at is null and i.project_id in (
            select p.id from public.projects as p where p.workspace_id = p_workspace
          )
        ) as events
        order by events.created_at desc
        limit 5
      ) as a
    )
  ) into result;

  return result;
end $$;
