import ProfileForm from "./ProfileForm";

// "Profile" page shared by Student (variant="student") and Warden
// (variant="staff"): the same editor, just a different set of fields.
function ProfileTab({ user, profile, variant, onSaved }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Profile</h2>
      <section className="glass-panel profile-card">
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
