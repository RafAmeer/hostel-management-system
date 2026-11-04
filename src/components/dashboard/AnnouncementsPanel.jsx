import { useState } from "react";

const CATEGORY_TONE = {
  general: "neutral",
  maintenance: "warn",
  payment: "warn",
  safety: "danger",
  event: "ok",
};

const CATEGORY_ICON = {
  general: "📰",
  maintenance: "🛠️",
  payment: "💳",
  safety: "🚨",
  event: "🎉",
};

const COLLAPSED_COUNT = 3;

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// News / announcements feed for the student Home page. Rows come from the
// `announcements` table (pinned first, then newest). Tap an item to read it.
function AnnouncementsPanel({ announcements }) {
  const [openId, setOpenId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? announcements : announcements.slice(0, COLLAPSED_COUNT);
  const hiddenCount = announcements.length - visible.length;

  return (
    <section className="glass-panel announcements-panel" aria-labelledby="announcements-heading">
      <h3 id="announcements-heading" className="panel-heading">
        📣 News &amp; Announcements
      </h3>

      {announcements.length === 0 ? (
        <p className="notification-item notification-item--empty">
          It's quiet for now. Hostel news will pop up here.
        </p>
      ) : (
        <ul className="announcement-list">
          {visible.map((a) => {
            const isOpen = openId === a.id;
            return (
              <li key={a.id} className="announcement">
                <button
                  type="button"
                  className="announcement__head"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  aria-expanded={isOpen}
                >
                  <span className="announcement__thumb" aria-hidden="true">
                    {a.image_url ? (
                      <img src={a.image_url} alt="" />
                    ) : (
                      CATEGORY_ICON[a.category] ?? "📰"
                    )}
                  </span>
                  <span
                    className={
                      "announcement__title" +
                      (a.pinned || a.priority === "urgent" || a.category === "safety" ? " announcement__title--important" : "")
                    }
                  >
                    {a.priority === "urgent" && <span className="announcement__urgent">Emergency</span>}
                    {a.pinned && a.priority !== "urgent" && <span className="announcement__pin">Pinned</span>}
                    {a.title}
                  </span>
                  <span className="announcement__meta">
                    <span className={"badge badge--" + (CATEGORY_TONE[a.category] ?? "neutral")}>
                      {a.category ?? "general"}
                    </span>
                    <time dateTime={a.created_at}>{formatDate(a.created_at)}</time>
                  </span>
                </button>
                {isOpen && (
                  <>
                    {a.image_url && (
                      <img className="announcement__image" src={a.image_url} alt="" />
                    )}
                    <p className="announcement__body">{a.body}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {announcements.length > COLLAPSED_COUNT && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      )}
    </section>
  );
}

export default AnnouncementsPanel;
