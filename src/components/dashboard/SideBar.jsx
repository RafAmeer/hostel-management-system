import { useState } from "react";
import { LogoutIcon, NAV_ICONS } from "./icons.jsx";

// navItems is passed in by each dashboard (Student/Warden) instead of being
// hardcoded here, so this one Sidebar works for both roles. Each item can
// optionally carry an `icon` key (see icons.jsx) — items without one just
// fall back to a plain dot so older callers (e.g. WardenDashboard) still work.
// The sidebar starts open (icons + labels) on every dashboard. Only on very
// narrow screens does it start as the icon rail, so it doesn't cover the page.
const NARROW_SCREEN_PX = 720;

function Sidebar({ navItems, activeTab, onSelect, userName, onLogout }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN_PX
  );

  return (
    <aside className={"sidebar" + (collapsed ? "" : " sidebar--expanded")}>
      <div className="sidebar__logo-wrap">
        <div className="sidebar__logo" aria-hidden="true">N</div>
        {!collapsed && <span className="sidebar__brand">NestLink</span>}
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
        {!collapsed && <p className="sidebar__student">{userName}</p>}

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
