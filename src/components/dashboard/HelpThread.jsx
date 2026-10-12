import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/formatters";

export const HELP_STATUS_LABELS = { open: "Waiting", answered: "Answered", resolved: "Resolved" };
export const helpTone = (status) => (status === "resolved" ? "ok" : status === "answered" ? "neutral" : "warn");

// One support conversation, shared by the student Help tab and the warden
// Help Center. Sender role is decided by the database (trigger), so a
// student can't pose as the warden.
function HelpThread({ ticket, viewerRole, studentName, onBack, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = async () => {
    const { data, error: loadError } = await supabase
      .from("help_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (loadError) setError(loadError.message);
    else {
      setError("");
      setMessages(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Light polling so a reply shows up without leaving the thread.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("help_messages").insert({ ticket_id: ticket.id, body });
    setSending(false);
    if (insertError) {
      setError(`Couldn't send: ${insertError.message}`);
      return;
    }
    setText("");
    await load();
    onChanged?.();
  };

  const resolve = async () => {
    const { error: updateError } = await supabase
      .from("help_tickets")
      .update({ status: "resolved" })
      .eq("id", ticket.id);
    if (updateError) {
      setError(`Couldn't update: ${updateError.message}`);
      return;
    }
    onChanged?.();
  };

  const mineRole = viewerRole;

  return (
    <div className="tab">
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back to all requests
      </button>
      <div className="tab__title-row">
        <h2 className="tab__title">{ticket.subject}</h2>
        <span className={"badge badge--" + helpTone(ticket.status)}>{HELP_STATUS_LABELS[ticket.status] ?? ticket.status}</span>
      </div>
      <p className="list-row__meta">
        {ticket.category}
        {viewerRole === "warden" && studentName ? ` · from ${studentName}` : ""} · opened {formatDateTime(ticket.created_at)}
      </p>

      <section className="glass-panel help-thread" aria-live="polite">
        {loading ? (
          <p className="tab__empty">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="tab__empty">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={"help-msg" + (m.sender_role === mineRole ? " help-msg--mine" : "")}>
              <p className="help-msg__who">
                {m.sender_role === "warden" ? "Warden" : viewerRole === "student" ? "You" : studentName || "Student"}{" "}
                · {formatDateTime(m.created_at)}
              </p>
              <p className="help-msg__body">{m.body}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </section>

      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}

      <form className="help-reply" onSubmit={send}>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ticket.status === "resolved" ? "Reply to reopen this request…" : "Write a reply…"}
          aria-label="Your reply"
        />
        <div className="list-row__actions">
          <button type="submit" className="primary-btn btn-sm" disabled={sending || !text.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
          {ticket.status !== "resolved" && (
            <button type="button" className="btn-outline btn-outline--neutral" onClick={resolve}>
              Mark resolved
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default HelpThread;
