import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FACILITY_ICONS = {
  "Wi-Fi": "📶",
  Laundry: "🧺",
  Parking: "🚗",
  "Study area": "📚",
  "24-hour security": "🛡️",
  "Shared kitchen": "🍳",
  "Air-conditioning": "❄️",
  "Nearby shops": "🏪",
  Lounge: "🛋️",
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Popup ("bubble") shown when a student picks a residence: photo gallery,
// description, facilities and the bookable rooms, all without leaving the
// Rooms page. Rendered through a portal so the dashboard's scroll container
// can't clip it.
function HostelDetailModal({
  residence,
  rooms,
  roomGenders = {},
  bookingRoomId,
  bookingLocked = false,
  message,
  onBook,
  onClose,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  const floors = residence.floors ?? [];
  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? null;

  // A floor's rooms come from the real Supabase `rooms` table when the
  // warden has added rows for it (rooms.floor === this floor's label,
  // rooms.residence === this hostel's id); otherwise we show the mock
  // preview rooms from src/data/residences.js so browsing still works
  // before any real inventory exists. Real rows always win.
  const realRoomsForFloor = selectedFloor
    ? rooms.filter((r) => r.floor === selectedFloor.label)
    : [];
  const floorRooms = realRoomsForFloor.length > 0 ? realRoomsForFloor : selectedFloor?.rooms ?? [];

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
                    <span aria-hidden="true">{FACILITY_ICONS[f] ?? "✅"}</span> {f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hostel-modal__rooms">
            {!selectedFloor ? (
              <>
                <h4 className="panel-heading">Select a floor</h4>
                {floors.length === 0 ? (
                  <p className="tab__empty">No floors are listed for this hostel yet.</p>
                ) : (
                  <div className="floor-grid">
                    {floors.map((floor) => {
                      const real = rooms.filter((r) => r.floor === floor.label);
                      const list = real.length > 0 ? real : floor.rooms ?? [];
                      const availableCount = list.filter(
                        (r) => (r.occupied_count ?? 0) < (r.capacity ?? 1)
                      ).length;
                      return (
                        <button
                          key={floor.id}
                          type="button"
                          className="floor-card"
                          onClick={() => setSelectedFloorId(floor.id)}
                        >
                          <span className="floor-card__label">{floor.label}</span>
                          <span className="floor-card__meta">
                            {availableCount} of {list.length} rooms available
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {residence.mapQuery && (
                  <>
                    <h4 className="panel-heading" style={{ marginTop: "1.25rem" }}>
                      Location
                    </h4>
                    <div className="hostel-modal__map">
                      <iframe
                        title={`${residence.name} location`}
                        src={`https://www.google.com/maps?q=${encodeURIComponent(residence.mapQuery)}&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="hostel-modal__rooms-header">
                  <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setSelectedFloorId(null)}>
                    ← All floors
                  </button>
                  <h4 className="panel-heading">{selectedFloor.label}</h4>
                </div>

                {message && (
                  <p className="tab__message" role="status">
                    {message}
                  </p>
                )}
                {floorRooms.length === 0 ? (
                  <p className="tab__empty">No rooms are listed on this floor yet.</p>
                ) : (
                  <div className="room-grid">
                    {floorRooms.map((room) => {
                      const key = room.id ?? room.room_number;
                      const full = (room.occupied_count ?? 0) >= (room.capacity ?? 1);
                      const gender = room.gender ?? roomGenders[room.id];
                      const isBookingThis = bookingRoomId === key;
                      return (
                        <div key={key} className="room-card room-card--modal">
                          <h5 className="room-card__number">{room.room_number}</h5>
                          <p className="room-card__meta">
                            {room.occupied_count ?? 0}/{room.capacity ?? "—"} occupied
                          </p>
                          {room.price != null && (
                            <p className="room-card__price">RM {room.price}/semester</p>
                          )}
                          {gender && (
                            <span className={"badge badge--" + (gender === "female" ? "female" : "male")}>
                              {gender === "female" ? "Female room" : "Male room"}
                            </span>
                          )}
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={full || isBookingThis || bookingLocked}
                            onClick={() => onBook(room, { residence, floor: selectedFloor })}
                          >
                            {full ? "Full" : isBookingThis ? "Requesting…" : bookingLocked ? "You have a request" : "Request booking"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default HostelDetailModal;
