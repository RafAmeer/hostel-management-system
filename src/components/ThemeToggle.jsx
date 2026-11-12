import { useTheme } from "../hooks/useTheme";
import { SunIcon, MoonIcon } from "./dashboard/icons";

// Switches the signed-in screens between light mode and dark mode.
function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className={"theme-toggle " + className}
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="theme-toggle__label">{isLight ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}

export default ThemeToggle;
