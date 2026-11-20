import { useEffect, useState } from "react";

// Student feedback: "easy to use without any guidance" and "I could find
// what I needed quickly" were the lowest-scoring statements, and one tester
// asked for easier navigation. This is a short first-visit walkthrough of
// where things are. It shows once per account on each device, can be
// skipped, and can be replayed from Profile ("Show the quick tour").
const doneKey = (userId) => `dormsphere_tour_done_${userId}`;

export const SHOW_TOUR_EVENT = "dormsphere:show-tour";
export const TOUR_DONE_EVENT = "dormsphere:tour-done";

const STEPS = [
  {
    emoji: "👋",
    title: (name) => `Welcome, ${name}!`,
    text: "Here's a quick look at where everything is. It takes about 30 seconds.",
  },
  {
    emoji: "🛏️",
    tab: "rooms",
    title: () => "Book a room",
    text: "Open Rooms, pick a hostel, then a floor, then a room. After you send a request, follow it under Booking status on Home — you'll get a notification when the warden decides.",
  },
  {
    emoji: "🛠️",
    tab: "complaints",
    title: () => "Report a problem",
    text: "Something broken? Open Complaint, describe it and attach a photo. You can see when a technician is assigned and when it's fixed.",
  },
  {
    emoji: "🌙",
    tab: "curfew",
    title: () => "Curfew check-in and check-out",
    text: "Scan the QR poster at your hostel entrance with this phone when you leave and when you come back. Your scans are listed under Curfew.",
  },
  {
    emoji: "💬",
    tab: "help",
    title: () => "Need anything else?",
    text: "From Home you can message the warden in the Help Center and see today's transport timetable. The bell shows your notifications, and tapping your name opens your Profile.",
  },
];

function WelcomeTour({ userId, firstName = "there", onNavigate }) {
  // Open on the first visit on this device for this account.
  const [open, setOpen] = useState(() => {
    if (!userId) return false;
    try {
      return !window.localStorage.getItem(doneKey(userId));
    } catch {
      return false; // storage blocked: skip rather than show it every time
    }
  });
  const [step, setStep] = useState(0);

  // "Show the quick tour" in Profile.
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(SHOW_TOUR_EVENT, replay);
    return () => window.removeEventListener(SHOW_TOUR_EVENT, replay);
  }, []);

  if (!open) return null;

  const close = () => {
    try {
      window.localStorage.setItem(doneKey(userId), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onNavigate?.("overview");
    window.dispatchEvent(new Event(TOUR_DONE_EVENT));
  };

  // Each step switches to the page it talks about, so the student sees the
  // real screen behind the card while reading.
  const go = (next) => {
    setStep(next);
    onNavigate?.(STEPS[next].tab ?? "overview");
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="timeout-backdrop welcome-tour"
      data-welcome-tour
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="timeout-modal welcome-tour__card">
        <span className="welcome-tour__emoji" aria-hidden="true">
          {current.emoji}
        </span>
        <h2 id="tour-title" className="timeout-modal__title">
          {current.title(firstName)}
        </h2>
        <p className="timeout-modal__text">{current.text}</p>
        <div className="welcome-tour__dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s.emoji} className={"welcome-tour__dot" + (i === step ? " welcome-tour__dot--on" : "")} />
          ))}
        </div>
        <div className="timeout-modal__actions">
          <button type="button" className="primary-btn" onClick={isLast ? close : () => go(step + 1)} autoFocus>
            {isLast ? "Got it" : step === 0 ? "Show me" : "Next"}
          </button>
          {step > 0 && (
            <button type="button" className="link-btn" onClick={() => go(step - 1)}>
              Back
            </button>
          )}
          {!isLast && (
            <button type="button" className="link-btn" onClick={close}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WelcomeTour;
