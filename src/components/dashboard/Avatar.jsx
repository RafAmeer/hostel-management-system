// Round profile picture, falling back to the person's initial when they
// haven't uploaded one (same look the Home profile panel used before).
function Avatar({ url, name, size = 76 }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.4 };

  return url ? (
    <img className="avatar-img" src={url} alt="" style={style} />
  ) : (
    <div className="avatar-fallback" style={style} aria-hidden="true">
      {initial}
    </div>
  );
}

export default Avatar;
