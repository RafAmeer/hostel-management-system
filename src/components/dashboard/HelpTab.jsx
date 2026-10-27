import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/formatters";
import HelpThread, { HELP_STATUS_LABELS, helpTone } from "./HelpThread";

const CATEGORIES = ["Room & booking", "Payment", "Curfew", "Transport", "Account", "Other"];

const FAQ = [
  {
    q: "How do I book a room?",
    a: "Open Rooms, choose a hostel, pick a floor and send a booking request. You can hold one live booking per semester; the warden approves it and you'll see the result under Status.",
  },
  {
    q: "How does curfew check-in work?",
    a: "Scan the QR poster at your hostel entrance with your phone. After your first login on this phone, future scans don't need a login. You must be at the hostel for a scan to count.",
  },
  {
    q: "Where is the shuttle timetable?",
    a: "Open Transport for the full week, or see today's trips on your Home screen. The warden keeps it up to date.",
  },
  {
    q: "Something in my room is broken.",
    a: "Use Complaint to report it with a photo. A technician is assigned and their progress notes appear on your complaint.",
  },
];

// Customer-service style support: a student sends a request to the warden
// and they talk it through in a thread.
function HelpTab({ tickets, studentId, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [wardens, setWardens] = useState([]);
  const [wardenId, setWardenId] = useState("");

  // Each request goes to one warden, so it only shows up in their inbox.
  useEffect(() => {
    supabase.rpc("list_wardens").then(({ data }) => {
      const list = data ?? [];
      setWardens(list);
      if (list.length === 1) setWardenId(list[0].id);
    });
  }, []);

  const wardenLabel = (w) => [w.title, w.full_name || "Warden"].filter(Boolean).join(" ");
  const wardenName = (id) => {
    const w = wardens.find((x) => x.id === id);
    return w ? wardenLabel(w) : null;
  };

  const open = tickets.find((t) => t.id === openId);
  if (open) {
    return <HelpThread ticket={open} viewerRole="student" onBack={() => setOpenId(null)} onChanged={onChanged} />;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    if (!wardenId) {
      setNotice("Choose which warden to send this to.");
      return;
    }
    setSending(true);
    setNotice("");
    const { data: ticket, error } = await supabase
      .from("help_tickets")
      .insert({ student_id: studentId, warden_id: wardenId, category, subject: subject.trim() })
      .select()
      .single();
    if (error || !ticket) {
      setSending(false);
      setNotice(`Couldn't send your request: ${error?.message ?? "unknown error"}`);
      return;
    }
    const { error: msgError } = await supabase
      .from("help_messages")
      .insert({ ticket_id: ticket.id, body: message.trim() });
    setSending(false);
    if (msgError) {
      setNotice(`Your request was created but the message failed: ${msgError.message}`);
    } else {
      setNotice(`Sent to ${wardenName(wardenId) ?? "the warden"}. Their reply will show here.`);
      setSubject("");
      setMessage("");
    }
    onChanged?.();
    setOpenId(ticket.id);
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Help Center</h2>
      <p className="tab__subtitle-text">Need something from the warden? Send a request and follow the reply here.</p>

      <form className="panel-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Send to</span>
          <select value={wardenId} onChange={(e) => setWardenId(e.target.value)} required>
            <option value="" disabled>
              {wardens.length ? "Choose a warden" : "Loading wardens…"}
            </option>
            {wardens.map((w) => (
              <option key={w.id} value={w.id}>
                {wardenLabel(w)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Topic</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Subject</span>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Short summary" required />
        </label>
        <label className="field">
          <span className="field__label">Message</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the warden what you need…" required />
        </label>
        {notice && <p className="tab__message">{notice}</p>}
        <button type="submit" className="primary-btn primary-btn--wide" disabled={sending}>
          {sending ? "Sending…" : "Send to warden"}
        </button>
      </form>

      <h3 className="panel-heading panel-heading--sub">Your requests</h3>
      {tickets.length === 0 ? (
        <p className="tab__empty">No requests yet.</p>
      ) : (
        <div className="list">
          {tickets.map((t) => (
            <button key={t.id} type="button" className="list-row list-row--button" onClick={() => setOpenId(t.id)}>
              <div>
                <p className="list-row__title">{t.subject}</p>
                <p className="list-row__meta">
                  {t.category}
                  {wardenName(t.warden_id) ? ` · to ${wardenName(t.warden_id)}` : ""} · updated {formatDateTime(t.updated_at ?? t.created_at)}
                </p>
              </div>
              <span className={"badge badge--" + helpTone(t.status)}>{HELP_STATUS_LABELS[t.status] ?? t.status}</span>
            </button>
          ))}
        </div>
      )}

      <h3 className="panel-heading panel-heading--sub">Quick answers</h3>
      <div className="faq">
        {FAQ.map((f) => (
          <details key={f.q} className="glass-panel faq__item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export default HelpTab;
