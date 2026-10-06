import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ThumbsUpIcon } from "./dashboard/icons";

// "Like" success animation: a thumbs-up pops in with expanding rings and a
// ring of sparks, then fades away on its own. Used after a complaint is
// submitted and after a room is booked. With reduced-motion turned on the
// motion is removed and only the static thumbs-up and label show.
const SPARKS = Array.from({ length: 10 }, (_, i) => i);

function LikeBurst({ show, label, onDone, duration = 2000 }) {
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!show) return undefined;
    const t = setTimeout(() => doneRef.current?.(), duration);
    return () => clearTimeout(t);
  }, [show, duration]);

  if (!show) return null;

  // Portal to <body>: the tab content has a transform animation, which would
  // otherwise trap this "fixed" overlay inside the tab area.
  return createPortal(
    <div className="like-burst" role="status" aria-live="polite" onClick={() => doneRef.current?.()}>
      <div className="like-burst__stage">
        <span className="like-burst__ring" aria-hidden="true" />
        <span className="like-burst__ring like-burst__ring--late" aria-hidden="true" />
        {SPARKS.map((i) => (
          <span
            key={i}
            className="like-burst__spark"
            aria-hidden="true"
            style={{ "--angle": `${i * 36}deg`, "--delay": `${(i % 3) * 40}ms` }}
          />
        ))}
        <span className="like-burst__thumb" aria-hidden="true">
          <ThumbsUpIcon />
        </span>
      </div>
      {label && <p className="like-burst__label">{label}</p>}
    </div>,
    document.body
  );
}

export default LikeBurst;
