-- Help Center: make each ticket belong to one warden instead of being shared
-- by every warden account.
--   * help_tickets.warden_id = the warden the student sent it to.
--   * A warden can only read / reply to / update their own tickets.
--   * Old tickets with no owner: assigned to the warden who first replied.
--     Any still unowned stay visible to all wardens until one replies,
--     which claims it for that warden.
-- Safe to run more than once.

alter table public.help_tickets
  add column if not exists warden_id uuid references public.profiles(id) on delete set null;

create index if not exists help_tickets_warden_idx on public.help_tickets(warden_id);

-- Backfill: first warden who replied owns the ticket.
update public.help_tickets t
   set warden_id = m.sender_id
  from (
    select distinct on (ticket_id) ticket_id, sender_id
      from public.help_messages
     where sender_role = 'warden' and sender_id is not null
     order by ticket_id, created_at
  ) m
 where m.ticket_id = t.id and t.warden_id is null;

-- Can the current warden act on this ticket? (own it, or it's unclaimed)
create or replace function public.is_ticket_warden(p_ticket uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_warden() and exists (
    select 1 from public.help_tickets
     where id = p_ticket and (warden_id = auth.uid() or warden_id is null)
  );
$$;

-- Students need the list of wardens to choose who to send to, but they
-- can't read other people's profiles, so expose only name + title.
create or replace function public.list_wardens()
returns table (id uuid, full_name text, title text)
language sql stable security definer set search_path = public
as $$
  select id, full_name, title from public.profiles
   where role = 'warden'
   order by full_name nulls last;
$$;
grant execute on function public.list_wardens() to authenticated;

-- ---- help_tickets policies ----
drop policy if exists "help tickets read"   on public.help_tickets;
drop policy if exists "help tickets create" on public.help_tickets;
drop policy if exists "help tickets update" on public.help_tickets;

create policy "help tickets read" on public.help_tickets for select using (
  student_id = auth.uid()
  or (public.is_warden() and (warden_id = auth.uid() or warden_id is null))
);

-- Student creates a ticket for themselves, addressed to a real warden.
create policy "help tickets create" on public.help_tickets for insert with check (
  student_id = auth.uid()
  and (warden_id is null or exists (
    select 1 from public.profiles p where p.id = warden_id and p.role = 'warden'))
);

create policy "help tickets update" on public.help_tickets for update
  using (
    student_id = auth.uid()
    or (public.is_warden() and (warden_id = auth.uid() or warden_id is null))
  )
  with check (
    student_id = auth.uid()
    or (public.is_warden() and warden_id = auth.uid())
    or (public.is_warden() and warden_id is null)
  );

-- Stop a student from re-addressing their ticket to a different warden, and
-- a warden from handing a ticket to someone else.
create or replace function public.help_ticket_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if old.warden_id is not null and new.warden_id is distinct from old.warden_id then
    new.warden_id := old.warden_id;
  end if;
  return new;
end $$;

-- ---- help_messages policies ----
drop policy if exists "help messages read"   on public.help_messages;
drop policy if exists "help messages create" on public.help_messages;

create policy "help messages read" on public.help_messages for select using (
  public.is_ticket_warden(ticket_id)
  or exists (select 1 from public.help_tickets t
              where t.id = help_messages.ticket_id and t.student_id = auth.uid())
);

create policy "help messages create" on public.help_messages for insert with check (
  public.is_ticket_warden(ticket_id)
  or exists (select 1 from public.help_tickets t
              where t.id = help_messages.ticket_id and t.student_id = auth.uid())
);

-- A warden's first reply on an unclaimed ticket claims it.
create or replace function public.help_message_after()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.help_tickets
     set status = case when new.sender_role = 'warden' then 'answered' else 'open' end,
         warden_id = case when new.sender_role = 'warden' and warden_id is null
                          then new.sender_id else warden_id end,
         updated_at = now()
   where id = new.ticket_id;
  return new;
end $$;
