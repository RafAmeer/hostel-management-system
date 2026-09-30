import { useCallback, useEffect, useRef, useState } from "react";

// Tiny toast state: `toast` is { id, type, message } or null. Call
// notify("Signed in", "success") from anywhere in the owning component.
// The matching <Toast> component renders it and calls dismiss on click.
export function useToast(duration = 3800) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const notify = useCallback(
    (message, type = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), type, message });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return { toast, notify, dismiss };
}
