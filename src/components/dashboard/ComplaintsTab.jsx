import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import LikeBurst from "../LikeBurst";
import ClearHistoryButton from "./ClearHistoryButton";
import { useClearedHistory } from "../../lib/clearedHistory";
import ComplaintPhoto from "./ComplaintPhoto";

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
  // "Urgent" = a safety risk or no water/electricity. Wardens get an
  // urgent-maintenance alert for these (warden feedback).
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [likeShow, setLikeShow] = useState(false);
  // Changing the key remounts the file input so it clears after submitting.
  const [fileInputKey, setFileInputKey] = useState(0);
  const history = useClearedHistory("complaints", studentId);
  // Only finished complaints can be cleared; open ones always stay visible.
  const { shown: visibleComplaints, hidden: hiddenComplaints, clearable } = history.view(
    complaints,
    (c) => c.status === "completed"
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setMessage("");

    let photo_url = null;
    let photoFailed = false;
    if (photo) {
      // Spaces/brackets in a phone photo's name can make the upload fail.
      const safeName = photo.name.replace(/[^\w.-]+/g, "_");
      const path = `${studentId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-photos")
        .upload(path, photo);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("complaint-photos")
          .getPublicUrl(path);
        photo_url = publicUrlData?.publicUrl ?? null;
      } else {
        photoFailed = true;
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
      priority: urgent ? "urgent" : "normal",
    });

    setSubmitting(false);

    if (error) {
      setMessage(`Couldn't submit complaint: ${error.message}`);
      return;
    }

    setDescription("");
    setUrgent(false);
    setPhoto(null);
    setFileInputKey((k) => k + 1);
    setMessage(
      photoFailed
        ? "Complaint submitted, but the photo couldn't be uploaded."
        : "Complaint submitted."
    );
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

        <label className="remember complaint-urgent">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span>
            <strong>Urgent</strong> — safety risk, no water or no electricity
          </span>
        </label>

        <label className="field">
          <span className="field__label">Photo (optional)</span>
          <input
            key={fileInputKey}
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
      <ClearHistoryButton
        canClear={clearable.length > 0}
        hidden={hiddenComplaints}
        showAll={history.showAll}
        onClear={() => history.clear(clearable)}
        onToggleShowAll={history.toggleShowAll}
        note="Clears completed complaints from this list. Pending and in-progress ones stay."
      />
      {visibleComplaints.length === 0 ? (
        <p className="tab__empty">{complaints.length === 0 ? "No complaints submitted yet." : "History cleared."}</p>
      ) : (
        <div className="list">
          {visibleComplaints.map((c) => (
            <div key={c.id} className="list-row">
              <div>
                <p className="list-row__title">{c.category}</p>
                <p className="list-row__meta">
                  {[c.hostel, c.room_number].filter(Boolean).join(" · ")}
                  {(c.hostel || c.room_number) && " — "}
                  {c.description}
                </p>
                {Array.isArray(c.remarks) && c.remarks.length > 0 && (
                  <p className="list-row__meta">Technician update: {c.remarks[c.remarks.length - 1]}</p>
                )}
                <ComplaintPhoto url={c.photo_url} label="Your photo" />
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
