-- Removes the DormSphere demo data added on 2026-10-27.
-- Run in the Supabase SQL editor when you no longer need it.
-- Demo students all have emails ending in @demo.dormsphere.test.
-- Deleting them also removes their bookings, complaints, curfew scans and
-- help requests (those tables cascade from profiles).
begin;

-- Bookings first (they point at the demo rooms).
delete from public.bookings
 where student_id in (select id from auth.users where email like '%@demo.dormsphere.test');

-- The 26 demo rooms.
delete from public.rooms where room_number in (
  'MC-G01','MC-G02','MC-G03','MC-G04','MC-G05','MC-G06',
  'MC-201','MC-202','MC-203','MC-204',
  'KV-B01','KV-B02','KV-B03','KV-B04',
  'TC-101','TC-102','TC-103','TC-104',
  'SR-G01','SR-G02','SR-G03','SR-G04',
  'DB-101','DB-102','DB-103','DB-104');

-- The 28 demo students (cascades to profiles, complaints, curfew logs, help tickets).
delete from auth.users where email like '%@demo.dormsphere.test';

commit;
