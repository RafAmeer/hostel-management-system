-- 2026-11-09  Fix Supabase security advisor ERROR "Security Definer View"
--
-- public.transport_route_load (seat-request counts per route) is left over
-- from the old transport seat-booking design; the app now uses the fixed
-- transport_schedule timetable and no longer reads this view. It ran with
-- its creator's rights, bypassing RLS on transport_requests. Make it respect
-- the caller's RLS instead, and stop signed-out (anon) access.
--
-- Already applied to the live project. Safe to run more than once.

alter view public.transport_route_load set (security_invoker = true);
revoke all on public.transport_route_load from anon;
revoke insert, update, delete, truncate, references, trigger on public.transport_route_load from authenticated;
