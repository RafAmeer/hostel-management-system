import { useEffect, useState } from "react";

// Drop your own hostel photos into /public/images and list them here.
// Landscape shots (1920x1080 or similar) work best.
const SLIDES = [
  "/images/hostel-1.jpg",
  "/images/hostel-2.jpg",
  "/images/hostel-3.jpg",
  "/images/hostel-4.jpg",
];

const SLIDE_DURATION_MS = 6000;

function HostelSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (SLIDES.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="slideshow" aria-hidden="true">
      {SLIDES.map((src, index) => (
        <div
          key={src}
          className={
            "slideshow__slide" +
            (index === activeIndex ? " slideshow__slide--active" : "")
          }
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
    </div>
  );
}

export default HostelSlideshow;
