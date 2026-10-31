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

// Finance verification of new student accounts (profiles.finance_status).
export const FINANCE_LABELS = {
  verified: "Verified",
  pending: "Awaiting Finance",
  rejected: "Not verified",
};

export function financeTone(status) {
  if (status === "verified") return "ok";
  if (status === "rejected") return "danger";
  return "warn";
}
