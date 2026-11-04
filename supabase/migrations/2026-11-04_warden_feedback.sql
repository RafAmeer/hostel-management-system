-- =====================================================================
-- 2026-11-04 — Updates from warden user-testing feedback + Ash's extras
-- Safe to run more than once (idempotent).
--
--  1. Student birthday + emergency contact           (profiles)
--  2. Emergency / urgent announcements               (announcements.priority)
--  3. Urgent maintenance flag on complaints          (complaints.priority)
--  4. Part-payments, outstanding balance, reminders  (payments)
--  5. Audit trail of important actions               (audit_logs + triggers)
--  6. Realtime for the tables the dashboards watch
-- =====================================================================

-- 1. Birthday + emergency contact ------------------------------------
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists emergency_name text;
alter table public.profiles add column if not exists emergency_relation text;
alter table public.profiles add column if not exists emergency_phone text;
-- Read access is unchanged: a student reads their own row, wardens read
-- all rows (existing profiles RLS). Finance/technicians can't see these.

-- 2. Emergency announcements -----------------------------------------
alter table public.announcements add column if not exists priority text not null default 'normal';
alter table public.announcements drop constraint if exists announcements_priority_check;
alter table public.announcements add constraint announcements_priority_check check (priority in ('normal', 'urgent'));

-- 3. Urgent complaints -----------------------------------------------
alter table public.complaints add column if not exists priority text not null default 'normal';
alter table public.complaints drop constraint if exists complaints_priority_check;
alter table public.complaints add constraint complaints_priority_check check (priority in ('normal', 'urgent'));
alter table public.complaints add column if not exists completed_at timestamptz;

-- 4. Payments: part-payments + reminders -----------------------------
alter table public.payments add column if not exists amount_paid numeric not null default 0;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists reminder_sent_at timestamptz;
-- Rows already marked paid count as fully paid.
update public.payments set amount_paid = amount where status = 'paid' and coalesce(amount_paid, 0) = 0;

-- Stamp when a complaint is completed (for "resolved" alerts and reports).
create or replace function public.stamp_complaint_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_stamp_complaint_completed on public.complaints;
create trigger trg_stamp_complaint_completed
  before update on public.complaints
  for each row execute function public.stamp_complaint_completed();

-- 5. Audit trail ------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_name  text,
  actor_role  text,
  table_name  text not null,
  record_id   text,
  action      text not null,
  summary     text,
  details     jsonb
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_table_idx on public.audit_logs (table_name);

alter table public.audit_logs enable row level security;
-- Wardens can read. Nobody can insert/update/delete from the app: rows are
-- only written by the security-definer trigger below.
drop policy if exists "audit_logs_warden_read" on public.audit_logs;
create policy "audit_logs_warden_read" on public.audit_logs
  for select to authenticated using (public.is_warden());
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create or replace function public.write_audit(p_table text, p_record text, p_action text, p_summary text, p_details jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_role text;
begin
  select full_name, role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, actor_role, table_name, record_id, action, summary, details)
  values (auth.uid(), coalesce(v_name, case when auth.uid() is null then 'System' else 'Unknown user' end), v_role,
          p_table, p_record, p_action, p_summary, p_details);
end;
$$;
revoke execute on function public.write_audit(text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Rows are read as JSON so one function works for every table.
  r      jsonb := to_jsonb(coalesce(new, old));
  jn     jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  jo     jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  who    text;
  tech   text;
  actor_role text;
begin
  -- Never let logging break the real change.
  begin
    if tg_table_name = 'bookings' then
      who := coalesce((r->>'student_name'), (select full_name from profiles where id = (r->>'student_id')::uuid), 'Student');
      if tg_op = 'INSERT' then
        perform write_audit('bookings', (r->>'id')::text, 'Booking requested',
          format('%s requested room %s%s', who, coalesce((r->>'room_number'), '?'), coalesce(' (' || (r->>'semester') || ')', '')));
      elsif tg_op = 'UPDATE' and (jn->>'status') is distinct from (jo->>'status') then
        perform write_audit('bookings', (r->>'id')::text, 'Booking ' || (jn->>'status'),
          format('%s · room %s%s · %s → %s', who, coalesce((r->>'room_number'), '?'), coalesce(' (' || (r->>'semester') || ')', ''), (jo->>'status'), (jn->>'status')));
      end if;

    elsif tg_table_name = 'complaints' then
      who := coalesce((r->>'student_name'), (select full_name from profiles where id = (r->>'student_id')::uuid), 'Student');
      if tg_op = 'INSERT' then
        perform write_audit('complaints', (r->>'id')::text,
          case when (r->>'priority') = 'urgent' then 'Urgent complaint submitted' else 'Complaint submitted' end,
          format('%s · %s · room %s', who, coalesce((r->>'category'), 'Other'), coalesce((r->>'room_number'), '?')));
      elsif tg_op = 'UPDATE' then
        if (jn->>'assigned_technician') is distinct from (jo->>'assigned_technician') and (jn->>'assigned_technician') is not null then
          select full_name into tech from profiles where id = (jn->>'assigned_technician')::uuid;
          perform write_audit('complaints', (r->>'id')::text, 'Technician assigned',
            format('%s complaint (room %s) → %s', coalesce((r->>'category'), 'Other'), coalesce((r->>'room_number'), '?'), coalesce(tech, 'technician')));
        end if;
        if (jn->>'status') is distinct from (jo->>'status') then
          perform write_audit('complaints', (r->>'id')::text, 'Complaint ' || replace((jn->>'status'), '_', ' '),
            format('%s complaint from %s (room %s)', coalesce((r->>'category'), 'Other'), who, coalesce((r->>'room_number'), '?')));
        end if;
      end if;

    elsif tg_table_name = 'profiles' then
      who := coalesce((r->>'full_name'), 'User');
      if tg_op = 'INSERT' then
        perform write_audit('profiles', (r->>'id')::text, 'Account registered', format('%s (%s)', who, coalesce((r->>'role'), 'student')));
      elsif tg_op = 'UPDATE' then
        if ((jn->>'eligibility_override') is distinct from (jo->>'eligibility_override'))
           or (coalesce((jn->>'eligibility_override')::boolean, false) and (jn->>'eligibility_status') is distinct from (jo->>'eligibility_status')) then
          perform write_audit('profiles', (r->>'id')::text, 'Eligibility changed',
            format('%s → %s%s', who, coalesce((jn->>'eligibility_status'), 'pending'),
                   case when coalesce((jn->>'eligibility_override')::boolean, false) then ' (warden override)' else ' (automatic)' end));
        end if;
        if (jn->>'finance_status') is distinct from (jo->>'finance_status') then
          perform write_audit('profiles', (r->>'id')::text, 'Finance verification', format('%s → %s', who, coalesce((jn->>'finance_status'), 'pending')));
        end if;
        if (jn->>'room_number') is distinct from (jo->>'room_number') and auth.uid() is distinct from (r->>'id')::uuid then
          perform write_audit('profiles', (r->>'id')::text, 'Student room changed',
            format('%s: %s → %s', who, coalesce((jo->>'room_number'), 'none'), coalesce((jn->>'room_number'), 'none')));
        end if;
        if (jn->>'role') is distinct from (jo->>'role') then
          perform write_audit('profiles', (r->>'id')::text, 'Role changed', format('%s: %s → %s', who, (jo->>'role'), (jn->>'role')));
        end if;
      end if;

    elsif tg_table_name = 'rooms' then
      -- Occupancy counters change automatically on every approval; only log
      -- real edits by the warden (number, capacity, price, gender, ...).
      if tg_op = 'UPDATE' and (jn - 'occupied_count' - 'status') = (jo - 'occupied_count' - 'status') then
        return new;
      end if;
      perform write_audit('rooms', (r->>'id')::text,
        case tg_op when 'INSERT' then 'Room added' when 'DELETE' then 'Room removed' else 'Room updated' end,
        format('%s · %s · capacity %s', coalesce((r->>'residence'), '?'), coalesce((r->>'room_number'), '?'), coalesce((r->>'capacity')::text, '?')));

    elsif tg_table_name = 'announcements' then
      if tg_op = 'INSERT' then
        perform write_audit('announcements', (r->>'id')::text,
          case when (r->>'priority') = 'urgent' then 'Emergency announcement sent' else 'Announcement posted' end, (r->>'title'));
      elsif tg_op = 'DELETE' then
        perform write_audit('announcements', (r->>'id')::text, 'Announcement deleted', (r->>'title'));
      end if;

    elsif tg_table_name = 'payments' then
      who := coalesce((r->>'student_name'), 'Student');
      if tg_op = 'INSERT' then
        perform write_audit('payments', (r->>'id')::text, 'Charge added',
          format('%s · RM %s · due %s', who, to_char((r->>'amount')::numeric, 'FM999990.00'), coalesce((r->>'due_date')::text, '?')));
      elsif tg_op = 'UPDATE' then
        if coalesce((jn->>'amount_paid')::numeric, 0) is distinct from coalesce((jo->>'amount_paid')::numeric, 0) then
          perform write_audit('payments', (r->>'id')::text, 'Payment recorded',
            format('%s paid RM %s · RM %s remaining', who,
                   to_char(coalesce((jn->>'amount_paid')::numeric, 0) - coalesce((jo->>'amount_paid')::numeric, 0), 'FM999990.00'),
                   to_char(greatest((jn->>'amount')::numeric - coalesce((jn->>'amount_paid')::numeric, 0), 0), 'FM999990.00')));
        elsif (jn->>'status') is distinct from (jo->>'status') then
          perform write_audit('payments', (r->>'id')::text, 'Payment status changed', format('%s: %s → %s', who, (jo->>'status'), (jn->>'status')));
        end if;
        if (jn->>'reminder_sent_at') is distinct from (jo->>'reminder_sent_at') and (jn->>'reminder_sent_at') is not null then
          perform write_audit('payments', (r->>'id')::text, 'Payment reminder sent',
            format('%s · RM %s outstanding', who, to_char(greatest((jn->>'amount')::numeric - coalesce((jn->>'amount_paid')::numeric, 0), 0), 'FM999990.00')));
        end if;
      end if;

    elsif tg_table_name = 'curfew_logs' then
      -- Student QR scans come through the curfew-scan function and are
      -- already their own record; only log manual entries by staff.
      select role into actor_role from profiles where id = auth.uid();
      if actor_role = 'warden' then
        perform write_audit('curfew_logs', (r->>'id')::text, 'Manual curfew ' || replace((r->>'scan_type'), '_', '-'),
          coalesce((select full_name from profiles where id = (r->>'student_id')::uuid), 'Student'));
      end if;
    end if;
  exception when others then
    raise warning 'audit_row failed on %: %', tg_table_name, sqlerrm;
  end;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['bookings', 'complaints', 'profiles', 'rooms', 'announcements', 'payments', 'curfew_logs'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- 6. Realtime ----------------------------------------------------------
-- Dashboards subscribe to these so changes appear without a refresh.
-- (Realtime still respects each table's RLS.)
do $$
declare t text;
begin
  foreach t in array array['bookings', 'complaints', 'curfew_logs', 'help_tickets', 'profiles', 'rooms', 'payments', 'announcements', 'audit_logs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
