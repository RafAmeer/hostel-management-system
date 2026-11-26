-- Complete Profile now asks students to PICK their current hostel/room from
-- dropdowns (HostelRoomPicker) instead of typing it. Stores the hostel name.
-- Already applied to the live project on 2026-11-26; safe to re-run.
alter table public.profiles add column if not exists hostel text;
comment on column public.profiles.hostel is 'Hostel the student currently stays in (residence name), picked from the Complete Profile dropdown.';
