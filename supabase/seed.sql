-- =====================================================================
-- NSCI Sports Desk OS - seed data (the current Sports Desk work)
-- Safe to run once on a fresh database. Run AFTER the migration.
-- Due dates are intentionally left empty: none were given, and the app
-- never invents dates. Set them from the Tasks page.
-- Priorities that were not specified default to P1 for active projects,
-- P2 for operations and P3 for the TBD tournament. Adjust freely.
-- =====================================================================

set app.actor = 'Seed data';

do $$
begin
  if exists (select 1 from public.projects) then
    raise notice 'Projects already exist - seed skipped.';
    return;
  end if;

  ------------------------------------------------------------------
  -- Projects
  ------------------------------------------------------------------
  insert into public.projects (name, slug, description, status, priority, waiting_for, current_stage, aliases, sort_order) values
    ('Recovery Space – Ice Bath', 'recovery-space-ice-bath',
     'Ice bath recovery space to be installed after the pool renovation.',
     'IN_PROGRESS', 'P1', 'Pool renovation / location confirmation', 'Quotations & location',
     '{recovery,ice bath,recovery space}', 1),
    ('Yoga Sessions', 'yoga-sessions',
     'Yoga sessions for registered members.',
     'IN_PROGRESS', 'P1', null, 'Participant count & planning',
     '{yoga}', 2),
    ('Delhi vs Mumbai Badminton Tournament', 'delhi-vs-mumbai-badminton-tournament',
     'Inter-city badminton tournament. Not an urgent active project until the concept is confirmed.',
     'TBD', 'P3', null, 'Concept',
     '{tournament,delhi vs mumbai,badminton tournament}', 3),
    ('Sports Events & Knowledge Sessions', 'sports-events-knowledge-sessions',
     'Sports events and knowledge sessions programme.',
     'IN_PROGRESS', 'P1', null, 'Shortlisting',
     '{knowledge sessions,sports events,sessions}', 4),
    ('Badminton Court Roofing', 'badminton-court-roofing',
     'Roofing for the badminton court.',
     'IN_PROGRESS', 'P1', null, 'L1 selection',
     '{roofing,badminton roofing,court roofing}', 5),
    ('Board Games Nights', 'board-games-nights',
     'Board games nights for members.',
     'IN_PROGRESS', 'P1', 'Quotations', 'Quotation collection',
     '{board games,board game night}', 6),
    ('Physio Sessions', 'physio-sessions',
     'Physiotherapy sessions for members.',
     'IN_PROGRESS', 'P1', null, 'Quotation review',
     '{physio,physiotherapy}', 7),
    ('Daily Cleaning & Operations', 'daily-cleaning-operations',
     'Recurring daily operations checklist.',
     'IN_PROGRESS', 'P2', null, 'Ongoing',
     '{cleaning,operations,daily checklist}', 8),
    ('Shuttle Order', 'shuttle-order',
     'Shuttlecock order and inventory update.',
     'PENDING', 'P0', null, 'Requirement confirmation',
     '{shuttle,shuttles,shuttlecock}', 9),
    ('Court Repair', 'court-repair',
     'Court repair request, estimate, approval and execution.',
     'PENDING', 'P0', null, 'Repair email',
     '{repair,court repair}', 10);

  update public.projects set is_recurring = true where slug = 'daily-cleaning-operations';
end $$;

-- ---------------------------------------------------------------------
-- Tasks. Columns: project slug, order, title, status, priority,
-- dependency text, waiting_for
-- ---------------------------------------------------------------------
with src (slug, ord, title, status, priority, dependency, waiting_for) as (values
  -- Recovery Space – Ice Bath
  ('recovery-space-ice-bath', 1, 'Create Google folder with all quotations', 'PENDING', 'P1', null, null),
  ('recovery-space-ice-bath', 2, 'Share quotation folder', 'PENDING', 'P1', null, null),
  ('recovery-space-ice-bath', 3, 'Connect with ARC regarding setup after pool renovation', 'PENDING', 'P1', 'Pool renovation', null),
  ('recovery-space-ice-bath', 4, 'Confirm final installation location', 'PENDING', 'P1', 'Pool renovation / location confirmation', null),
  ('recovery-space-ice-bath', 5, 'Coordinate installation', 'PENDING', 'P1', null, null),

  -- Yoga Sessions
  ('yoga-sessions', 1, 'Get message circulated', 'COMPLETED', 'P1', null, null),
  ('yoga-sessions', 2, 'Create Google Form for registered members', 'COMPLETED', 'P1', null, null),
  ('yoga-sessions', 3, 'Get video from Kartik', 'COMPLETED', 'P1', null, null),
  ('yoga-sessions', 4, 'Finalize participant count', 'PENDING', 'P1', null, null),
  ('yoga-sessions', 5, 'Plan sessions according to participant count', 'PENDING', 'P1', null, null),
  ('yoga-sessions', 6, 'Identify required equipment', 'PENDING', 'P1', null, null),
  ('yoga-sessions', 7, 'Purchase yoga mats if required', 'PENDING', 'P2', null, null),
  ('yoga-sessions', 8, 'Purchase yoga blocks if required', 'PENDING', 'P2', null, null),
  ('yoga-sessions', 9, 'Circulate Kartik''s video', 'PENDING', 'P1', null, null),

  -- Delhi vs Mumbai Badminton Tournament (TBD)
  ('delhi-vs-mumbai-badminton-tournament', 1, 'Decide tournament concept', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 2, 'Decide format', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 3, 'Discuss Delhi/Mumbai coordination', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 4, 'Decide tentative dates', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 5, 'Prepare budget', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 6, 'Get management approval', 'TBD', 'P3', null, null),
  ('delhi-vs-mumbai-badminton-tournament', 7, 'Implement', 'TBD', 'P3', null, null),

  -- Sports Events & Knowledge Sessions
  ('sports-events-knowledge-sessions', 1, 'Create Excel of sessions', 'COMPLETED', 'P1', null, null),
  ('sports-events-knowledge-sessions', 2, 'Share Excel', 'COMPLETED', 'P1', null, null),
  ('sports-events-knowledge-sessions', 3, 'Shortlist 2–3 sessions', 'PENDING', 'P1', null, null),
  ('sports-events-knowledge-sessions', 4, 'Coordinate with Paul after shortlisting', 'PENDING', 'P1', 'Shortlisting must be done first', null),
  ('sports-events-knowledge-sessions', 5, 'Prepare budget with Paul', 'PENDING', 'P1', null, null),
  ('sports-events-knowledge-sessions', 6, 'Get budget approved', 'PENDING', 'P1', null, null),
  ('sports-events-knowledge-sessions', 7, 'Start implementation', 'PENDING', 'P1', null, null),

  -- Badminton Court Roofing
  ('badminton-court-roofing', 1, 'Create quotation folder', 'COMPLETED', 'P1', null, null),
  ('badminton-court-roofing', 2, 'Create quotation Excel', 'COMPLETED', 'P1', null, null),
  ('badminton-court-roofing', 3, 'Share quotation folder and Excel', 'COMPLETED', 'P1', null, null),
  ('badminton-court-roofing', 4, 'Select L1', 'PENDING', 'P1', null, null),
  ('badminton-court-roofing', 5, 'Connect L1 with Shrey', 'PENDING', 'P1', 'L1 must be selected first', null),
  ('badminton-court-roofing', 6, 'Coordinate with Shrey regarding management implementation', 'PENDING', 'P1', null, null),
  ('badminton-court-roofing', 7, 'Coordinate implementation after management approval', 'PENDING', 'P1', 'Management approval', null),

  -- Board Games Nights
  ('board-games-nights', 1, 'Get quotations', 'PENDING', 'P1', null, null),
  ('board-games-nights', 2, 'Check/update second quotation', 'PENDING', 'P1', null, null),
  ('board-games-nights', 3, 'Prepare budget', 'PENDING', 'P1', null, null),
  ('board-games-nights', 4, 'Get budget approved', 'PENDING', 'P1', null, null),
  ('board-games-nights', 5, 'Implement', 'PENDING', 'P1', null, null),

  -- Physio Sessions
  ('physio-sessions', 1, 'Review quotation received on Gmail', 'PENDING', 'P1', null, null),
  ('physio-sessions', 2, 'Plan online post', 'PENDING', 'P1', null, null),
  ('physio-sessions', 3, 'Publish online post', 'PENDING', 'P1', null, null),
  ('physio-sessions', 4, 'Prepare budget', 'PENDING', 'P1', null, null),
  ('physio-sessions', 5, 'Get budget approved', 'PENDING', 'P1', null, null),
  ('physio-sessions', 6, 'Get SOP approved', 'PENDING', 'P1', null, null),
  ('physio-sessions', 7, 'Implement', 'PENDING', 'P1', null, null),

  -- Shuttle Order (P0)
  ('shuttle-order', 1, 'Confirm required quantity', 'PENDING', 'P0', null, null),
  ('shuttle-order', 2, 'Confirm brand/specification', 'PENDING', 'P0', null, null),
  ('shuttle-order', 3, 'Get quotation/price', 'PENDING', 'P0', null, null),
  ('shuttle-order', 4, 'Get approval if required', 'PENDING', 'P0', null, null),
  ('shuttle-order', 5, 'Place order', 'PENDING', 'P0', null, null),
  ('shuttle-order', 6, 'Confirm delivery', 'PENDING', 'P0', null, null),
  ('shuttle-order', 7, 'Update inventory', 'PENDING', 'P0', null, null),

  -- Court Repair (P0)
  ('court-repair', 1, 'Draft repair email', 'PENDING', 'P0', null, null),
  ('court-repair', 2, 'Send repair email', 'PENDING', 'P0', null, null),
  ('court-repair', 3, 'Track response', 'PENDING', 'P0', null, null),
  ('court-repair', 4, 'Get quotation/estimate', 'PENDING', 'P0', null, null),
  ('court-repair', 5, 'Get management approval', 'PENDING', 'P0', null, null),
  ('court-repair', 6, 'Implement repair', 'PENDING', 'P0', null, null),
  ('court-repair', 7, 'Verify completion', 'PENDING', 'P0', null, null)
)
insert into public.tasks (project_id, title, status, priority, dependency, waiting_for, sort_order)
select p.id, s.title, s.status, s.priority, s.dependency, s.waiting_for, s.ord
  from src s join public.projects p on p.slug = s.slug
 where not exists (select 1 from public.tasks);

-- ---------------------------------------------------------------------
-- Explicit dependencies ("B cannot start before A")
-- ---------------------------------------------------------------------
with deps (slug, task_title, depends_on_title) as (values
  ('yoga-sessions', 'Plan sessions according to participant count', 'Finalize participant count'),
  ('yoga-sessions', 'Purchase yoga mats if required', 'Identify required equipment'),
  ('yoga-sessions', 'Purchase yoga blocks if required', 'Identify required equipment'),
  ('sports-events-knowledge-sessions', 'Coordinate with Paul after shortlisting', 'Shortlist 2–3 sessions'),
  ('sports-events-knowledge-sessions', 'Prepare budget with Paul', 'Coordinate with Paul after shortlisting'),
  ('sports-events-knowledge-sessions', 'Get budget approved', 'Prepare budget with Paul'),
  ('sports-events-knowledge-sessions', 'Start implementation', 'Get budget approved'),
  ('badminton-court-roofing', 'Connect L1 with Shrey', 'Select L1'),
  ('badminton-court-roofing', 'Coordinate with Shrey regarding management implementation', 'Connect L1 with Shrey'),
  ('badminton-court-roofing', 'Coordinate implementation after management approval', 'Coordinate with Shrey regarding management implementation'),
  ('board-games-nights', 'Prepare budget', 'Get quotations'),
  ('board-games-nights', 'Get budget approved', 'Prepare budget'),
  ('board-games-nights', 'Implement', 'Get budget approved'),
  ('physio-sessions', 'Publish online post', 'Plan online post'),
  ('physio-sessions', 'Get budget approved', 'Prepare budget'),
  ('physio-sessions', 'Implement', 'Get SOP approved'),
  ('shuttle-order', 'Place order', 'Get quotation/price'),
  ('shuttle-order', 'Confirm delivery', 'Place order'),
  ('shuttle-order', 'Update inventory', 'Confirm delivery'),
  ('court-repair', 'Send repair email', 'Draft repair email'),
  ('court-repair', 'Track response', 'Send repair email'),
  ('court-repair', 'Get management approval', 'Get quotation/estimate'),
  ('court-repair', 'Implement repair', 'Get management approval'),
  ('court-repair', 'Verify completion', 'Implement repair'),
  ('recovery-space-ice-bath', 'Coordinate installation', 'Confirm final installation location')
)
update public.tasks t
   set depends_on_task_id = d_task.id
  from deps d
  join public.projects p on p.slug = d.slug
  join public.tasks d_task on d_task.project_id = p.id and d_task.title = d.depends_on_title
 where t.project_id = p.id and t.title = d.task_title and t.depends_on_task_id is null;

-- Workflow rule: once "Select L1" is completed, next action = "Connect L1 with Shrey"
update public.tasks t
   set next_task_id = n.id
  from public.projects p, public.tasks n
 where p.slug = 'badminton-court-roofing'
   and t.project_id = p.id and t.title = 'Select L1'
   and n.project_id = p.id and n.title = 'Connect L1 with Shrey';

-- Next action per project = first open task (in order)
update public.projects p
   set next_action = (select t.title from public.tasks t
                       where t.project_id = p.id and t.status not in ('COMPLETED','CANCELLED')
                       order by t.sort_order limit 1);

update public.projects set next_action = 'Run today''s operations checklist'
 where slug = 'daily-cleaning-operations';

-- Board Games: current blocker is quotation collection
update public.tasks t set waiting_for = 'Vendor quotations'
  from public.projects p
 where p.slug = 'board-games-nights' and t.project_id = p.id and t.title = 'Get quotations';

-- ---------------------------------------------------------------------
-- Recurring templates
-- ---------------------------------------------------------------------
insert into public.recurring_templates (project_id, title, description, frequency, checklist, priority, start_date)
select p.id, 'Daily operations checklist',
       'Tick each item through the day. Close the checklist at end of day.',
       'DAILY',
       '["Cleaning checked","Court condition checked","Equipment checked","Complaints checked","Today''s tasks reviewed","End-of-day closure"]'::jsonb,
       'P2', current_date
  from public.projects p
 where p.slug = 'daily-cleaning-operations'
   and not exists (select 1 from public.recurring_templates);

insert into public.recurring_templates (project_id, title, description, frequency, weekday, checklist, priority, start_date)
select p.id, 'Weekly review',
       'Review all projects, update statuses and send the weekly manager update.',
       'WEEKLY', 1,
       '["Review overdue tasks","Review waiting items","Update budgets","Send weekly manager update"]'::jsonb,
       'P2', current_date
  from public.projects p
 where p.slug = 'daily-cleaning-operations'
   and (select count(*) from public.recurring_templates) = 1;

insert into public.recurring_templates (project_id, title, description, frequency, month_day, checklist, priority, start_date)
select p.id, 'Monthly report',
       'Prepare the monthly Sports Desk report: spend vs budget, completed projects, open items.',
       'MONTHLY', 1,
       '["Budget vs spend summary","Completed projects","Open items and blockers"]'::jsonb,
       'P2', current_date
  from public.projects p
 where p.slug = 'daily-cleaning-operations'
   and (select count(*) from public.recurring_templates) = 2;

-- Google Drive structure placeholders (folders to create later). Not seeded as links
-- because no folder URLs were provided.

-- Replace the setup noise in the activity log with one clear entry per project
delete from public.activity_log where actor_name = 'Seed data';
insert into public.activity_log (project_id, entity_type, entity_title, action, actor_name)
select id, 'project', name, 'Project loaded from initial NSCI data', 'Seed data' from public.projects;

reset app.actor;
