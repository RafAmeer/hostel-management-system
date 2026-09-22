// Turns "/images/hostel-1.jpg" into a URL that respects Vite's `base`
// setting (vite.config.js sets base to "/hostel-management-system").
//
// A bare "/images/..." path only works on the dev server. Once the app is
// deployed under a sub-path (e.g. GitHub Pages) the browser asks for
// "/images/..." at the site root and every photo 404s. Going through
// import.meta.env.BASE_URL keeps it working in both places.
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${String(path).replace(/^\//, "")}`;
}
