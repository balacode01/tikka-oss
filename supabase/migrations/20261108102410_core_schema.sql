-- M1: core schema (BRD §6.1 to §6.3).
-- RLS is enabled on every table here with no policies yet, so nothing is
-- readable or writable through the Data API until M2 adds the policies.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'guest')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id, workspace_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[A-Z]{2,10}$'),
  name text not null,
  template text not null check (template in ('scrum', 'kanban')),
  lead_id uuid references public.profiles (id) on delete set null,
  access text not null default 'open' check (access in ('open', 'invite_only')),
  next_number int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key),
  unique (id, workspace_id)
);
create index on public.projects (workspace_id);
create index projects_name_trgm on public.projects using gin (name extensions.gin_trgm_ops);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (project_id, user_id)
);
create index on public.project_members (user_id, project_id);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category text not null check (category in ('todo', 'in_progress', 'done')),
  position numeric not null default 0,
  unique (project_id, name),
  unique (id, project_id)
);

-- Empty transition set means any move is allowed (BRD §6.1).
create table public.status_transitions (
  project_id uuid not null references public.projects (id) on delete cascade,
  from_status_id uuid not null,
  to_status_id uuid not null,
  primary key (from_status_id, to_status_id),
  foreign key (from_status_id, project_id) references public.statuses (id, project_id) on delete cascade,
  foreign key (to_status_id, project_id) references public.statuses (id, project_id) on delete cascade
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  goal text,
  state text not null default 'planned' check (state in ('planned', 'active', 'completed')),
  start_date date,
  end_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, project_id)
);
create unique index one_active_sprint_per_project on public.sprints (project_id) where state = 'active';

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- number and key are set by the assign_issue_number trigger.
  number int not null,
  key text not null unique,
  type text not null check (type in ('epic', 'story', 'task', 'bug', 'subtask')),
  title text not null check (length(trim(title)) between 1 and 255),
  description text,
  status_id uuid not null,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  assignee_id uuid references public.profiles (id) on delete set null,
  reporter_id uuid references public.profiles (id) on delete set null,
  sprint_id uuid,
  epic_id uuid,
  parent_id uuid,
  story_points numeric,
  due_date date,
  -- rank is filled by the assign_issue_rank trigger when not given.
  rank numeric,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  unique (id, project_id),
  foreign key (status_id, project_id) references public.statuses (id, project_id),
  foreign key (sprint_id, project_id) references public.sprints (id, project_id) on delete set null (sprint_id),
  foreign key (epic_id, project_id) references public.issues (id, project_id) on delete set null (epic_id),
  foreign key (parent_id, project_id) references public.issues (id, project_id) on delete cascade
);
create index on public.issues (project_id, status_id, rank);
create index on public.issues (assignee_id);
create index on public.issues (sprint_id);
create index on public.issues (key text_pattern_ops);
create index issues_title_trgm on public.issues using gin (title extensions.gin_trgm_ops);

create table public.issue_labels (
  issue_id uuid not null references public.issues (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 50),
  primary key (issue_id, label)
);

create table public.issue_links (
  id uuid primary key default gen_random_uuid(),
  source_issue_id uuid not null references public.issues (id) on delete cascade,
  target_issue_id uuid not null references public.issues (id) on delete cascade,
  link_type text not null check (link_type in ('blocks', 'relates_to')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (source_issue_id <> target_issue_id),
  unique (source_issue_id, target_issue_id, link_type)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  -- Not in BRD §6.1, but BRD §6.2 sets updated_at on comments by trigger.
  updated_at timestamptz not null default now()
);
create index on public.comments (issue_id, created_at);

create table public.watchers (
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (issue_id, user_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table public.issue_history (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index on public.issue_history (issue_id, created_at);

create table public.recently_viewed (
  user_id uuid not null references public.profiles (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, issue_id)
);
create index on public.recently_viewed (user_id, viewed_at desc);
create index on public.recently_viewed (issue_id);

-- Foreign key indexes (skill: schema-foreign-key-indexes). Postgres does not
-- create these itself, and missing ones make cascades and RLS lookups slow.
create index on public.workspaces (created_by);
create index on public.projects (lead_id);
create index on public.sprints (project_id);
create index on public.status_transitions (project_id);
create index on public.status_transitions (to_status_id);
create index on public.issues (reporter_id);
create index on public.issues (epic_id);
create index on public.issues (parent_id);
create index on public.issue_links (target_issue_id);
create index on public.issue_links (created_by);
create index on public.comments (author_id);
create index on public.watchers (user_id);
create index on public.attachments (issue_id);
create index on public.attachments (uploader_id);
create index on public.issue_history (project_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Issue numbering (BRD §6.2): lock the project row, take next_number, build the key.
create function public.assign_issue_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_key text;
  project_number int;
begin
  select p.key, p.next_number into project_key, project_number
  from public.projects as p
  where p.id = new.project_id
  for update;

  update public.projects
  set next_number = next_number + 1
  where id = new.project_id;

  new.number := project_number;
  new.key := project_key || '-' || project_number;
  return new;
end $$;

create trigger issues_assign_number
before insert on public.issues
for each row execute function public.assign_issue_number();

-- New issues go to the bottom of their status column (max rank + 1000).
create function public.assign_issue_rank()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bottom_rank numeric;
begin
  if new.rank is null then
    select coalesce(max(i.rank), 0) + 1000 into bottom_rank
    from public.issues as i
    where i.project_id = new.project_id
      and i.status_id = new.status_id;
    new.rank := bottom_rank;
  end if;
  return new;
end $$;

create trigger issues_assign_rank
before insert on public.issues
for each row execute function public.assign_issue_rank();

-- Epic and parent checks (BRD §6.2). The status must belong to the same project
-- and is enforced by the composite foreign key above.
create function public.validate_issue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.epic_id is not null and not exists (
    select 1
    from public.issues as e
    where e.id = new.epic_id
      and e.project_id = new.project_id
      and e.type = 'epic'
  ) then
    raise exception 'epic_id must point to an epic in the same project';
  end if;

  if new.type = 'subtask' and new.parent_id is null then
    raise exception 'a subtask needs a parent_id';
  end if;

  if new.parent_id is not null and new.type <> 'subtask' then
    raise exception 'parent_id is only allowed on subtasks';
  end if;

  return new;
end $$;

create trigger issues_validate
before insert or update on public.issues
for each row execute function public.validate_issue();

-- One issue_history row per changed tracked field (BRD §6.2).
create function public.record_issue_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tracked text[] := array[
    'status_id', 'assignee_id', 'priority', 'sprint_id', 'title',
    'due_date', 'story_points', 'epic_id', 'parent_id', 'type', 'deleted_at'
  ];
  f text;
  old_json jsonb := to_jsonb(old);
  new_json jsonb := to_jsonb(new);
  workspace uuid;
begin
  select p.workspace_id into workspace
  from public.projects as p
  where p.id = new.project_id;

  foreach f in array tracked loop
    if (old_json ->> f) is distinct from (new_json ->> f) then
      insert into public.issue_history
        (workspace_id, project_id, issue_id, actor_id, field, old_value, new_value)
      values
        (workspace, new.project_id, new.id, auth.uid(), f, old_json ->> f, new_json ->> f);
    end if;
  end loop;

  return new;
end $$;

create trigger issues_record_history
after update on public.issues
for each row execute function public.record_issue_history();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger issues_set_updated_at
before update on public.issues
for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- A profile row for every new auth user, so assignees and authors can be shown.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'User')
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Views (BRD §6.3). security_invoker makes them respect the caller's RLS.
-- ---------------------------------------------------------------------------

create view public.backlog_view with (security_invoker = true) as
select
  s.project_id,
  'sprint'::text as kind,
  s.id,
  s.name,
  s.state,
  count(i.id) as issue_count,
  coalesce(sum(i.story_points), 0) as points,
  count(i.id) filter (where st.category = 'done') as done_count,
  null::numeric as rank
from public.sprints as s
left join public.issues as i
  on i.sprint_id = s.id and i.deleted_at is null
left join public.statuses as st
  on st.id = i.status_id
group by s.project_id, s.id, s.name, s.state

union all

select
  e.project_id,
  'epic'::text,
  e.id,
  e.title,
  null::text,
  count(c.id),
  coalesce(sum(c.story_points), 0),
  count(c.id) filter (where st.category = 'done'),
  e.rank
from public.issues as e
left join public.issues as c
  on c.epic_id = e.id and c.deleted_at is null
left join public.statuses as st
  on st.id = c.status_id
where e.type = 'epic' and e.deleted_at is null
group by e.project_id, e.id, e.title, e.rank

union all

select
  i.project_id,
  'backlog_issue'::text,
  i.id,
  i.title,
  null::text,
  1::bigint,
  coalesce(i.story_points, 0),
  (case when st.category = 'done' then 1 else 0 end)::bigint,
  i.rank
from public.issues as i
join public.statuses as st
  on st.id = i.status_id
where i.sprint_id is null
  and i.type <> 'epic'
  and i.deleted_at is null;

create view public.sprint_summary with (security_invoker = true) as
select
  i.sprint_id,
  st.category,
  count(*) as issue_count,
  coalesce(sum(i.story_points), 0) as points
from public.issues as i
join public.statuses as st
  on st.id = i.status_id
where i.sprint_id is not null
  and i.deleted_at is null
group by i.sprint_id, st.category;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled now, policies arrive in M2.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.statuses enable row level security;
alter table public.status_transitions enable row level security;
alter table public.sprints enable row level security;
alter table public.issues enable row level security;
alter table public.issue_labels enable row level security;
alter table public.issue_links enable row level security;
alter table public.comments enable row level security;
alter table public.watchers enable row level security;
alter table public.attachments enable row level security;
alter table public.issue_history enable row level security;
alter table public.recently_viewed enable row level security;

-- ---------------------------------------------------------------------------
-- Least privilege (skill: security-privileges). Supabase grants anon and
-- authenticated full access to new public tables by default. Remove that here,
-- so the Data API can reach nothing until M2 grants exactly what each policy needs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Trigger and helper functions are not for API callers. Only the owner runs them.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.assign_issue_number() from public, anon, authenticated;
revoke execute on function public.assign_issue_rank() from public, anon, authenticated;
revoke execute on function public.validate_issue() from public, anon, authenticated;
revoke execute on function public.record_issue_history() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
