-- 2026-10-31  Finance verification for new student accounts
--
-- New students must be verified by a Finance staff member before they can
-- request a room. Finance sees them in Finance dashboard -> "Verify Students"
-- and marks each one Verified or Rejected (with an optional note the student
-- can read).
--
-- Safe to run more than once.

-- 1. Columns ---------------------------------------------------------------
alter table public.profiles
  add column if not exists finance_status text not null default 'pending',
  add column if not exists finance_note text,
  add column if not exists finance_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists finance_verified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_finance_status_chk') then
    alter table public.profiles
      add constraint profiles_finance_status_chk
      check (finance_status in ('pending', 'verified', 'rejected'));
  end if;
end $$;

-- Accounts that already existed before this feature keep working: they are
-- treated as already verified. Only accounts created from now on wait.
update public.profiles
   set finance_status = 'verified'   -- no timestamp: no "you're verified" notification
 where finance_status = 'pending'
   and created_at < '2026-10-31T00:00:00+08';

-- 2. Students can't verify themselves (and wardens can't either) -------------
create or replace function public.guard_finance_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL editor / service role (no auth.uid()) and Finance staff may change it.
  if auth.uid() is null or public.is_finance() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.finance_status      := 'pending';
    new.finance_note        := null;
    new.finance_verified_by := null;
    new.finance_verified_at := null;
  else
    new.finance_status      := old.finance_status;
    new.finance_note        := old.finance_note;
    new.finance_verified_by := old.finance_verified_by;
    new.finance_verified_at := old.finance_verified_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_finance_status on public.profiles;
create trigger trg_guard_finance_status
  before insert or update on public.profiles
  for each row execute function public.guard_finance_status();

-- 3. Finance can see student profiles ---------------------------------------
drop policy if exists profiles_select_finance on public.profiles;
create policy profiles_select_finance on public.profiles
  for select using (public.is_finance());

-- 4. The one way Finance changes the status -------------------------------
create or replace function public.finance_verify_student(
  p_student uuid,
  p_status  text,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_finance() then
    raise exception 'Only Finance staff can verify students' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Invalid status %', p_status using errcode = '22023';
  end if;

  update public.profiles
     set finance_status      = p_status,
         finance_note        = nullif(btrim(coalesce(p_note, '')), ''),
         finance_verified_by = case when p_status = 'pending' then null else auth.uid() end,
         finance_verified_at = case when p_status = 'pending' then null else now() end
   where id = p_student
     and role = 'student';

  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.finance_verify_student(uuid, text, text) from public, anon;
grant execute on function public.finance_verify_student(uuid, text, text) to authenticated;

-- 5. Only verified students can request a room ---------------------------
create or replace function public.is_finance_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and finance_status = 'verified'
  );
$$;

grant execute on function public.is_finance_verified() to authenticated;

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert with check (
    student_id = auth.uid()
    and status = 'pending'
    and public.is_finance_verified()
  );
