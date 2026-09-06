const NAV_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "rooms", label: "Room Booking" },
  { key: "bookings", label: "My Bookings" },
  { key: "complaints", label: "Complaints" },
  { key: "curfew", label: "Curfew" },
];

function Sidebar({ activeTab, onSelect, studentName, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo" aria-hidden="true" />
        <span>i-CATS Hostel</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={
              "sidebar__link" +
              (activeTab === item.key ? " sidebar__link--active" : "")
            }
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p className="sidebar__student">{studentName}</p>
        <button className="sidebar__logout" onClick={onLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;