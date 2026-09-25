// Shared with ProfileForm (the setup/edit form) and StudentDashboard (which
// decides whether to show that form before the rest of the dashboard).
export function isStudentProfileComplete(profile) {
  return Boolean(
    profile?.full_name?.trim() &&
      profile?.gender &&
      profile?.student_id?.trim() &&
      profile?.age &&
      profile?.semester &&
      typeof profile?.in_hostel === "boolean"
  );
}
