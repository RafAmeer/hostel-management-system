import { useEffect, useState } from "react";

// Thumbnail of the photo a student attached to a complaint
// (complaints.photo_url, uploaded to the "complaint-photos" bucket).
// Tapping it opens the full image. Renders nothing when there's no photo.
// Proposal, Technician Module: "view maintenance request details, including
// category, description, location and uploaded photos".
function ComplaintPhoto({ url, label = "Complaint photo" }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!url) return null;
  if (broken) return <p className="list-row__meta">Photo attached, but it couldn't be loaded.</p>;

  return (
    <>
      <button
        type="button"
        className="complaint-photo"
        onClick={() => setOpen(true)}
        aria-label={`View ${label.toLowerCase()} full size`}
      >
        <img src={url} alt={label} loading="lazy" onError={() => setBroken(true)} />
        <span className="complaint-photo__hint">View photo</span>
      </button>

      {open && (
        <div className="complaint-photo__overlay" role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}>
          <img src={url} alt={label} onClick={(e) => e.stopPropagation()} />
          <div className="complaint-photo__bar" onClick={(e) => e.stopPropagation()}>
            <a href={url} target="_blank" rel="noreferrer">Open original</a>
            <button type="button" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default ComplaintPhoto;
