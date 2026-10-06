import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import LikeBurst from "../LikeBurst";

const CATEGORIES = ["Plumbing", "Electrical", "Furniture", "Cleanliness", "Other"];

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function statusTone(status) {
  if (status === "completed") return "ok";
  if (status === "in_progress") return "warn";
  return "neutral";
}

// Submit form (category + description + optional photo, per the proposal's
// Student Module scope) on top, the student's own complaint history below.
// Photo upload assumes a "complaint-photos" Storage bucket — if it doesn't
// exist yet the complaint still submits, just without a photo attached.
function ComplaintsTab({ complaints, studentId, residences = [], defaultRoomNumber = "", onComplaintCreated }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [hostelId, setHostelId] = useState(residences[0]?.id ?? "");
  const [roomNumber, setRoomNumber] = useState(defaultRoomNumber ?? "");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [likeShow, setLikeShow] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setMessage("");

    let photo_url = null;
    if (photo) {
      const path = `${studentId}/${Date.now()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-photos")
        .upload(path, photo);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("complaint-photos")
          .getPublicUrl(path);
        photo_url = publicUrlData?.publicUrl ?? null;
      }
    }

    const hostelName = residences.find((r) => r.id === hostelId)?.name ?? null;

    const { error } = await supabase.from("complaints").insert({
      student_id: studentId,
      category,
      hostel: hostelName,
      room_number: roomNumber.trim() || null,
      description: description.trim(),
      photo_url,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      setMessage(`Couldn't submit complaint: ${error.message}`);
      return;
    }

    setDescription("");
    setPhoto(null);
    setMessage("Complaint submitted.");
    setLikeShow(true);
    onComplaintCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Complaint</h2>

      <form className="panel-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Hostel</span>
          <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} required>
            {residences.length === 0 && <option value="">No hostels available</option>}
            {residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Room number</span>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="e.g. MC-G01"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            rows={3}
            placeholder="Describe the issue…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Photo (optional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>

        {message && <p className="tab__message">{message}</p>}

        <button
          type="submit"
          className="primary-btn primary-btn--wide"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit Complaint"}
        </button>
      </form>

      <LikeBurst show={likeShow} label="Complaint submitted!" onDone={() => setLikeShow(false)} />

      <h3 className="panel-heading panel-heading--sub">Your Complaints</h3>
      {complaints.length === 0 ? (
        <p className="tab__empty">No complaints submitted yet.</p>
      ) : (
        <div className="list">
          {complaints.map((c) => (
            <div key={c.id} className="list-row">
              <div>
                <p className="list-row__title">{c.category}</p>
                <p className="list-row__meta">
                  {[c.hostel, c.room_number].filter(Boolean).join(" · ")}
                  {(c.hostel || c.room_number) && " — "}
                  {c.description}
                </p>
              </div>
              <span className={"badge badge--" + statusTone(c.status)}>
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ComplaintsTab;
