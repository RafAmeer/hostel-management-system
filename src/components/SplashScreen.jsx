import { assetUrl } from "../lib/assetUrl";
import { useEffect, useState } from "react";

// Full-screen loading animation shown when the site (or installed app)
// opens: the logo pulses inside a spinning ring while the session is
// checked, then the whole screen fades away. It sits on top of the app
// rather than replacing it, so the page underneath is already ready when
// it fades out.
function SplashScreen({ done }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setGone(true), 500); // matches the CSS fade-out
    return () => clearTimeout(t);
  }, [done]);

  if (gone) return null;

  return (
    <div className={"splash" + (done ? " splash--hide" : "")} role="status" aria-live="polite">
      <div className="splash__loader">
        <span className="splash__ring" aria-hidden="true" />
        <img src={assetUrl("logo.png")} alt="" className="splash__logo" />
      </div>
      <p className="splash__name">DormSphere</p>
      <p className="splash__hint">Loading your hostel…</p>
    </div>
  );
}

export default SplashScreen;
