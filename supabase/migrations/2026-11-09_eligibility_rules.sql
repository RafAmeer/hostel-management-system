-- 2026-11-09  Automatic eligibility verification + warden override reason
--
-- Proposal, Objective 1: "automated student eligibility verification".
-- Proposal, Warden Module: "override eligibility flags with justification".
--
-- What this does:
--   1. New profile columns: eligibility_reason (why the automatic check gave
--      that result, shown to the student), eligibility_note (the warden's
--      justification for an override), who/when overrode it, and when the
--      check last ran.
--   2. One automatic rule, run by the database on every profile change and
--      whenever that student's payments change:
--        - Finance rejected the account      -> not eligible
--        - Overdue unpaid hostel payment     -> not eligible
--        - Profile not complete              -> pending
--        - Waiting for Finance verification  -> pending
--        - Otherwise                         -> eligible
--      A warden override always wins over the automatic result, and must
--      include a written reason.
--   3. Students can't change their own eligibility (until now nothing in the
--      database stopped a student setting eligibility_status on their own
--      profile).
--   4. Room requests are blocked for students marked not eligible (the
--      existing Finance-verified rule stays).
--   5. Removes the older profile-completeness-only eligibility trigger
--      (2026-09-30) so two rules don't fight, then re-checks every student.
--
-- Safe to run more than once.

-- 1. Columns ---------------------------------------------------------------
alter table public.profiles
  add column if not exists eligibility_status text default 'pending',
  add column if not exists eligibility_override boolean not null default false,
  add column if not exists eligibility_reason text,
  add column if not exists eligibility_note text,
  add column if not exists eligibility_override_by uuid references auth.users(id) on delete set null,
  add column if not exists eligibility_override_at timestamptz,
  add column if not exists eligibility_checked_at timestamptz;

-- 2. Remove the old automatic eligibility trigger(s) ----------------------
-- Its file is no longer in the repo, so find it by what it does: any
-- trigger on profiles whose function sets eligibility_status, other than
-- the audit log and the new functions below.
do $$
declare rec record;
begin
  for rec in
    select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.profiles'::regclass
       and not t.tgisinternal
       and p.prosrc ilike '%eligibility_status%'
       and p.proname not in ('audit_row', 'guard_eligibility', 'compute_eligibility')
  loop
    execute format('drop trigger if exists %I on public.profiles', rec.tgname);
    raise notice 'Dropped old eligibility trigger %', rec.tgname;
  end loop;
end $$;

-- 3. Guard: only wardens (or the SQL editor) can override ------------------
create or replace function public.guard_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_warden() then
    -- An override needs a written reason.
    if new.eligibility_override and nullif(btrim(coalesce(new.eligibility_note, '')), '') is null then
      raise exception 'A reason is required to override eligibility' using errcode = '23514';
    end if;
    if not new.eligibility_override then
      new.eligibility_note        := null;
      new.eligibility_override_by := null;
      new.eligibility_override_at := null;
    elsif tg_op = 'INSERT'
       or new.eligibility_override is distinct from old.eligibility_override
       or new.eligibility_status   is distinct from old.eligibility_status
       or new.eligibility_note     is distinct from old.eligibility_note then
      new.eligibility_override_by := auth.uid();
      new.eligibility_override_at := now();
    end if;
    return new;
  end if;

  -- Everyone else (the student, finance, technician): keep the old values.
  if tg_op = 'INSERT' then
    new.eligibility_override    := false;
    new.eligibility_note        := null;
    new.eligibility_override_by := null;
    new.eligibility_override_at := null;
  else
    new.eligibility_override    := old.eligibility_override;
    new.eligibility_status      := old.eligibility_status;
    new.eligibility_note        := old.eligibility_note;
    new.eligibility_override_by := old.eligibility_override_by;
    new.eligibility_override_at := old.eligibility_override_at;
  end if;
  return new;
end;
$$;

-- 4. The automatic rule ----------------------------------------------------
create or replace function public.compute_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  complete boolean;
  overdue  numeric := 0;
begin
  if coalesce(new.role, 'student') <> 'student' then
    return new;
  end if;

  new.eligibility_checked_at := now();

  -- Same fields as isStudentProfileComplete() in src/lib/studentProfile.js.
  complete :=
        nullif(btrim(coalesce(new.full_name, '')), '')  is not null
    and new.gender is not null
    and nullif(btrim(coalesce(new.student_id, '')), '') is not null
    and new.age is not null
    and nullif(btrim(coalesce(new.programme, '')), '')  is not null
    and nullif(btrim(coalesce(new.phone, '')), '')      is not null
    and new.semester is not null
    and new.in_hostel is not null;

  -- Unpaid balance that is past its due date (or marked overdue by Finance).
  if tg_op = 'UPDATE' then
    select coalesce(sum(greatest(p.amount - coalesce(p.amount_paid, 0), 0)), 0)
      into overdue
      from public.payments p
     where p.student_id = new.id
       and coalesce(p.status, '') <> 'paid'
       and p.amount - coalesce(p.amount_paid, 0) > 0
       and (p.status = 'overdue' or (p.due_date is not null and p.due_date < current_date));
  end if;

  if new.finance_status = 'rejected' then
    new.eligibility_reason := 'Finance could not verify your account.';
    if not new.eligibility_override then new.eligibility_status := 'not_eligible'; end if;
  elsif overdue > 0 then
    new.eligibility_reason := format('Overdue hostel payment of RM %s.', to_char(overdue, 'FM999990.00'));
    if not new.eligibility_override then new.eligibility_status := 'not_eligible'; end if;
  elsif not complete then
    new.eligibility_reason := 'Your profile is not complete yet.';
    if not new.eligibility_override then new.eligibility_status := 'pending'; end if;
  elsif coalesce(new.finance_status, 'pending') <> 'verified' then
    new.eligibility_reason := 'Waiting for Finance to verify your account.';
    if not new.eligibility_override then new.eligibility_status := 'pending'; end if;
  else
    new.eligibility_reason := 'Profile complete, verified by Finance, no overdue payments.';
    if not new.eligibility_override then new.eligibility_status := 'eligible'; end if;
  end if;

  return new;
end;
$$;

-- BEFORE triggers run in name order: guard first, then the rule.
drop trigger if exists trg_eligibility_1_guard on public.profiles;
create trigger trg_eligibility_1_guard
  before insert or update on public.profiles
  for each row execute function public.guard_eligibility();

drop trigger if exists trg_eligibility_2_compute on public.profiles;
create trigger trg_eligibility_2_compute
  before insert or update on public.profiles
  for each row execute function public.compute_eligibility();

-- 5. Re-check a student when their payments change ------------------------
create or replace function public.recheck_eligibility_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set eligibility_checked_at = now()
   where id in (
     select (coalesce(to_jsonb(new), '{}'::jsonb)->>'student_id')::uuid
     union
     select (coalesce(to_jsonb(old), '{}'::jsonb)->>'student_id')::uuid
   );
  return null;
end;
$$;

drop trigger if exists trg_payments_recheck_eligibility on public.payments;
create trigger trg_payments_recheck_eligibility
  after insert or update or delete on public.payments
  for each row execute function public.recheck_eligibility_from_payment();

-- 6. Daily re-check (a payment can go overdue just because a day passed).
-- The dashboards call this when they open; it only touches students not
-- already checked today, so it costs nothing on repeat visits.
create or replace function public.refresh_eligibility()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_warden() or public.is_finance() then
    update public.profiles set eligibility_checked_at = now()
     where role = 'student'
       and (eligibility_checked_at is null or eligibility_checked_at < current_date);
  else
    update public.profiles set eligibility_checked_at = now()
     where id = auth.uid()
       and (eligibility_checked_at is null or eligibility_checked_at < current_date);
  end if;
end;
$$;

revoke all on function public.refresh_eligibility() from public, anon;
grant execute on function public.refresh_eligibility() to authenticated;

-- 7. Not-eligible students can't request a room --------------------------
create or replace function public.is_booking_eligible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and finance_status = 'verified'
       and coalesce(eligibility_status, 'pending') <> 'not_eligible'
  );
$$;

grant execute on function public.is_booking_eligible() to authenticated;

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert with check (
    student_id = auth.uid()
    and status = 'pending'
    and public.is_booking_eligible()
  );

-- 8. Re-check every student now ------------------------------------------
-- An existing override with no reason gets a placeholder so it stays valid.
update public.profiles
   set eligibility_note = 'Set before override reasons were required.'
 where eligibility_override
   and nullif(btrim(coalesce(eligibility_note, '')), '') is null;

update public.profiles set eligibility_checked_at = now() where role = 'student';
