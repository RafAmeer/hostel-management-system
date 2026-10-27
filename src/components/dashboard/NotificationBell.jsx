import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellIcon } from "./icons";
import { formatDateTime } from "../../lib/formatters";

// The 🔔 button plus its dropdown list. `notif` comes from useNotifications
// (one per dashboard), so the copy in the phone top bar and the copy in the
// desktop sidebar always agree.
function NotificationBell({ notif, onNavigate, className = "" }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const { items, seen, unreadCount, markAllRead, permission, enablePhoneAlerts } = notif;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Closing the list counts as having seen everything in it.
  const close = () => {
    setOpen(false);
    markAllRead();
  };

  const go = (item) => {
    close();
    onNavigate?.(item.tab);
  };

  // The bell sits inside the sidebar / phone top bar. Those are "sticky"
  // elements, which trap anything inside them on their own layer — so the
  // page content was being drawn over the open list (it looked clipped
  // behind the page). Render the list at the dashboard's root instead, so
  // it floats above everything but still picks up the warden theme colours.
  const portalTarget =
    (typeof document !== "undefined" && (buttonRef.current?.closest(".dashboard") ?? document.body)) || null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={"theme-toggle notif-bell " + className}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <span className="theme-toggle__icon notif-bell__icon" aria-hidden="true">
          <BellIcon />
          {unreadCount > 0 && <span className="notif-bell__count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </span>
        <span className="theme-toggle__label">Notifications</span>
      </button>

      {open && portalTarget && createPortal(
        <>
          <div className="notif-backdrop" onClick={close} aria-hidden="true" />
          <section ref={panelRef} className="notif-panel" role="dialog" aria-label="Notifications">
            <header className="notif-panel__head">
              <h3 className="notif-panel__title">Notifications</h3>
              <button type="button" className="link-btn" onClick={close}>
                Close
              </button>
            </header>

            {permission === "default" && (
              <div className="notif-panel__enable">
                <p>Get an alert on your phone when something new happens.</p>
                <button type="button" className="primary-btn" onClick={enablePhoneAlerts}>
                  Turn on phone notifications
                </button>
              </div>
            )}
            {permission === "denied" && (
              <p className="notif-panel__note">
                Phone notifications are blocked. Allow them for this site in your browser settings to get alerts.
              </p>
            )}
            {permission === "unsupported" && (
              <p className="notif-panel__note">
                This browser can't show phone notifications. On iPhone, add DormSphere to your Home Screen first.
              </p>
            )}

            {items.length === 0 ? (
              <p className="notif-panel__empty">All caught up! Nothing new right now.</p>
            ) : (
              <ul className="notif-list">
                {items.slice(0, 30).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={"notif-item notif-item--" + item.tone + (seen.has(item.id) ? "" : " notif-item--unread")}
                      onClick={() => go(item)}
                    >
                      <span className="notif-item__title">{item.title}</span>
                      <span className="notif-item__body">{item.body}</span>
                      {item.at && <span className="notif-item__time">{formatDateTime(item.at)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>,
        portalTarget
      )}
    </>
  );
}

export default NotificationBell;
