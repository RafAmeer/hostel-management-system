import ProfileForm from "./ProfileForm";
import BiometricCard from "./BiometricCard";
import { ELIGIBILITY_LABELS, eligibilityTone } from "../../lib/formatters";

// "Profile" page shared by Student (variant="student") and Warden
// (variant="staff"): the same editor, just a different set of fields.
function ProfileTab({ user, profile, variant, onSaved }) {
  const isStudent = variant === "student";
  const inHostel = profile?.in_hostel;
  const showHostelStatus = isStudent && typeof inHostel === "boolean";

  return (
    <div className="tab">
      {/* Title and status badges share one row so "Not in Hostel" sits at the
          top next to the heading instead of floating above the form. */}
      <div className="tab__title-row">
        <h2 className="tab__title">Profile</h2>
        {isStudent && (
          <div className="profile-badges">
            {showHostelStatus && (
              <span
                className={
                  "badge profile-status-badge " +
                  (inHostel ? "profile-status-badge--in" : "profile-status-badge--out")
                }
              >
                {inHostel ? "In Hostel" : "Not in Hostel"}
              </span>
            )}
            <span className={"badge badge--" + eligibilityTone(profile?.eligibility_status)}>
              {ELIGIBILITY_LABELS[profile?.eligibility_status] ?? "Pending"}
            </span>
          </div>
        )}
      </div>
      <section
        className={
          "glass-panel profile-card" +
          (showHostelStatus ? (inHostel ? " profile-card--in-hostel" : " profile-card--not-in-hostel") : "")
        }
      >
        <ProfileForm
          user={user}
          profile={profile}
          variant={variant}
          mode="edit"
          onSaved={onSaved}
        />
      </section>
      <BiometricCard />
    </div>
  );
}

export default ProfileTab;
