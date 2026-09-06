import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const CATEGORIES = ["Plumbing", "Electrical", "Furniture", "Cleanliness", "Other"];

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function ComplaintsTab({ complaints, studentId, onComplaintCreated }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    let photoUrl = null;

    if (photo) {
      const path = `${studentId}/${Date.now()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-photos")
        .upload(path, photo);

      if (uploadError) {
        setSubmitting(false);
        setMessage(`Couldn't upload photo: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage
        .from("complaint-photos")
        .getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    const { error } = await supabase.from("complaints").insert({
      student_id: studentId,
      category,
      description,
      photo_url: photoUrl,
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
    onComplaintCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Complaints</h2>

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
          <span className="field__label">Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the issue?"
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

        <button className="primary-btn" disabled={submitting || !description}>
          {submitting ? "Submitting…" : "Submit Complaint"}
        </button>
      </form>

      <h3 className="tab__subtitle">Your Reports</h3>
      <div className="list">
        {complaints.map((c) => (
          <div key={c.id} className="list-row">
            <div>
              <p className="list-row__title">{c.category}</p>
              <p className="list-row__meta">{c.description}</p>
            </div>
            <span className={"badge badge--" + statusTone(c.status)}>
              {STATUS_LABELS[c.status] ?? c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusTone(status) {
  if (status === "completed") return "ok";
  if (status === "in_progress") return "warn";
  return "neutral";
}

export default ComplaintsTab;