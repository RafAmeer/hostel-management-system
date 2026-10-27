-- DormSphere QA security fixes (27 Oct 2026)
-- Fixes found during QA testing before client testing:
--   1. Anyone could sign up as a warden/finance/technician from the public
--      Staff Sign Up page. Staff sign-up now needs a staff code.
--   2. Old "Students manage own ..." policies let a student approve their
--      own booking, fake/delete curfew logs and close their own complaints.
--   3. One live (pending/approved) booking per student per semester is now
--      enforced by the database, not just the screen.
--   4. Approving a booking: checks room capacity, only moves the student's
--      current room when the booking is for their current semester, and
--      frees the bed again if an approved booking is later rejected/cancelled.
--   5. Warden "Log Check-In" override was silently blocked; wardens can now
--      insert curfew logs.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Staff sign-up code
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.staff_signup_code (
  id int primary key default 1 check (id = 1),
  code_hash text not null,
  updated_at timestamptz not null default now()
);

-- To change the staff code later, run in the SQL editor:
--   update private.staff_signup_code
--      set code_hash = extensions.crypt('NEW-CODE-HERE', extensions.gen_salt('bf')), updated_at = now();

create or replace function public.verify_staff_code(p_code text)
returns boolean
language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1 from private.staff_signup_code
     where code_hash = extensions.crypt(coalesce(p_code, ''), code_hash)
  );
$$;
revoke all on function public.verify_staff_code(text) from public;
grant execute on function public.verify_staff_code(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'requested_role', 'student');
  final_role text := 'student';
begin
  if requested in ('warden', 'finance', 'technician') then
    if not public.verify_staff_code(new.raw_user_meta_data->>'staff_code') then
      raise exception 'Invalid staff code' using errcode = '28000';
    end if;
    final_role := requested;
  end if;

  insert into public.profiles (id, full_name, title, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'title',
    final_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove the old catch-all student policies and tighten what's left
-- ---------------------------------------------------------------------------
drop policy if exists "Students manage own bookings"   on public.bookings;
drop policy if exists "Students manage own complaints" on public.complaints;
drop policy if exists "Students manage own curfew logs" on public.curfew_logs;

-- Bookings: a student can only create a *pending* request for themselves.
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert
  with check (student_id = auth.uid() and status = 'pending');

-- Complaints: a student can only create a *pending, unassigned* complaint.
drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints for insert
  with check (student_id = auth.uid() and status = 'pending' and assigned_technician is null);

-- Duplicate technician policies (same rule twice) - keep one pair.
drop policy if exists complaints_select_assigned_technician on public.complaints;
drop policy if exists complaints_update_assigned_technician on public.complaints;
drop policy if exists "Technicians read their assigned complaints"   on public.complaints;
drop policy if exists "Technicians update their assigned complaints" on public.complaints;

-- Curfew logs: students no longer write directly. Their scans go through the
-- curfew-scan edge function (which checks the QR + location). Wardens can
-- still log a manual check-in.
drop policy if exists curfew_insert on public.curfew_logs;
drop policy if exists curfew_warden_insert on public.curfew_logs;
create policy curfew_warden_insert on public.curfew_logs for insert to authenticated
  with check (public.is_warden());

-- ---------------------------------------------------------------------------
-- 3. One live booking per student per semester
-- ---------------------------------------------------------------------------
create unique index if not exists bookings_one_live_per_semester
  on public.bookings (student_id, semester)
  where status in ('pending', 'approved');

-- ---------------------------------------------------------------------------
-- 4. Booking approval trigger
-- ---------------------------------------------------------------------------
create or replace function public.on_booking_approved()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.room_id is not null then
      perform 1 from public.rooms
        where id = new.room_id and occupied_count < capacity
        for update;
      if not found then
        raise exception 'Room % is already full', coalesce(new.room_number, new.room_id::text)
          using errcode = 'P0001';
      end if;
      update public.rooms set occupied_count = occupied_count + 1 where id = new.room_id;
    end if;

    -- Only move the student's current room if this booking is for the
    -- semester on their profile (a next-semester approval must not
    -- overwrite where they live now).
    update public.profiles
       set room_number = new.room_number,
           in_hostel   = true
     where id = new.student_id
       and (semester is null or new.semester is null or semester = new.semester);

  elsif old.status = 'approved' and new.status is distinct from 'approved' then
    if old.room_id is not null then
      update public.rooms set occupied_count = greatest(occupied_count - 1, 0) where id = old.room_id;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Small hardening from the Supabase security advisor
-- ---------------------------------------------------------------------------
revoke execute on function public.list_wardens() from public, anon;
grant execute on function public.list_wardens() to authenticated;

alter function public.fill_booking_display_columns() set search_path = public;
alter function public.fill_complaint_display_columns() set search_path = public;
alter function public.is_finance() set search_path = public;
alter function public.is_technician() set search_path = public;
alter function public.help_ticket_touch() set search_path = public;

drop index if exists public.device_bindings_token_unique;
