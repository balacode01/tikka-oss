-- Saved list filters, per user and per project. A person sees and changes only their own filters,
-- and only for projects they can see.

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.saved_filters (user_id, project_id);

alter table public.saved_filters enable row level security;

create policy saved_filters_own_select on public.saved_filters
  for select to authenticated
  using (user_id = (select auth.uid()) and private.can_see_project(project_id));

create policy saved_filters_own_insert on public.saved_filters
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_project(project_id));

create policy saved_filters_own_delete on public.saved_filters
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.saved_filters to authenticated;
