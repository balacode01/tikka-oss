-- Profile details from the "Your profile" settings: job title and time zone.
-- Owners update their own row only; the existing profiles_update_own policy covers these columns.

alter table public.profiles
  add column job_title text check (job_title is null or length(trim(job_title)) between 1 and 100),
  add column time_zone text not null default 'UTC' check (length(trim(time_zone)) between 1 and 64);

grant update (job_title, time_zone) on public.profiles to authenticated;
