import { ShieldIcon } from "./icons";

// Student feedback: "I feel my account and personal data are secure" was one
// of the lowest-scoring statements (two testers were Neutral). The
// protections already existed but nothing in the app said so. Every line
// here describes something DormSphere really does — keep it that way if the
// rules change (database access rules: supabase/migrations; session
// handling: src/App.jsx and src/lib/supabaseClient.js).
function PrivacyCard({ variant = "student" }) {
  const isStudent = variant === "student";
  return (
    <section className="glass-panel privacy-card" aria-labelledby="privacy-title">
      <h3 id="privacy-title" className="panel-heading privacy-card__heading">
        <ShieldIcon aria-hidden="true" /> Your data &amp; privacy
      </h3>
      <ul className="privacy-card__list">
        {isStudent ? (
          <>
            <li>
              <strong>Who can see your details:</strong> only you, the hostel wardens and the finance office. Other
              students can't see your profile.
            </li>
            <li>
              <strong>Complaints and curfew scans:</strong> visible to you and the wardens. A technician only sees a
              complaint that was assigned to them.
            </li>
          </>
        ) : (
          <li>
            <strong>Student records:</strong> you only see the records your role needs, and important changes are
            written to the activity log.
          </li>
        )}
        <li>
          <strong>Your password:</strong> stored encrypted. Nobody at the hostel can read it — not even the warden.
        </li>
        <li>
          <strong>Fingerprint sign-in:</strong> your fingerprint never leaves this device. DormSphere only gets a
          yes/no answer from your phone.
        </li>
        <li>
          <strong>Shared or lost device:</strong> you're signed out automatically after 15 minutes without activity,
          and when you close the app.
        </li>
      </ul>
    </section>
  );
}

export default PrivacyCard;
