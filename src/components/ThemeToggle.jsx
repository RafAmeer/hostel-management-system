import { useTheme } from "../hooks/useTheme";
import { SunIcon, MoonIcon } from "./dashboard/icons";

// Switches the signed-in screens between white mode and black mode.
function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className={"theme-toggle " + className}
      onClick={toggle}
      aria-label={isLight ? "Switch to black mode" : "Switch to white mode"}
      title={isLight ? "Black mode" : "White mode"}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="theme-toggle__label">{isLight ? "Black mode" : "White mode"}</span>
    </button>
  );
}

export default ThemeToggle;
