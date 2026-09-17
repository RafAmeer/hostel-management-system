import { useRef, useState } from "react";
import { askHostelAssistant } from "../../lib/aiChat";

// Suggested questions shown as tappable chips so the warden isn't stuck
// typing from a blank box — this is the "many options related to hostel"
// behaviour the supervisor asked for, instead of one fixed "Generate
// Summary" button that only ever produced the same kind of report.
const SUGGESTED_QUESTIONS = [
  "How many students are registered?",
  "How many rooms are fully occupied?",
  "How many pending bookings do we have?",
  "What's the top complaint category right now?",
  "How many students are currently outside past curfew?",
  "How do bookings compare to the previous period?",
];

function HostelChatbot({ stats }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  };

  const send = async (question) => {
    const text = question.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const answer = await askHostelAssistant(text, stats);
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: err.message ?? "Something went wrong answering that.", error: true },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="ai-summary-panel ai-chat">
      <div className="ai-summary-panel__header">
        <h3 className="chart__title">AI Assistant</h3>
      </div>

      <div className="ai-chat__chips">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="ai-chat__chip"
            onClick={() => send(q)}
            disabled={sending}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="ai-chat__messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="receipt__note receipt__note--placeholder">
            Tap a question above, or type your own — e.g. "how many complaints are still pending?"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"ai-chat__bubble ai-chat__bubble--" + m.role + (m.error ? " ai-chat__bubble--error" : "")}>
            {m.text}
          </div>
        ))}
        {sending && <div className="ai-chat__bubble ai-chat__bubble--assistant ai-chat__bubble--pending">Thinking…</div>}
      </div>

      <form className="ai-chat__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="ai-chat__input"
          placeholder="Ask about bookings, complaints, curfew, rooms…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="primary-btn" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default HostelChatbot;
