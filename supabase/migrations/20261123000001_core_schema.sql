-- =====================================================================
-- NSCI Sports Desk OS - core schema
-- Tables, automatic activity logging, workflow rules, recurring tasks,
-- and Row Level Security (RLS).
-- Run this once in Supabase (SQL Editor) before seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Team members (one row per Supabase Auth user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,            -- WhatsApp number in international format, e.g. 919876543210 (later)
  role        text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Create a profile automatically when a user is invited / signs up.
-- The very first user becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'member' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Permission helpers used by RLS policies
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_team_member()
returns boolean language sql stable as $$
  select public.current_role_name() in ('admin', 'member', 'viewer')
$$;

create or replace function public.can_edit()
returns boolean language sql stable as $$
  select public.current_role_name() in ('admin', 'member')
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role_name() = 'admin'
$$;

-- Name of whoever is making the change (used in the activity log)
create or replace function public.current_actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(full_name, ''), email) from public.profiles where id = auth.uid()),
    nullif(current_setting('app.actor', true), ''),
    'System'
  )
$$;

-- ---------------------------------------------------------------------
-- 2. Projects
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (length(trim(name)) > 0),
  slug              text not null unique,
  description       text,
  status            text not null default 'PENDING'
                    check (status in ('PENDING','IN_PROGRESS','WAITING','COMPLETED','CANCELLED','TBD')),
  priority          text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  owner             text,
  start_date        date,
  target_date       date,
  estimated_budget  numeric(12,2) check (estimated_budget is null or estimated_budget >= 0),
  quoted_amount     numeric(12,2) check (quoted_amount is null or quoted_amount >= 0),
  approved_budget   numeric(12,2) check (approved_budget is null or approved_budget >= 0),
  actual_spend      numeric(12,2) not null default 0,  -- kept in sync from public.expenses
  remaining_budget  numeric(12,2) generated always as (coalesce(approved_budget, 0) - actual_spend) stored,
  budget_status     text not null default 'NOT_STARTED'
                    check (budget_status in ('NOT_STARTED','DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','NOT_REQUIRED')),
  waiting_for       text,
  current_stage     text,
  next_action       text,
  drive_folder_url  text check (drive_folder_url is null or drive_folder_url ~* '^https?://'),
  is_recurring      boolean not null default false,
  aliases           text[] not null default '{}',   -- extra names the AI can match, e.g. {roofing}
  sort_order        int not null default 0,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Recurring task templates (daily checklist, weekly review, ...)
-- ---------------------------------------------------------------------
create table if not exists public.recurring_templates (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  title                text not null check (length(trim(title)) > 0),
  description          text,
  frequency            text not null check (frequency in ('DAILY','WEEKLY','MONTHLY','CUSTOM')),
  interval_days        int check (interval_days is null or interval_days between 1 and 365), -- CUSTOM only
  weekday              int check (weekday is null or weekday between 0 and 6),             -- WEEKLY: 0=Sunday
  month_day            int check (month_day is null or month_day between 1 and 31),        -- MONTHLY
  checklist            jsonb not null default '[]'::jsonb,  -- ["Cleaning checked", ...]
  priority             text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  assigned_to          text,
  start_date           date not null default current_date,
  active               boolean not null default true,
  last_generated_date  date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (frequency <> 'CUSTOM' or interval_days is not null),
  check (frequency <> 'WEEKLY' or weekday is not null),
  check (frequency <> 'MONTHLY' or month_day is not null)
);

-- ---------------------------------------------------------------------
-- 4. Tasks
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  title                  text not null check (length(trim(title)) > 0),
  description            text,
  status                 text not null default 'PENDING'
                         check (status in ('PENDING','IN_PROGRESS','WAITING','COMPLETED','CANCELLED','TBD')),
  priority               text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  owner                  text,
  assigned_to            text,
  due_date               date,
  start_date             date,
  waiting_for            text,
  waiting_since          timestamptz,      -- set automatically; drives follow-up reminders
  dependency             text,             -- free-text dependency, e.g. "Pool renovation"
  depends_on_task_id     uuid references public.tasks(id) on delete set null,
  next_action            text,
  next_task_id           uuid references public.tasks(id) on delete set null, -- workflow: becomes the next action when this task completes
  estimated_budget       numeric(12,2) check (estimated_budget is null or estimated_budget >= 0),
  approved_budget        numeric(12,2) check (approved_budget is null or approved_budget >= 0),
  actual_spend           numeric(12,2) check (actual_spend is null or actual_spend >= 0),
  notes                  text,
  checklist              jsonb not null default '[]'::jsonb,  -- [{"label": "...", "done": false}]
  recurring_template_id  uuid references public.recurring_templates(id) on delete set null,
  occurrence_date        date,
  sort_order             int not null default 0,
  created_by             uuid references auth.users(id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  completed_at           timestamptz,
  check (depends_on_task_id is null or depends_on_task_id <> id),
  check (next_task_id is null or next_task_id <> id),
  unique (recurring_template_id, occurrence_date)
);

create index if not exists tasks_project_idx  on public.tasks (project_id);
create index if not exists tasks_status_idx   on public.tasks (status);
create index if not exists tasks_due_idx      on public.tasks (due_date);
create index if not exists tasks_priority_idx on public.tasks (priority);

-- ---------------------------------------------------------------------
-- 5. Documents (links / uploaded files / quotations)
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  title         text not null check (length(trim(title)) > 0),
  doc_type      text not null default 'DOCUMENT'
                check (doc_type in ('QUOTATION','INVOICE','APPROVAL','PDF','IMAGE','SPREADSHEET','DOCUMENT','NOTE','FOLDER','EMAIL','OTHER')),
  url           text check (url is null or url ~* '^https?://'),
  storage_path  text,         -- Supabase Storage path when a file is uploaded
  vendor        text,
  amount        numeric(12,2) check (amount is null or amount >= 0),
  is_l1         boolean not null default false,  -- lowest / selected quotation
  notes         text,
  external_ref  text,         -- e.g. Gmail message id or Drive file id (future integrations)
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (url is not null or storage_path is not null or notes is not null)
);
create index if not exists documents_project_idx on public.documents (project_id);

-- ---------------------------------------------------------------------
-- 6. Expenses (actual spend). projects.actual_spend = sum of these.
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete set null,
  description  text not null check (length(trim(description)) > 0),
  amount       numeric(12,2) not null check (amount > 0),
  spent_on     date not null default current_date,
  vendor       text,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists expenses_project_idx on public.expenses (project_id);

-- ---------------------------------------------------------------------
-- 7. Activity log (written only by triggers)
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id              bigint generated always as identity primary key,
  project_id      uuid references public.projects(id) on delete cascade,
  task_id         uuid references public.tasks(id) on delete set null,
  entity_type     text not null,      -- project | task | document | expense
  entity_title    text,
  action          text not null,      -- human readable, e.g. "Status changed"
  field           text,
  previous_value  text,
  new_value       text,
  actor_id        uuid,
  actor_name      text not null default 'System',
  created_at      timestamptz not null default now()
);
create index if not exists activity_project_idx on public.activity_log (project_id, created_at desc);
create index if not exists activity_task_idx    on public.activity_log (task_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8. Reminders, reports, settings, pending confirmations
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references public.tasks(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  title       text not null,
  message     text,
  remind_at   timestamptz not null,
  kind        text not null default 'MANUAL' check (kind in ('MANUAL','WAITING_FOLLOWUP','OVERDUE')),
  status      text not null default 'PENDING' check (status in ('PENDING','SENT','DISMISSED')),
  sent_at     timestamptz,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (status, remind_at);
-- Only one open follow-up per waiting task
create unique index if not exists reminders_one_open_followup
  on public.reminders (task_id) where kind = 'WAITING_FOLLOWUP' and status = 'PENDING';

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  report_type   text not null check (report_type in ('DAILY','WEEKLY','MORNING_DIGEST','EVENING_DIGEST')),
  title         text not null,
  content       text not null,
  status        text not null default 'DRAFT' check (status in ('DRAFT','REVIEWED','SENT')),
  generated_at  timestamptz not null default now(),
  sent_at       timestamptz,
  created_by    uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.app_settings (
  id                     int primary key default 1 check (id = 1),
  timezone               text not null default 'Asia/Kolkata',
  morning_reminder_time  time not null default '09:00',
  evening_reminder_time  time not null default '18:30',
  waiting_followup_days  int  not null default 3 check (waiting_followup_days between 1 and 60),
  reminders_enabled      boolean not null default true,
  last_morning_digest    date,
  last_evening_digest    date,
  updated_at             timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Write actions requested over WhatsApp wait here until the user replies YES.
-- Only the server (service role) can touch this table.
create table if not exists public.pending_actions (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null default 'whatsapp',
  sender      text not null,
  action      jsonb not null,
  summary     text not null,
  status      text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','CANCELLED','EXPIRED')),
  expires_at  timestamptz not null default now() + interval '15 minutes',
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists templates_touch on public.recurring_templates;
create trigger templates_touch before update on public.recurring_templates
  for each row execute function public.touch_updated_at();

-- Generic activity writer
create or replace function public.log_activity(
  p_project_id uuid, p_task_id uuid, p_entity_type text, p_entity_title text,
  p_action text, p_field text, p_prev text, p_new text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log
    (project_id, task_id, entity_type, entity_title, action, field, previous_value, new_value, actor_id, actor_name)
  values
    (p_project_id, p_task_id, p_entity_type, p_entity_title, p_action, p_field, p_prev, p_new,
     auth.uid(), public.current_actor_name());
end;
$$;
revoke all on function public.log_activity(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Task: timestamps, completion and waiting tracking
create or replace function public.tasks_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'COMPLETED' then
    new.completed_at := null;
  end if;

  if new.status = 'WAITING' or nullif(trim(coalesce(new.waiting_for, '')), '') is not null then
    if tg_op = 'INSERT'
       or (old.status is distinct from 'WAITING' and new.status = 'WAITING')
       or (old.waiting_for is distinct from new.waiting_for) then
      new.waiting_since := now();
    end if;
  else
    new.waiting_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_before_write on public.tasks;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Workflow rule: decide a project's next action after a task finishes.
-- 1. If the finished task names a next task (e.g. "Select L1" -> "Connect L1 with Shrey"), use it.
-- 2. Otherwise, if the project's next action was the task just finished (or empty),
--    move to the first open task in order.
create or replace function public.advance_project_next_action(p_task public.tasks)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_next    text;
begin
  select * into v_project from public.projects where id = p_task.project_id;
  if not found then return; end if;

  if p_task.next_task_id is not null then
    select title into v_next from public.tasks
     where id = p_task.next_task_id and status not in ('COMPLETED', 'CANCELLED');
  end if;

  if v_next is null then
    if v_project.next_action is not null
       and lower(trim(v_project.next_action)) <> lower(trim(p_task.title)) then
      return;  -- a manually written next action is still valid; leave it
    end if;
    select title into v_next from public.tasks
     where project_id = p_task.project_id
       and status not in ('COMPLETED', 'CANCELLED')
       and recurring_template_id is null
     order by sort_order, created_at
     limit 1;
  end if;

  update public.projects
     set next_action = coalesce(v_next, 'All tasks done - review and close project')
   where id = p_task.project_id
     and next_action is distinct from coalesce(v_next, 'All tasks done - review and close project');
end;
$$;
revoke all on function public.advance_project_next_action(public.tasks) from public, anon, authenticated;

-- Task activity + workflow
create or replace function public.tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  if tg_op = 'DELETE' then
    perform public.log_activity(old.project_id, null, 'task', old.title, 'Task deleted', null, old.title, null);
    return old;
  end if;
  t := new;

  if tg_op = 'INSERT' then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Task created', null, null, t.title);
    -- Fill an empty next action for the project
    update public.projects set next_action = t.title
     where id = t.project_id and next_action is null
       and t.status not in ('COMPLETED','CANCELLED') and t.recurring_template_id is null;
    return new;
  end if;

  -- UPDATE
  if old.status is distinct from new.status then
    perform public.log_activity(t.project_id, t.id, 'task', t.title,
      case when new.status = 'COMPLETED' then 'Task completed'
           when new.status = 'CANCELLED' then 'Task cancelled'
           else 'Status changed' end,
      'status', old.status, new.status);
    if new.status in ('COMPLETED', 'CANCELLED') then
      perform public.advance_project_next_action(t);
    end if;
  end if;
  if old.priority is distinct from new.priority then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Priority changed', 'priority', old.priority, new.priority);
  end if;
  if old.assigned_to is distinct from new.assigned_to then
    perform public.log_activity(t.project_id, t.id, 'task', t.title,
      case when new.assigned_to is null then 'Unassigned' else 'Assigned to ' || new.assigned_to end,
      'assigned_to', old.assigned_to, new.assigned_to);
  end if;
  if old.owner is distinct from new.owner then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Owner changed', 'owner', old.owner, new.owner);
  end if;
  if old.waiting_for is distinct from new.waiting_for then
    perform public.log_activity(t.project_id, t.id, 'task', t.title,
      case when new.waiting_for is null then 'No longer waiting' else 'Waiting for ' || new.waiting_for end,
      'waiting_for', old.waiting_for, new.waiting_for);
  end if;
  if old.due_date is distinct from new.due_date then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Due date changed', 'due_date', old.due_date::text, new.due_date::text);
  end if;
  if old.title is distinct from new.title then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Renamed', 'title', old.title, new.title);
  end if;
  if old.dependency is distinct from new.dependency or old.depends_on_task_id is distinct from new.depends_on_task_id then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Dependency changed', 'dependency',
      coalesce(old.dependency, (select title from public.tasks where id = old.depends_on_task_id)),
      coalesce(new.dependency, (select title from public.tasks where id = new.depends_on_task_id)));
  end if;
  if old.next_action is distinct from new.next_action then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Next action changed', 'next_action', old.next_action, new.next_action);
  end if;
  if old.estimated_budget is distinct from new.estimated_budget then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Estimated budget changed', 'estimated_budget', old.estimated_budget::text, new.estimated_budget::text);
  end if;
  if old.approved_budget is distinct from new.approved_budget then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Approved budget changed', 'approved_budget', old.approved_budget::text, new.approved_budget::text);
  end if;
  if old.actual_spend is distinct from new.actual_spend then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Actual spend changed', 'actual_spend', old.actual_spend::text, new.actual_spend::text);
  end if;
  if old.project_id is distinct from new.project_id then
    perform public.log_activity(t.project_id, t.id, 'task', t.title, 'Moved to another project', 'project_id',
      (select name from public.projects where id = old.project_id), (select name from public.projects where id = new.project_id));
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_after_write on public.tasks;
create trigger tasks_after_write after insert or update or delete on public.tasks
  for each row execute function public.tasks_after_write();

-- Project activity
create or replace function public.projects_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.id, null, 'project', new.name, 'Project created', null, null, new.name);
    return new;
  end if;
  if old.status is distinct from new.status then
    perform public.log_activity(new.id, null, 'project', new.name, 'Status changed', 'status', old.status, new.status);
  end if;
  if old.priority is distinct from new.priority then
    perform public.log_activity(new.id, null, 'project', new.name, 'Priority changed', 'priority', old.priority, new.priority);
  end if;
  if old.owner is distinct from new.owner then
    perform public.log_activity(new.id, null, 'project', new.name, 'Owner changed', 'owner', old.owner, new.owner);
  end if;
  if old.waiting_for is distinct from new.waiting_for then
    perform public.log_activity(new.id, null, 'project', new.name,
      case when new.waiting_for is null then 'No longer waiting' else 'Waiting for ' || new.waiting_for end,
      'waiting_for', old.waiting_for, new.waiting_for);
  end if;
  if old.current_stage is distinct from new.current_stage then
    perform public.log_activity(new.id, null, 'project', new.name, 'Stage changed', 'current_stage', old.current_stage, new.current_stage);
  end if;
  if old.next_action is distinct from new.next_action then
    perform public.log_activity(new.id, null, 'project', new.name, 'Next action changed', 'next_action', old.next_action, new.next_action);
  end if;
  if old.target_date is distinct from new.target_date then
    perform public.log_activity(new.id, null, 'project', new.name, 'Deadline changed', 'target_date', old.target_date::text, new.target_date::text);
  end if;
  if old.estimated_budget is distinct from new.estimated_budget then
    perform public.log_activity(new.id, null, 'project', new.name, 'Estimated budget changed', 'estimated_budget', old.estimated_budget::text, new.estimated_budget::text);
  end if;
  if old.quoted_amount is distinct from new.quoted_amount then
    perform public.log_activity(new.id, null, 'project', new.name, 'Quoted amount changed', 'quoted_amount', old.quoted_amount::text, new.quoted_amount::text);
  end if;
  if old.approved_budget is distinct from new.approved_budget then
    perform public.log_activity(new.id, null, 'project', new.name, 'Approved budget changed', 'approved_budget', old.approved_budget::text, new.approved_budget::text);
  end if;
  if old.budget_status is distinct from new.budget_status then
    perform public.log_activity(new.id, null, 'project', new.name,
      case new.budget_status when 'APPROVED' then 'Budget approved'
                             when 'REJECTED' then 'Budget rejected'
                             when 'PENDING_APPROVAL' then 'Budget sent for approval'
                             else 'Budget status changed' end,
      'budget_status', old.budget_status, new.budget_status);
  end if;
  if old.drive_folder_url is distinct from new.drive_folder_url then
    perform public.log_activity(new.id, null, 'project', new.name, 'Drive folder updated', 'drive_folder_url', old.drive_folder_url, new.drive_folder_url);
  end if;
  return new;
end;
$$;

drop trigger if exists projects_after_write on public.projects;
create trigger projects_after_write after insert or update on public.projects
  for each row execute function public.projects_after_write();

-- Document activity (including "L1 selected")
create or replace function public.documents_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.log_activity(old.project_id, old.task_id, 'document', old.title, 'Document removed', null, old.title, null);
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.project_id, new.task_id, 'document', new.title,
      case when new.doc_type = 'QUOTATION' then 'Quotation added' else 'Document added' end, null, null, new.title);
  end if;
  if new.is_l1 and (tg_op = 'INSERT' or not old.is_l1) then
    -- only one L1 per project
    update public.documents set is_l1 = false
     where project_id = new.project_id and id <> new.id and is_l1;
    perform public.log_activity(new.project_id, new.task_id, 'document', new.title, 'L1 selected', 'is_l1',
      null, coalesce(new.vendor, new.title) || coalesce(' (' || new.amount::text || ')', ''));
    -- Workflow: choosing an L1 quotation completes the project's "Select L1" task,
    -- which in turn moves the next action on (e.g. "Connect L1 with Shrey").
    update public.tasks set status = 'COMPLETED'
     where project_id = new.project_id
       and status not in ('COMPLETED', 'CANCELLED')
       and title ~* '^\s*select\s+l1\y';
    if new.amount is not null then
      update public.projects set quoted_amount = new.amount where id = new.project_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_after_write on public.documents;
create trigger documents_after_write after insert or update or delete on public.documents
  for each row execute function public.documents_after_write();

-- Expenses keep projects.actual_spend in sync
create or replace function public.expenses_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects
     set actual_spend = coalesce((select sum(amount) from public.expenses where project_id = v_project), 0)
   where id = v_project;
  if tg_op = 'UPDATE' and old.project_id <> new.project_id then
    update public.projects
       set actual_spend = coalesce((select sum(amount) from public.expenses where project_id = old.project_id), 0)
     where id = old.project_id;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.project_id, new.task_id, 'expense', new.description, 'Spend recorded', 'actual_spend', null, new.amount::text);
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.project_id, old.task_id, 'expense', old.description, 'Spend removed', 'actual_spend', old.amount::text, null);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists expenses_after_write on public.expenses;
create trigger expenses_after_write after insert or update or delete on public.expenses
  for each row execute function public.expenses_after_write();

-- =====================================================================
-- RECURRING TASKS
-- Creates today's occurrence for every active template (safe to call
-- many times a day: duplicates are ignored). Called by the app when the
-- dashboard loads and by n8n every morning.
-- =====================================================================
create or replace function public.generate_recurring_tasks(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl      public.recurring_templates;
  v_due    boolean;
  v_count  int := 0;
  v_rows   int;
  v_last   int;
begin
  if auth.uid() is not null and not public.can_edit() then
    raise exception 'not allowed';
  end if;

  for tpl in select * from public.recurring_templates where active and start_date <= p_date loop
    v_last := extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
    v_due := case tpl.frequency
      when 'DAILY'   then true
      when 'WEEKLY'  then extract(dow from p_date)::int = tpl.weekday
      when 'MONTHLY' then extract(day from p_date)::int = least(tpl.month_day, v_last)
      when 'CUSTOM'  then ((p_date - tpl.start_date) % tpl.interval_days) = 0
    end;
    continue when not v_due;

    insert into public.tasks
      (project_id, title, description, status, priority, assigned_to, due_date, start_date,
       checklist, recurring_template_id, occurrence_date, sort_order)
    values
      (tpl.project_id, tpl.title || ' - ' || to_char(p_date, 'DD Mon YYYY'), tpl.description,
       'PENDING', tpl.priority, tpl.assigned_to, p_date, p_date,
       coalesce((select jsonb_agg(jsonb_build_object('label', item #>> '{}', 'done', false))
                   from jsonb_array_elements(tpl.checklist) item), '[]'::jsonb),
       tpl.id, p_date, 1000)
    on conflict (recurring_template_id, occurrence_date) do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;

    update public.recurring_templates set last_generated_date = p_date where id = tpl.id;
  end loop;
  return v_count;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- viewer = read only, member = read + write, admin = everything.
-- Anonymous visitors get nothing.
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.tasks               enable row level security;
alter table public.documents           enable row level security;
alter table public.expenses            enable row level security;
alter table public.activity_log        enable row level security;
alter table public.reminders           enable row level security;
alter table public.reports             enable row level security;
alter table public.app_settings        enable row level security;
alter table public.pending_actions     enable row level security;  -- no policies: server only

-- Table privileges (RLS still decides which rows)
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.projects, public.recurring_templates, public.tasks, public.documents,
  public.expenses, public.reminders, public.reports
  to authenticated;
grant select on public.activity_log, public.profiles, public.app_settings to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;     -- users cannot change their own role
grant update (timezone, morning_reminder_time, evening_reminder_time, waiting_followup_days, reminders_enabled, updated_at)
  on public.app_settings to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke execute on function public.generate_recurring_tasks(date) from public, anon;
grant execute on function public.generate_recurring_tasks(date) to authenticated, service_role;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (public.is_team_member() or id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- standard team tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array['projects','recurring_templates','tasks','documents','expenses','reminders','reports'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', tbl);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_team_member())', tbl);
    execute format('drop policy if exists %1$s_insert on public.%1$s', tbl);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.can_edit())', tbl);
    execute format('drop policy if exists %1$s_update on public.%1$s', tbl);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.can_edit()) with check (public.can_edit())', tbl);
    execute format('drop policy if exists %1$s_delete on public.%1$s', tbl);
    if tbl = 'projects' then
      execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_admin())', tbl);
    else
      execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.can_edit())', tbl);
    end if;
  end loop;
end $$;

-- activity log: read only for the team (rows are written by triggers)
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated using (public.is_team_member());

-- settings: everyone reads, only admins change
drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated using (public.is_team_member());
drop policy if exists settings_update on public.app_settings;
create policy settings_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
