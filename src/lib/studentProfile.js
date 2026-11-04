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

// Age in whole years from a "YYYY-MM-DD" birthday string.
export function ageFromBirthday(iso) {
  if (!iso) return null;
  const dob = new Date(iso + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}


// Birthday + emergency contact were added after the first round of user
// testing, so older profiles may not have them yet. They don't block the
// dashboard (that rule mirrors the database's eligibility check) — Home
// just shows a reminder to fill them in.
export function missingProfileExtras(profile) {
  const missing = [];
  if (!profile?.date_of_birth) missing.push("birthday");
  if (!profile?.emergency_name || !profile?.emergency_phone) missing.push("emergency contact");
  return missing;
}
