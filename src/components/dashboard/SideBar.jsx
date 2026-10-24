import { useState } from "react";
import { LogoutIcon, UserIcon, NAV_ICONS } from "./icons.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

// navItems is passed in by each dashboard (Student/Warden) instead of being
// hardcoded here, so this one Sidebar works for both roles. Each item can
// optionally carry an `icon` key (see icons.jsx) — items without one just
// fall back to a plain dot so older callers (e.g. WardenDashboard) still work.
// The sidebar starts open (icons + labels) on every dashboard. Only on very
// narrow screens does it start as the icon rail, so it doesn't cover the page.
const NARROW_SCREEN_PX = 720;

// `brand` (optional) shows a small logo + product name at the top — only the
// warden dashboard passes it, so the other dashboards are unchanged.
function Sidebar({ navItems, activeTab, onSelect, userName, roleLabel, avatarUrl, onLogout, onProfile, brand }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN_PX
  );

  const profileActive = activeTab === "profile";
  const openProfile = () => (onProfile ? onProfile() : onSelect("profile"));

  // The signed-in person's name is the way into Profile settings (there is
  // no separate Profile tab). Shows their photo if they uploaded one — no
  // placeholder circle otherwise.
  const photo = (size) => (
    <img className="avatar-img" src={avatarUrl} alt="" style={{ width: size, height: size }} />
  );

  return (
    <>
      {/* Phone layout: a slim top bar (name -> profile, theme, log out); the
          tabs sit in a bottom bar. Hidden on larger screens. */}
      <header className="mobile-topbar">
        <button
          type="button"
          className={"mobile-topbar__user" + (profileActive ? " mobile-topbar__user--active" : "")}
          onClick={openProfile}
          aria-label="Open profile settings"
        >
          {avatarUrl ? photo(28) : <UserIcon aria-hidden="true" />}
          <span className="mobile-topbar__name">{userName}</span>
        </button>
        <div className="mobile-topbar__actions">
          <ThemeToggle />
          <button type="button" className="theme-toggle mobile-topbar__logout" onClick={onLogout} aria-label="Log out">
            <span className="theme-toggle__icon" aria-hidden="true">
              <LogoutIcon />
            </span>
          </button>
        </div>
      </header>

    <aside className={"sidebar" + (collapsed ? "" : " sidebar--expanded")}>
      {brand && (
        <div className="sidebar__brand-row">
          <img className="sidebar__brand-logo" src="/logo.png" alt="" />
          <span className="sidebar__brand-name">{brand}</span>
        </div>
      )}
      <button
        type="button"
        className={"sidebar__who" + (profileActive ? " sidebar__who--active" : "")}
        onClick={openProfile}
        title="Profile settings"
        aria-label="Open profile settings"
      >
        {collapsed ? (
          avatarUrl ? photo(36) : <UserIcon aria-hidden="true" />
        ) : (
          <div className="sidebar__who-text">
            {roleLabel && <p className="sidebar__role">{roleLabel}</p>}
            <p className="sidebar__name" title={userName}>
              {userName}
            </p>
            <p className="sidebar__who-hint">Profile settings</p>
          </div>
        )}
      </button>

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
              <span className="sidebar__label">{item.label}</span>
              {item.badge > 0 && (
                <span className="sidebar__badge" aria-label={`${item.badge} waiting`}>
                  {item.badge}
                </span>
              )}
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
          <span className="sidebar__label">Log out</span>
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
    </>
  );
}

export default Sidebar;
