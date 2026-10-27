import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import HostelDetailModal from "./HostelDetailModal";
import LikeBurst from "../LikeBurst";
import { FALLBACK_SEMESTER, activeBookingFor, nextSemester } from "../../lib/semesters";

const GENDER_LABEL = { male: "male", female: "female" };

// Pick a residence and a details popup opens with photos, the description
// and the bookable rooms (Supabase-backed), so booking never leaves this
// page. Residence photos/descriptions live in src/data/residences.js.
//
// There's no guaranteed `residence` column on `rooms` yet. If any room has
// one (see supabase/migrations/*), each hostel only lists its own rooms
// (matched on the residence id, e.g. "kts-village"); until then every
// residence shows the full room list, as before.
function roomsForResidence(rooms, residenceId) {
  const hasResidenceData = rooms.some((r) => r.residence);
  return hasResidenceData ? rooms.filter((r) => r.residence === residenceId) : rooms;
}

function RoomsTab({ rooms, residences, bookings = [], studentId, studentGender, semester, eligibility, onBookingCreated }) {
  const [openResidenceId, setOpenResidenceId] = useState(null);
  const [bookingRoomId, setBookingRoomId] = useState(null);
  const [message, setMessage] = useState("");
  const [roomGenders, setRoomGenders] = useState({});
  const [bookedRoom, setBookedRoom] = useState(null);
  const [likeShow, setLikeShow] = useState(false);

  // A student can apply to ONE hostel per semester. Once that booking is
  // approved they can still book for the NEXT semester, so the page lets
  // them choose which semester they are booking for.
  const currentSemester = semester || FALLBACK_SEMESTER;
  const upcomingSemester = nextSemester(currentSemester);
  const [bookingSemester, setBookingSemester] = useState(currentSemester);
  const liveBooking = activeBookingFor(bookings, bookingSemester);
  const liveBookingText = liveBooking
    ? `You already have a ${liveBooking.status} booking for ${bookingSemester}` +
      `${liveBooking.hostel ? ` (${liveBooking.hostel}` : ""}${liveBooking.room_number ? `${liveBooking.hostel ? ", " : " ("}room ${liveBooking.room_number}` : ""}${liveBooking.hostel || liveBooking.room_number ? ")" : ""}. ` +
      `A student can only apply to one hostel per semester.` +
      (bookingSemester === currentSemester ? ` You can still book for ${upcomingSemester}.` : "")
    : "";

  const openResidence = residences.find((r) => r.id === openResidenceId) ?? null;

  // Rooms can't mix genders — look up which gender (if any) already has an
  // approved booking in each room so we can block/label mismatches before
  // a request even goes to the warden.
  useEffect(() => {
    let cancelled = false;
    async function loadOccupantGenders() {
      const { data, error } = await supabase
        .from("bookings")
        .select("room_id, profiles!inner(gender)")
        .eq("status", "approved");
      if (cancelled || error || !data) return;
      const map = {};
      data.forEach((b) => {
        if (b.profiles?.gender) map[b.room_id] = b.profiles.gender;
      });
      setRoomGenders(map);
    }
    loadOccupantGenders();
    return () => {
      cancelled = true;
    };
  }, [rooms]);

  // Auto-dismiss the "Request sent" toast after a few seconds.
  useEffect(() => {
    if (!bookedRoom) return;
    const timer = setTimeout(() => setBookedRoom(null), 3500);
    return () => clearTimeout(timer);
  }, [bookedRoom]);

  const openDetails = (id) => {
    setMessage("");
    setOpenResidenceId(id);
  };

  // Mock/placeholder rooms (src/data/residences.js, `room.mock: true`) have
  // no real `rooms` row yet, so there's no room_id to attach the booking
  // to. We still let students request them — the request is recorded
  // against the hostel/floor/room label directly (room_id left null) so
  // the warden can see it and add the real room later. Real rows (warden-
  // added, `room.mock` falsy) keep booking against room_id as before.
  const handleBook = async (room, context = {}) => {
    if (eligibility === "not_eligible") {
      setMessage("Your eligibility is marked as not eligible, so room requests are turned off. Please contact the warden.");
      return;
    }
    if (liveBooking) {
      setMessage(liveBookingText);
      return;
    }
    const occupantGender = room.mock ? room.gender : roomGenders[room.id];
    if (occupantGender && studentGender && occupantGender !== studentGender) {
      setMessage(
        `Room ${room.room_number} already has ${GENDER_LABEL[occupantGender] ?? occupantGender} students — rooms can't mix genders.`
      );
      return;
    }

    const bookingKey = room.id ?? room.room_number;
    setBookingRoomId(bookingKey);
    setMessage("");

    const payload = room.mock
      ? {
          student_id: studentId,
          room_id: null,
          hostel: context.residence?.name ?? context.residence?.id ?? null,
          floor: context.floor?.label ?? null,
          room_number: room.room_number,
          semester: bookingSemester,
          status: "pending",
        }
      : {
          student_id: studentId,
          room_id: room.id,
          semester: bookingSemester,
          status: "pending",
        };

    const { error } = await supabase.from("bookings").insert(payload);

    setBookingRoomId(null);

    if (error) {
      // 23505 = the database's one-live-booking-per-semester rule.
      setMessage(
        error.code === "23505"
          ? `You already have a booking for ${bookingSemester}. A student can only apply to one hostel per semester.`
          : `Couldn't submit booking: ${error.message}`
      );
      return;
    }

    setMessage(`Booking request sent for room ${room.room_number} (${bookingSemester}). Track it under Status.`);
    setBookedRoom(room);
    setLikeShow(true);
    onBookingCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Room Booking</h2>

      <section className="glass-panel semester-picker" aria-label="Booking semester">
        <div>
          <p className="semester-picker__title">Booking for</p>
          <p className="list-row__meta">One hostel per semester. Book the next semester any time.</p>
        </div>
        <div className="segmented" role="group" aria-label="Choose semester">
          {[currentSemester, upcomingSemester].map((sem) => (
            <button
              key={sem}
              type="button"
              className={"segmented__btn" + (bookingSemester === sem ? " segmented__btn--active" : "")}
              aria-pressed={bookingSemester === sem}
              onClick={() => {
                setBookingSemester(sem);
                setMessage("");
              }}
            >
              {sem}
              {sem === currentSemester ? " (current)" : " (next)"}
            </button>
          ))}
        </div>
      </section>

      {liveBooking && (
        <p className="message message--info" role="status">
          {liveBookingText}
        </p>
      )}

      <h3 className="panel-heading panel-heading--sub">Pick your hostel 🏠</h3>

      <div className="residence-grid">
        {residences.map((residence) => {
          const floors = residence.floors ?? [];
          // Only this hostel's rooms: floor labels like "Ground Floor" repeat
          // across hostels, so matching on the label alone counted other
          // hostels' rooms too.
          const ownRooms = roomsForResidence(rooms, residence.id);
          const totalRooms = floors.reduce((sum, f) => {
            const real = ownRooms.filter((r) => r.floor === f.label);
            return sum + (real.length > 0 ? real.length : (f.rooms ?? []).length);
          }, 0);
          return (
            <div key={residence.id} className="glass-panel residence-card">
              <div className="residence-card__media">
                <img src={residence.cover} alt={residence.name} />
                <span className="residence-card__tag">{residence.tag}</span>
              </div>
              <h4 className="residence-card__name">{residence.name}</h4>
              <p className="residence-card__meta">
                {floors.length} floor{floors.length === 1 ? "" : "s"} · {totalRooms} room
                {totalRooms === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => openDetails(residence.id)}
                aria-haspopup="dialog"
              >
                Browse floors
              </button>
            </div>
          );
        })}
      </div>

      {openResidence && (
        <HostelDetailModal
          residence={openResidence}
          rooms={roomsForResidence(rooms, openResidence.id)}
          roomGenders={roomGenders}
          bookingRoomId={bookingRoomId}
          bookingLocked={Boolean(liveBooking)}
          message={message}
          onBook={handleBook}
          onClose={() => setOpenResidenceId(null)}
        />
      )}

      <LikeBurst show={likeShow} label="Request sent!" onDone={() => setLikeShow(false)} />

      {bookedRoom && (
        <div className="toast toast--success" role="status" onClick={() => setBookedRoom(null)}>
          Request sent ✅ — {bookedRoom.room_number}. The warden will confirm it.
        </div>
      )}
    </div>
  );
}

export default RoomsTab;
