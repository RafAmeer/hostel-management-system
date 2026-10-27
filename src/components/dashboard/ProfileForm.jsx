import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Avatar from "./Avatar";
import { PROGRAMME_GROUPS, OTHER_PROGRAMME, isKnownProgramme } from "../../data/programmes";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// One form for both the first-time setup and the later "Edit profile" page,
// for students and for staff (warden). `variant` picks the field set:
//   "student" -> name, student ID, age, phone, programme, in-hostel + room
//   "staff"   -> name, phone (email/role shown read-only)
// `mode="setup"` hides the photo upload to keep first sign-in short.
//
// Saves with update-then-insert rather than upsert on purpose: an upsert
// needs an INSERT policy even when the row already exists, and profile rows
// are normally created by the sign-up trigger, not by the browser.
function ProfileForm({ user, profile, variant = "student", mode = "edit", onSaved }) {
  const isStudent = variant === "student";
  const isSetup = mode === "setup";

  const [title, setTitle] = useState(profile?.title ?? "");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [studentId, setStudentId] = useState(profile?.student_id ?? "");
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  // The dropdown value is either a listed programme or OTHER_PROGRAMME (then
  // `otherProgramme` holds what they typed). A saved value that isn't in
  // the list opens as "Other" so older hand-typed entries aren't lost.
  const savedProgramme = profile?.programme ?? "";
  const [programmeChoice, setProgrammeChoice] = useState(
    !savedProgramme ? "" : isKnownProgramme(savedProgramme) ? savedProgramme : OTHER_PROGRAMME
  );
  const [otherProgramme, setOtherProgramme] = useState(
    savedProgramme && !isKnownProgramme(savedProgramme) ? savedProgramme : ""
  );
  const programme = programmeChoice === OTHER_PROGRAMME ? otherProgramme.trim() : programmeChoice;
  const [semester, setSemester] = useState(profile?.semester ?? "");
  const [inHostel, setInHostel] = useState(
    typeof profile?.in_hostel === "boolean" ? profile.in_hostel : null
  );
  const [roomNumber, setRoomNumber] = useState(profile?.room_number ?? "");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The preview is a temporary blob URL: revoke the old one whenever it is
  // replaced, and the last one when the form goes away.
  const previewUrlRef = useRef(null);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setError("");
    if (file && !file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG or PNG).");
      return;
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setError("That photo is over 2 MB. Please choose a smaller one.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = file ? URL.createObjectURL(file) : null;
    setPhotoFile(file);
    setPhotoPreview(previewUrlRef.current);
  };

  const validate = () => {
    if (!isStudent && !title) return "Select a title (Mr, Ms or Mdm).";
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (isStudent) {
      if (!gender) return "Select your gender — this decides which hostel rooms you can book.";
      if (!studentId.trim()) return "Enter your student ID.";
      if (!/^\d{8,12}$/.test(studentId.trim())) return "Student ID should be numbers only, e.g. 2502040448.";
      const n = Number(age);
      if (!Number.isInteger(n) || n < 15 || n > 99) return "Enter a valid age (15–99).";
      if (!programmeChoice) return "Select your programme.";
      if (programmeChoice === OTHER_PROGRAMME && !otherProgramme.trim()) return "Type your programme name.";
      if (!phone.trim()) return "Enter your phone number.";
      if (!/^(\+?60|0)\d{8,10}$/.test(phone.replace(/[\s-]/g, "")))
        return "Enter a valid Malaysian phone number, e.g. 012-345 6789.";
      if (!semester) return "Select your current semester.";
      if (inHostel === null) return "Tell us whether you are currently staying in a hostel.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);

    const fields = { full_name: fullName.trim(), phone: phone.trim() || null };
    if (!isStudent) fields.title = title;
    if (isStudent) {
      Object.assign(fields, {
        gender,
        student_id: studentId.trim(),
        age: Number(age),
        programme: programme || null,
        semester: semester || null,
        in_hostel: inHostel,
        room_number: inHostel ? roomNumber.trim() || null : null,
      });
    }

    // Upload the photo first; if it fails the rest of the profile still saves.
    let photoWarning = "";
    if (photoFile) {
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, photoFile, { upsert: true });
      if (uploadError) {
        photoWarning = ` The photo wasn't uploaded (${uploadError.message}).`;
      } else {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        fields.avatar_url = urlData?.publicUrl ?? null;
      }
    }

    let { data, error: saveError } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", user.id)
      .select()
      .maybeSingle();

    // No profile row yet (sign-up trigger missing or not run): create it.
    if (!saveError && !data) {
      ({ data, error: saveError } = await supabase
        .from("profiles")
        .insert({ id: user.id, ...fields })
        .select()
        .single());
    }

    setSaving(false);

    if (saveError) {
      setError(`Couldn't save your profile: ${saveError.message}`);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPhotoFile(null);
    setPhotoPreview(null);
    setNotice(`Profile saved.${photoWarning}`);
    onSaved?.(data);
    // Lets the one-time fingerprint offer (BiometricPrompt) appear now that
    // a new student has finished setting up, instead of on top of the form.
    window.dispatchEvent(new Event("dormsphere:profile-saved"));
  };

  const shownAvatar = photoPreview ?? profile?.avatar_url ?? null;

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="avatar-upload">
        <Avatar url={shownAvatar} name={fullName || user?.email} size={84} />
        <div>
          <label className="btn-outline btn-outline--neutral avatar-upload__btn">
            {shownAvatar ? "Change photo" : "Upload photo (optional)"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="visually-hidden"
            />
          </label>
          <p className="avatar-upload__hint">JPG or PNG, up to 2 MB. You can skip this and add it later.</p>
        </div>
      </div>

      <div className="profile-form__grid">
        <h4 className="profile-form__section-title">About you</h4>
        {!isStudent && (
          <label className="field">
            <span className="field__label">Title</span>
            <select value={title} onChange={(e) => setTitle(e.target.value)} required>
              <option value="" disabled>
                Select title
              </option>
              <option value="Mr">Mr</option>
              <option value="Ms">Ms</option>
              <option value="Mdm">Mdm</option>
            </select>
          </label>
        )}
        <label className="field">
          <span className="field__label">Full name</span>
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ahmad bin Ismail"
            required
          />
        </label>

        {isStudent && (
          <label className="field">
            <span className="field__label">Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)} required>
              <option value="" disabled>
                Select gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        )}

        {isStudent && (
          <>
            <h4 className="profile-form__section-title">Student details</h4>
            <label className="field">
              <span className="field__label">Student ID</span>
              <input
                type="text"
                inputMode="numeric"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 2502040448"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Age</span>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Semester</span>
              <select value={semester} onChange={(e) => setSemester(e.target.value)} required>
                <option value="" disabled>
                  Select semester
                </option>
                {["S1/2026", "S2/2026", "S3/2026"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--wide">
              <span className="field__label">Programme</span>
              <select
                value={programmeChoice}
                onChange={(e) => setProgrammeChoice(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select your programme
                </option>
                {PROGRAMME_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.programmes.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_PROGRAMME}>Other (not listed)</option>
              </select>
            </label>

            {programmeChoice === OTHER_PROGRAMME && (
              <label className="field field--wide">
                <span className="field__label">Programme name</span>
                <input
                  type="text"
                  value={otherProgramme}
                  onChange={(e) => setOtherProgramme(e.target.value)}
                  placeholder="Type your programme"
                  required
                />
              </label>
            )}
          </>
        )}

        <h4 className="profile-form__section-title">Contact</h4>
        <label className="field">
          <span className="field__label">Phone</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 012-345 6789"
            required
          />
        </label>

        {!isStudent && (
          <>
            <div className="field">
              <span className="field__label">Email</span>
              <p className="field__static">{user?.email}</p>
            </div>
            <div className="field">
              <span className="field__label">Role</span>
              <p className="field__static">{profile?.role ?? "warden"}</p>
            </div>
          </>
        )}
      </div>

      {isStudent && (
        <>
          <h4 className="profile-form__section-title">Hostel status</h4>
          <fieldset className="segmented-field">
            <legend className="field__label">Are you currently staying in a hostel?</legend>
            <div className="segmented" role="group">
              {[
                { label: "Yes", value: true },
                { label: "No", value: false },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={
                    "segmented__btn" + (inHostel === opt.value ? " segmented__btn--active" : "")
                  }
                  aria-pressed={inHostel === opt.value}
                  onClick={() => setInHostel(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {inHostel === true && (
            <label className="field profile-form__room">
              <span className="field__label">Current room (optional)</span>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. A-101"
              />
            </label>
          )}
        </>
      )}

      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="message message--info" role="status">
          {notice}
        </p>
      )}

      <button type="submit" className="primary-btn profile-form__submit" disabled={saving}>
        {saving ? "Saving…" : isSetup ? "Save and continue" : "Save changes"}
      </button>
    </form>
  );
}

export default ProfileForm;
