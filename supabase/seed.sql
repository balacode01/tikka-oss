-- Seed data for the Lumen Labs demo workspace (BRD §6.6).
-- Run after your first sign-up, with your user id:
--   psql "$SUPABASE_DB_URL" -v owner_id=<your-user-uuid> -v ON_ERROR_STOP=1 -f supabase/seed.sql
-- Re-running is not safe: the fixed ids below would clash. Delete the workspace first.
-- Assigned issues go to the owner only. Team profiles would need invites, which are out of MVP scope.

begin;

insert into public.workspaces (id, name, slug, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'Lumen Labs', 'lumen-labs', :'owner_id');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', :'owner_id', 'owner');

insert into public.projects (id, workspace_id, key, name, template, lead_id, access) values
  ('c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'MOB', 'Mobile app', 'scrum', :'owner_id', 'open'),
  ('c0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000001', 'WEB', 'Web platform', 'kanban', :'owner_id', 'open'),
  ('c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000001', 'DS', 'Design system', 'scrum', :'owner_id', 'open');

insert into public.project_members (project_id, user_id) values
  ('c0000000-0000-0000-0000-00000000000a', :'owner_id'),
  ('c0000000-0000-0000-0000-00000000000b', :'owner_id'),
  ('c0000000-0000-0000-0000-00000000000c', :'owner_id');

-- Statuses: To do, In progress, Done in each project.
insert into public.statuses (id, project_id, name, category, position) values
  ('c1000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-00000000000a', 'To do', 'todo', 1),
  ('c1000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-00000000000a', 'In progress', 'in_progress', 2),
  ('c1000000-0000-0000-0000-0000000000a3', 'c0000000-0000-0000-0000-00000000000a', 'Done', 'done', 3),
  ('c1000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-00000000000b', 'To do', 'todo', 1),
  ('c1000000-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-00000000000b', 'In progress', 'in_progress', 2),
  ('c1000000-0000-0000-0000-0000000000b3', 'c0000000-0000-0000-0000-00000000000b', 'Done', 'done', 3),
  ('c1000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-00000000000c', 'To do', 'todo', 1),
  ('c1000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-00000000000c', 'In progress', 'in_progress', 2),
  ('c1000000-0000-0000-0000-0000000000c3', 'c0000000-0000-0000-0000-00000000000c', 'Done', 'done', 3);

-- Sprint 14 is active, Sprint 15 is planned (both in Mobile app).
insert into public.sprints (id, project_id, name, goal, state, start_date, end_date) values
  ('c2000000-0000-0000-0000-0000000000a4', 'c0000000-0000-0000-0000-00000000000a', 'Sprint 14', 'Ship onboarding', 'active', current_date - 7, current_date + 7),
  ('c2000000-0000-0000-0000-0000000000a5', 'c0000000-0000-0000-0000-00000000000a', 'Sprint 15', null, 'planned', null, null);

-- Epics come first so their numbers are low. Issue numbers and keys come from the trigger.
insert into public.issues (id, project_id, type, title, status_id, priority, reporter_id, assignee_id, sprint_id, epic_id, parent_id, story_points, due_date) values
  -- Mobile app (MOB)
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000a', 'epic', 'Onboarding', 'c1000000-0000-0000-0000-0000000000a2', 'high', :'owner_id', null, null, null, null, null, null),
  ('d1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000a', 'epic', 'Offline mode', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, null, null, null, null),
  ('d1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Sign-up with email', 'c1000000-0000-0000-0000-0000000000a3', 'medium', :'owner_id', :'owner_id', null, 'd1000000-0000-0000-0000-000000000001', null, 5, null),
  ('d1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Welcome screen copy', 'c1000000-0000-0000-0000-0000000000a3', 'low', :'owner_id', :'owner_id', null, 'd1000000-0000-0000-0000-000000000001', null, 2, null),
  ('d1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Set up analytics events for onboarding', 'c1000000-0000-0000-0000-0000000000a2', 'medium', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-000000000001', null, 3, null),
  ('d1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Password reset flow', 'c1000000-0000-0000-0000-0000000000a2', 'high', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-000000000001', null, 5, current_date + 3),
  ('d1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000000a', 'subtask', 'Reset email template', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, 'c2000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000006', 1, null),
  ('d1000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-00000000000a', 'subtask', 'Reset link expiry', 'c1000000-0000-0000-0000-0000000000a2', 'medium', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000006', 1, null),
  ('d1000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-00000000000a', 'bug', 'Keyboard closes on sign-up tap', 'c1000000-0000-0000-0000-0000000000a1', 'urgent', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', null, null, 2, null),
  ('d1000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Remember last workspace', 'c1000000-0000-0000-0000-0000000000a1', 'low', :'owner_id', null, 'c2000000-0000-0000-0000-0000000000a5', null, null, 3, null),
  ('d1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Offline queue for comments', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, 'd1000000-0000-0000-0000-000000000002', null, 8, null),
  ('d1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Cache issue list for offline reads', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, 'd1000000-0000-0000-0000-000000000002', null, 5, null),
  ('d1000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-00000000000a', 'bug', 'Sync conflicts drop a comment', 'c1000000-0000-0000-0000-0000000000a2', 'high', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-000000000002', null, 3, null),
  ('d1000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Background sync scheduler', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, 'c2000000-0000-0000-0000-0000000000a5', 'd1000000-0000-0000-0000-000000000002', null, 5, null),
  ('d1000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Empty state for new projects', 'c1000000-0000-0000-0000-0000000000a3', 'low', :'owner_id', null, null, null, null, 1, null),
  ('d1000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Dark mode contrast audit', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, null, null, 2, null),
  ('d1000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-00000000000a', 'bug', 'Crash on rotate with open panel', 'c1000000-0000-0000-0000-0000000000a2', 'urgent', :'owner_id', :'owner_id', 'c2000000-0000-0000-0000-0000000000a4', null, null, 3, null),
  ('d1000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Push notification opt-in', 'c1000000-0000-0000-0000-0000000000a1', 'low', :'owner_id', null, null, null, null, null, null),
  ('d1000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Localize onboarding strings', 'c1000000-0000-0000-0000-0000000000a1', 'low', :'owner_id', null, null, 'd1000000-0000-0000-0000-000000000001', null, 3, null),
  ('d1000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Biometric unlock', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, null, null, 8, null),
  ('d1000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-00000000000a', 'bug', 'Avatar upload fails over 2 MB', 'c1000000-0000-0000-0000-0000000000a1', 'high', :'owner_id', null, null, null, null, 2, null),
  ('d1000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Upgrade navigation library', 'c1000000-0000-0000-0000-0000000000a3', 'medium', :'owner_id', :'owner_id', null, null, null, 3, null),
  ('d1000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Board swipe gesture', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, null, null, 5, null),
  ('d1000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-00000000000a', 'task', 'Measure cold start time', 'c1000000-0000-0000-0000-0000000000a2', 'low', :'owner_id', null, null, null, null, 2, null),
  ('d1000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-00000000000a', 'bug', 'Login loop on expired token', 'c1000000-0000-0000-0000-0000000000a3', 'high', :'owner_id', :'owner_id', null, null, null, 2, null),
  ('d1000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-00000000000a', 'story', 'Tablet layout for board', 'c1000000-0000-0000-0000-0000000000a1', 'medium', :'owner_id', null, null, null, null, 8, null),
  -- Web platform (WEB, Kanban)
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'epic', 'Checkout redesign', 'c1000000-0000-0000-0000-0000000000b2', 'high', :'owner_id', null, null, null, null, null, null),
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Address autocomplete', 'c1000000-0000-0000-0000-0000000000b1', 'medium', :'owner_id', null, null, 'd2000000-0000-0000-0000-000000000001', null, 5, null),
  ('d2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Saved cards', 'c1000000-0000-0000-0000-0000000000b2', 'medium', :'owner_id', :'owner_id', null, 'd2000000-0000-0000-0000-000000000001', null, 8, null),
  ('d2000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Payment error copy', 'c1000000-0000-0000-0000-0000000000b3', 'low', :'owner_id', :'owner_id', null, 'd2000000-0000-0000-0000-000000000001', null, 1, null),
  ('d2000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000b', 'bug', 'Totals wrong with two coupons', 'c1000000-0000-0000-0000-0000000000b1', 'urgent', :'owner_id', null, null, null, null, 3, null),
  ('d2000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Guest checkout', 'c1000000-0000-0000-0000-0000000000b1', 'medium', :'owner_id', null, null, 'd2000000-0000-0000-0000-000000000001', null, 5, null),
  ('d2000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Shipping estimate API', 'c1000000-0000-0000-0000-0000000000b2', 'medium', :'owner_id', null, null, null, null, 3, null),
  ('d2000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Order history filters', 'c1000000-0000-0000-0000-0000000000b1', 'low', :'owner_id', null, null, null, null, 3, null),
  ('d2000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-00000000000b', 'bug', 'Favicon missing on Safari', 'c1000000-0000-0000-0000-0000000000b1', 'low', :'owner_id', null, null, null, null, null, null),
  ('d2000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Lighthouse budget in CI', 'c1000000-0000-0000-0000-0000000000b3', 'medium', :'owner_id', :'owner_id', null, null, null, 2, null),
  ('d2000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Product page gallery zoom', 'c1000000-0000-0000-0000-0000000000b1', 'medium', :'owner_id', null, null, null, null, 5, null),
  ('d2000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Move analytics to server events', 'c1000000-0000-0000-0000-0000000000b2', 'medium', :'owner_id', :'owner_id', null, null, null, 5, null),
  ('d2000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-00000000000b', 'bug', 'Search returns empty for accents', 'c1000000-0000-0000-0000-0000000000b1', 'high', :'owner_id', null, null, null, null, 2, null),
  ('d2000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Wishlist sharing', 'c1000000-0000-0000-0000-0000000000b1', 'low', :'owner_id', null, null, null, null, 3, null),
  ('d2000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Cookie banner text review', 'c1000000-0000-0000-0000-0000000000b3', 'low', :'owner_id', null, null, null, null, 1, null),
  ('d2000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-00000000000b', 'story', 'Gift wrap option', 'c1000000-0000-0000-0000-0000000000b1', 'low', :'owner_id', null, null, null, null, 2, null),
  ('d2000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-00000000000b', 'task', 'Refactor cart reducer', 'c1000000-0000-0000-0000-0000000000b2', 'medium', :'owner_id', :'owner_id', null, null, null, 3, null),
  ('d2000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-00000000000b', 'bug', 'Cart count stale after login', 'c1000000-0000-0000-0000-0000000000b1', 'high', :'owner_id', null, null, null, null, 2, null),
  -- Design system (DS)
  ('d3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'epic', 'Component library', 'c1000000-0000-0000-0000-0000000000c2', 'high', :'owner_id', null, null, null, null, null, null),
  ('d3000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Button variants', 'c1000000-0000-0000-0000-0000000000c3', 'medium', :'owner_id', :'owner_id', null, 'd3000000-0000-0000-0000-000000000001', null, 3, null),
  ('d3000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Input with error state', 'c1000000-0000-0000-0000-0000000000c3', 'medium', :'owner_id', :'owner_id', null, 'd3000000-0000-0000-0000-000000000001', null, 3, null),
  ('d3000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Select component', 'c1000000-0000-0000-0000-0000000000c2', 'medium', :'owner_id', :'owner_id', null, 'd3000000-0000-0000-0000-000000000001', null, 5, null),
  ('d3000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c', 'task', 'Token export to JSON', 'c1000000-0000-0000-0000-0000000000c2', 'medium', :'owner_id', :'owner_id', null, null, null, 2, null),
  ('d3000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Date picker', 'c1000000-0000-0000-0000-0000000000c1', 'medium', :'owner_id', null, null, 'd3000000-0000-0000-0000-000000000001', null, 5, null),
  ('d3000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000000c', 'task', 'Tooltip accessibility', 'c1000000-0000-0000-0000-0000000000c1', 'medium', :'owner_id', null, null, null, null, 2, null),
  ('d3000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-00000000000c', 'bug', 'Focus ring missing on icon buttons', 'c1000000-0000-0000-0000-0000000000c1', 'high', :'owner_id', null, null, null, null, 1, null),
  ('d3000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Avatar group', 'c1000000-0000-0000-0000-0000000000c1', 'low', :'owner_id', null, null, null, null, 3, null),
  ('d3000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-00000000000c', 'task', 'Icon set: 40 base icons', 'c1000000-0000-0000-0000-0000000000c3', 'medium', :'owner_id', :'owner_id', null, null, null, 5, null),
  ('d3000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Empty state illustration', 'c1000000-0000-0000-0000-0000000000c1', 'low', :'owner_id', null, null, null, null, 2, null),
  ('d3000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-00000000000c', 'task', 'Document spacing scale', 'c1000000-0000-0000-0000-0000000000c3', 'low', :'owner_id', :'owner_id', null, null, null, 1, null),
  ('d3000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-00000000000c', 'bug', 'Dark theme shadow too strong', 'c1000000-0000-0000-0000-0000000000c1', 'low', :'owner_id', null, null, null, null, null, null),
  ('d3000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Command palette styling', 'c1000000-0000-0000-0000-0000000000c1', 'medium', :'owner_id', null, null, null, null, 5, null),
  ('d3000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-00000000000c', 'task', 'Storybook CI', 'c1000000-0000-0000-0000-0000000000c2', 'medium', :'owner_id', null, null, null, null, 3, null),
  ('d3000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-00000000000c', 'story', 'Changelog page', 'c1000000-0000-0000-0000-0000000000c1', 'low', :'owner_id', null, null, null, null, null, null);

-- A few labels so the label picker has something to suggest.
insert into public.issue_labels (issue_id, label) values
  ('d1000000-0000-0000-0000-000000000006', 'auth'),
  ('d1000000-0000-0000-0000-000000000009', 'bug-bash'),
  ('d1000000-0000-0000-0000-000000000013', 'sync'),
  ('d1000000-0000-0000-0000-000000000011', 'offline'),
  ('d2000000-0000-0000-0000-000000000005', 'pricing'),
  ('d2000000-0000-0000-0000-000000000013', 'search'),
  ('d3000000-0000-0000-0000-000000000008', 'a11y'),
  ('d3000000-0000-0000-0000-000000000010', 'icons');

commit;
