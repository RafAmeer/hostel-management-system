import { useState } from "react";
import { LogoutIcon, NAV_ICONS } from "./icons.jsx";
import Avatar from "./Avatar.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

// navItems is passed in by each dashboard (Student/Warden) instead of being
// hardcoded here, so this one Sidebar works for both roles. Each item can
// optionally carry an `icon` key (see icons.jsx) — items without one just
// fall back to a plain dot so older callers (e.g. WardenDashboard) still work.
// The sidebar starts open (icons + labels) on every dashboard. Only on very
// narrow screens does it start as the icon rail, so it doesn't cover the page.
const NARROW_SCREEN_PX = 720;

function Sidebar({ navItems, activeTab, onSelect, userName, roleLabel, avatarUrl, onLogout }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN_PX
  );

  return (
    <aside className={"sidebar" + (collapsed ? "" : " sidebar--expanded")}>
      {/* Who is signed in, e.g. "Hostel Resident / Ash". The logo that used
          to sit here (a white disc) was removed. */}
      <div className="sidebar__who">
        <Avatar url={avatarUrl} name={userName} size={collapsed ? 40 : 44} />
        {!collapsed && (
          <div className="sidebar__who-text">
            {roleLabel && <p className="sidebar__role">{roleLabel}</p>}
            <p className="sidebar__name" title={userName}>
              {userName}
            </p>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={"sidebar__link" + (isActive ? " sidebar__link--active" : "")}
              onClick={() => onSelect(item.key)}
              title={item.label}
            >
              <span className="sidebar__icon">
                {Icon ? <Icon /> : <span className="sidebar__dot" />}
              </span>
              {!collapsed && <span className="sidebar__label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <ThemeToggle />

        <button
          type="button"
          className="sidebar__link sidebar__logout"
          onClick={onLogout}
          title="Log out"
        >
          <span className="sidebar__icon">
            <LogoutIcon />
          </span>
          {!collapsed && <span className="sidebar__label">Log out</span>}
        </button>
      </div>

      <button
        type="button"
        className="sidebar__toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "Open" : "Close"}
      </button>
    </aside>
  );
}

export default Sidebar;
