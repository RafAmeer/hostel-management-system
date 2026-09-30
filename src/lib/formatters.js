// Small display helpers shared by student and warden screens.
export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const ELIGIBILITY_LABELS = {
  eligible: "Eligible",
  pending: "Pending",
  not_eligible: "Not eligible",
};

export function eligibilityTone(status) {
  if (status === "eligible") return "ok";
  if (status === "not_eligible") return "danger";
  return "warn";
}
