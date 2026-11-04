import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/formatters";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "maintenance", label: "Maintenance" },
  { value: "payment", label: "Payment" },
  { value: "safety", label: "Safety" },
  { value: "event", label: "Event" },
];

const MAX_IMAGE_MB = 5;

// Warden: publish news & announcements (optionally with an image) that
// appear at the top of every student's Home page.
function WardenAnnouncementsTab({ announcements, onChanged, notify }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [pinned, setPinned] = useState(false);
  // Emergency posts (warden feedback: "communicate urgent information
  // directly to students") show as a red banner at the very top of student
  // Home and as a phone notification, not just another item in the feed.
  const [urgent, setUrgent] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    setError("");
    if (!f) return clearFile();
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return clearFile();
    }
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`That image is over ${MAX_IMAGE_MB} MB. Choose a smaller one.`);
      return clearFile();
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    let imageUrl = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("announcements")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setSaving(false);
        return setError(`Couldn't upload the image: ${uploadError.message}`);
      }
      imageUrl = supabase.storage.from("announcements").getPublicUrl(path).data.publicUrl;
    }

    if (urgent && !window.confirm("Send this as an EMERGENCY announcement? Every student will see a red alert and a phone notification.")) {
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      category,
      pinned: pinned || urgent,
      priority: urgent ? "urgent" : "normal",
      image_url: imageUrl,
    });

    setSaving(false);
    if (insertError) {
      return setError(`Couldn't publish: ${insertError.message}`);
    }

    setTitle("");
    setBody("");
    setCategory("general");
    setPinned(false);
    setUrgent(false);
    clearFile();
    notify?.(
      urgent ? "Emergency announcement sent. Students will see a red alert." : "Announcement published. Students will see it on Home.",
      "success"
    );
    onChanged?.();
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    const { error: deleteError } = await supabase.from("announcements").delete().eq("id", a.id);
    if (deleteError) {
      return notify?.(`Couldn't delete: ${deleteError.message}`, "error");
    }
    notify?.("Announcement deleted.", "success");
    onChanged?.();
  };

  const handleTogglePin = async (a) => {
    const { error: pinError } = await supabase
      .from("announcements")
      .update({ pinned: !a.pinned })
      .eq("id", a.id);
    if (pinError) return notify?.(`Couldn't update: ${pinError.message}`, "error");
    onChanged?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">News &amp; Announcements</h2>
      <p className="tab__subtitle-text">
        Posts appear at the top of every student's Home page. Pinned posts stay first.
      </p>

      <form className="glass-panel announce-form" onSubmit={handlePublish}>
        <h3 className="panel-heading">New announcement</h3>

        {error && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="field__label">Title</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder="e.g. Water supply interruption on Saturday"
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Message</span>
          <textarea
            rows={4}
            value={body}
            placeholder="Write the details students need to know."
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>

        <div className="announce-form__row">
          <label className="field">
            <span className="field__label">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="remember announce-form__pin">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            <span>Pin to top</span>
          </label>

          <label className="remember announce-form__pin announce-form__urgent">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            <span>🚨 Emergency / urgent</span>
          </label>
        </div>
        {urgent && (
          <p className="message message--error" role="status">
            Emergency posts appear as a red alert at the top of every student's Home page and send a phone
            notification. Use it for urgent safety or service information only.
          </p>
        )}

        <div className="field">
          <span className="field__label">Image (optional)</span>
          <input ref={fileInput} type="file" accept="image/*" onChange={pickFile} />
          {preview && (
            <div className="announce-form__preview">
              <img src={preview} alt="Selected announcement" />
              <button type="button" className="link-btn" onClick={clearFile}>
                Remove image
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="primary-btn primary-btn--wide"
          disabled={saving || !title.trim() || !body.trim()}
        >
          {saving ? "Publishing…" : urgent ? "Send emergency announcement" : "Publish announcement"}
        </button>
      </form>

      <h3 className="panel-heading panel-heading--sub">Published</h3>
      {announcements.length === 0 ? (
        <p className="tab__empty">Nothing published yet.</p>
      ) : (
        <div className="list">
          {announcements.map((a) => (
            <div key={a.id} className="list-row announce-row">
              {a.image_url && <img className="announce-row__thumb" src={a.image_url} alt="" />}
              <div className="announce-row__main">
                <p className="list-row__title">
                  {a.priority === "urgent" && <span className="announcement__urgent">Emergency</span>}
                  {a.pinned && a.priority !== "urgent" && <span className="announcement__pin">Pinned</span>}
                  {a.title}
                </p>
                <p className="list-row__meta">
                  {a.category ?? "general"} &middot; {formatDateTime(a.created_at)}
                </p>
              </div>
              <div className="list-row__actions">
                <button type="button" className="btn-sm primary-btn" onClick={() => handleTogglePin(a)}>
                  {a.pinned ? "Unpin" : "Pin"}
                </button>
                <button type="button" className="btn-sm btn-outline" onClick={() => handleDelete(a)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WardenAnnouncementsTab;
