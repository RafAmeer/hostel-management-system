import { assetUrl } from "../../lib/assetUrl";
import { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import {
  NAV_ICONS,
  MoreIcon,
  ChevronRightIcon,
  LogoutIcon,
  SunIcon,
  MoonIcon,
} from "./icons.jsx";

// Phone-only app chrome, shared by every dashboard (student, warden,
// finance, technician). Hidden above 720px, where the normal sidebar shows.
//
//   ┌──────────────────────────────┐
//   │ App bar: logo / page title   │  ← title fades in once you scroll
//   │                  🔔  (avatar) │
//   ├──────────────────────────────┤
//   │           page               │
//   ├──────────────────────────────┤
//   │ Tab bar: up to 4 tabs + More │  ← like Instagram / Shopee / Grab
//   └──────────────────────────────┘
//
// Nav items marked `mobileHidden` (and anything past the first four) go into
// the "More" sheet, together with Profile, white/black mode and Log out.
const MAX_TABS = 4;

function MobileShell({ navItems, activeTab, onSelect, userName, roleLabel, avatarUrl, onLogout, onProfile, bell }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggle } = useTheme();

  const visible = navItems.filter((i) => !i.mobileHidden);
  const tabs = visible.slice(0, MAX_TABS);
  const extra = [...navItems.filter((i) => i.mobileHidden), ...visible.slice(MAX_TABS)];
  const tabKeys = new Set(tabs.map((t) => t.key));
  const moreActive = sheetOpen || !tabKeys.has(activeTab);
  const moreBadge = extra.reduce((n, i) => n + (i.badge || 0), 0);

  const current = navItems.find((i) => i.key === activeTab);
  const title = current?.label ?? (activeTab === "profile" ? "Profile" : "");

  // The small title in the app bar only appears once the page's own big
  // heading has scrolled away (the usual iPhone "large title" behaviour).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Each tab opens at the top, like switching tabs in a phone app.
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 720px)").matches) window.scrollTo(0, 0);
  }, [activeTab]);

  // While the sheet is open: Escape closes it and the page behind can't scroll.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  const pick = (key) => {
    setSheetOpen(false);
    onSelect(key);
  };

  const avatar = (size) =>
    avatarUrl ? (
      <img className="m-avatar__img" src={avatarUrl} alt="" style={{ width: size, height: size }} />
    ) : (
      <span className="m-avatar__initial" style={{ width: size, height: size }} aria-hidden="true">
        {(userName || "?").trim().charAt(0).toUpperCase()}
      </span>
    );

  return (
    <>
      <header className={"m-appbar" + (scrolled ? " m-appbar--scrolled" : "")}>
        <div className="m-appbar__lead">
          <span className="m-appbar__brand" aria-hidden={scrolled}>
            <img src={assetUrl("logo.png")} alt="" className="m-appbar__logo" />
            <span className="m-appbar__brand-name">DormSphere</span>
          </span>
          <span className="m-appbar__title" aria-hidden={!scrolled}>
            {title}
          </span>
        </div>
        <div className="m-appbar__actions">
          {bell}
          <button
            type="button"
            className={"m-avatar" + (activeTab === "profile" ? " m-avatar--active" : "")}
            onClick={onProfile}
            aria-label="Open profile settings"
          >
            {avatar(32)}
          </button>
        </div>
      </header>

      <nav className="m-tabbar" aria-label="Main">
        {tabs.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = activeTab === item.key && !sheetOpen;
          return (
            <button
              key={item.key}
              type="button"
              className={"m-tab" + (active ? " m-tab--active" : "")}
              onClick={() => pick(item.key)}
              aria-current={active ? "page" : undefined}
              aria-label={item.badge > 0 ? `${item.label}, ${item.badge} new` : item.label}
            >
              <span className="m-tab__pill">
                {Icon ? <Icon /> : <span className="sidebar__dot" />}
                {item.badge > 0 && <span className="m-tab__badge">{item.badge > 9 ? "9+" : item.badge}</span>}
              </span>
              <span className="m-tab__label">{item.shortLabel ?? item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={"m-tab" + (moreActive ? " m-tab--active" : "")}
          onClick={() => setSheetOpen((o) => !o)}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          aria-label={moreBadge > 0 ? `More, ${moreBadge} new` : "More"}
          data-more-btn
        >
          <span className="m-tab__pill">
            <MoreIcon />
            {moreBadge > 0 && <span className="m-tab__badge">{moreBadge > 9 ? "9+" : moreBadge}</span>}
          </span>
          <span className="m-tab__label">More</span>
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div className="m-sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <section className="m-sheet" role="dialog" aria-modal="true" aria-label="More">
            <span className="m-sheet__grabber" aria-hidden="true" />

            <button type="button" className="m-sheet__profile" onClick={() => pick("profile")}>
              {avatar(48)}
              <span className="m-sheet__profile-text">
                <span className="m-sheet__profile-name">{userName}</span>
                <span className="m-sheet__profile-hint">{roleLabel ? `${roleLabel} · ` : ""}View profile</span>
              </span>
              <ChevronRightIcon className="m-sheet__chev" />
            </button>

            {extra.length > 0 && (
              <ul className="m-sheet__group">
                {extra.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={"m-sheet__row" + (activeTab === item.key ? " m-sheet__row--active" : "")}
                        onClick={() => pick(item.key)}
                      >
                        <span className="m-sheet__icon">{Icon ? <Icon /> : null}</span>
                        <span className="m-sheet__label">{item.label}</span>
                        {item.badge > 0 && <span className="m-tab__badge m-tab__badge--inline">{item.badge}</span>}
                        <ChevronRightIcon className="m-sheet__chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <ul className="m-sheet__group">
              <li>
                <button type="button" className="m-sheet__row" onClick={toggle} role="switch" aria-checked={theme === "dark"}>
                  <span className="m-sheet__icon">{theme === "light" ? <MoonIcon /> : <SunIcon />}</span>
                  <span className="m-sheet__label">Dark mode</span>
                  <span className={"m-switch" + (theme === "dark" ? " m-switch--on" : "")} aria-hidden="true" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="m-sheet__row m-sheet__row--danger"
                  onClick={() => {
                    setSheetOpen(false);
                    onLogout();
                  }}
                >
                  <span className="m-sheet__icon">
                    <LogoutIcon />
                  </span>
                  <span className="m-sheet__label">Log out</span>
                </button>
              </li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}

export default MobileShell;
