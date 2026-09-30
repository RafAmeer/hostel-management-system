// Shared with ProfileForm (the setup/edit form) and StudentDashboard (which
// decides whether to show that form before the rest of the dashboard).
// Mirrors the rule the database uses to auto-confirm eligibility
// (supabase/migrations/2026-09-30_*.sql): a complete profile is what makes a
// student "eligible", so the two checks must stay in step.
export function isStudentProfileComplete(profile) {
  return Boolean(
    profile?.full_name?.trim() &&
      profile?.gender &&
      profile?.student_id?.trim() &&
      profile?.age &&
      profile?.programme?.trim() &&
      profile?.phone?.trim() &&
      profile?.semester &&
      typeof profile?.in_hostel === "boolean"
  );
}
