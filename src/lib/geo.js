// One-shot GPS read for the curfew scan. Rejects with an Error whose
// `code` is "denied" | "unavailable" | "timeout" | "unsupported" so the
// UI can show a specific message instead of a generic failure.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      const err = new Error("This browser can't share its location.");
      err.code = "unsupported";
      return reject(err);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (e) => {
        const map = { 1: "denied", 2: "unavailable", 3: "timeout" };
        const err = new Error(
          e.code === 1
            ? "Location access was blocked. Allow location for this site, then try again."
            : e.code === 3
            ? "Couldn't get your location in time. Move somewhere with a clearer signal and try again."
            : "Your location isn't available right now."
        );
        err.code = map[e.code] ?? "unavailable";
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}
