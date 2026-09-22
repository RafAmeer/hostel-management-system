import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Popup ("bubble") shown when a student picks a residence: photo gallery,
// description, facilities and the bookable rooms, all without leaving the
// Rooms page. Rendered through a portal so the dashboard's scroll container
// can't clip it.
function HostelDetailModal({
  residence,
  rooms,
  bookingRoomId,
  message,
  onBook,
  onClose,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  const gallery = residence.gallery?.length
    ? residence.gallery
    : [{ src: residence.cover, caption: "Hostel building" }];
  const photo = gallery[photoIndex];

  const showPrev = () =>
    setPhotoIndex((i) => (i - 1 + gallery.length) % gallery.length);
  const showNext = () => setPhotoIndex((i) => (i + 1) % gallery.length);

  // Lock page scroll while open, put focus inside the dialog, and hand
  // focus back to whatever opened it when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowLeft" && gallery.length > 1) showPrev();
    if (e.key === "ArrowRight" && gallery.length > 1) showNext();

    // Keep Tab inside the dialog
    if (e.key === "Tab") {
      const items = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal glass-panel hostel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hostel-modal-title"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <header className="hostel-modal__header">
          <div>
            <h3 id="hostel-modal-title" className="hostel-modal__title">
              {residence.name}
            </h3>
            <span className="badge badge--neutral">{residence.tag}</span>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close hostel details"
          >
            ✕
          </button>
        </header>

        <div className="hostel-modal__body">
          <section aria-label="Photos" className="gallery">
            <div className="gallery__stage">
              <img src={photo.src} alt={`${residence.name}: ${photo.caption}`} />
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery__nav gallery__nav--prev"
                    onClick={showPrev}
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="gallery__nav gallery__nav--next"
                    onClick={showNext}
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                </>
              )}
              <span className="gallery__caption">{photo.caption}</span>
            </div>

            {gallery.length > 1 && (
              <div className="gallery__thumbs">
                {gallery.map((g, i) => (
                  <button
                    key={g.src + i}
                    type="button"
                    className={
                      "gallery__thumb" +
                      (i === photoIndex ? " gallery__thumb--active" : "")
                    }
                    onClick={() => setPhotoIndex(i)}
                    aria-label={`Show photo: ${g.caption}`}
                    aria-current={i === photoIndex}
                  >
                    <img src={g.src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="hostel-modal__about">
            <h4 className="panel-heading">About this hostel</h4>
            <p className="hostel-modal__description">{residence.description}</p>
            {residence.facilities?.length > 0 && (
              <ul className="chip-list" aria-label="Facilities">
                {residence.facilities.map((f) => (
                  <li key={f} className="chip">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hostel-modal__rooms">
            <h4 className="panel-heading">Available rooms</h4>
            {message && (
              <p className="tab__message" role="status">
                {message}
              </p>
            )}
            {rooms.length === 0 ? (
              <p className="tab__empty">No rooms are listed for this hostel yet.</p>
            ) : (
              <div className="room-grid">
                {rooms.map((room) => {
                  const full = room.occupied_count >= room.capacity;
                  return (
                    <div key={room.id} className="room-card room-card--modal">
                      <h5 className="room-card__number">{room.room_number}</h5>
                      <p className="room-card__meta">
                        {room.occupied_count}/{room.capacity} occupied
                      </p>
                      <p className="room-card__price">RM {room.price}/semester</p>
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={full || bookingRoomId === room.id}
                        onClick={() => onBook(room)}
                      >
                        {full
                          ? "Full"
                          : bookingRoomId === room.id
                          ? "Booking…"
                          : "Book this room"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default HostelDetailModal;
