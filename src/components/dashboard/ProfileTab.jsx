import ProfileForm from "./ProfileForm";

// "Profile" page shared by Student (variant="student") and Warden
// (variant="staff"): the same editor, just a different set of fields.
function ProfileTab({ user, profile, variant, onSaved }) {
  const isStudent = variant === "student";
  const inHostel = profile?.in_hostel;
  const showHostelStatus = isStudent && typeof inHostel === "boolean";

  return (
    <div className="tab">
      <h2 className="tab__title">Profile</h2>
      <section
        className={
          "glass-panel profile-card" +
          (showHostelStatus ? (inHostel ? " profile-card--in-hostel" : " profile-card--not-in-hostel") : "")
        }
      >
        {showHostelStatus && (
          <span className={"badge profile-status-badge " + (inHostel ? "profile-status-badge--in" : "profile-status-badge--out")}>
            {inHostel ? "In Hostel" : "Not in Hostel"}
          </span>
        )}
        <ProfileForm
          user={user}
          profile={profile}
          variant={variant}
          mode="edit"
          onSaved={onSaved}
        />
      </section>
    </div>
  );
}

export default ProfileTab;
