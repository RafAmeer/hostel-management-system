import { useEffect, useRef } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useTheme } from "../../hooks/useTheme";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

// Reads the app's current theme tokens (dashboard.css) so every chart
// follows light/dark mode instead of using fixed colours.
// Reads from the dashboard element (where the theme tokens are actually
// set) so each dashboard's own palette — e.g. the warden Console theme —
// is what the charts use.
function readTheme(el) {
  const host = el?.closest(".dashboard") ?? document.querySelector(".dashboard") ?? document.documentElement;
  const css = getComputedStyle(host);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const ink = v("--ink", "255 255 255").split(/\s+/).join(",");
  return {
    text: v("--text-primary", "#ececed"),
    muted: v("--text-muted", "#9b9fa5"),
    panel: v("--glass", "#1f2023"),
    grid: `rgba(${ink},0.12)`,
    tones: {
      accent: v("--accent", "#7cc395"),
      success: v("--success", "#8cc79f"),
      warn: v("--warn", "#e0b45c"),
      danger: v("--danger", "#ef8f86"),
      info: v("--info", "#93b8d6"),
      warm: v("--accent-warm", "#8fb6d6"),
      muted: `rgba(${ink},0.35)`,
    },
  };
}

function withAlpha(color, alpha) {
  if (color.startsWith("#") && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  return color;
}

// Datasets say which colour they want with a `tone` (or `tones` for a
// doughnut) — "accent" | "success" | "warn" | "danger" | "info" | "warm" |
// "muted" — and this component turns it into real colours for the theme.
function paint(type, data, theme) {
  return {
    ...data,
    datasets: data.datasets.map((ds) => {
      const base = { ...ds };
      if (type === "doughnut") {
        base.backgroundColor = (ds.tones ?? []).map((t) => theme.tones[t] ?? theme.tones.accent);
        base.borderColor = theme.panel;
        base.borderWidth = 2;
      } else if (type === "line") {
        const c = theme.tones[ds.tone] ?? theme.tones.accent;
        base.borderColor = c;
        base.backgroundColor = withAlpha(c, 0.14);
        base.pointBackgroundColor = c;
        base.tension = 0.3;
        base.pointRadius = 3;
        base.borderWidth = 2;
        base.fill = ds.fill ?? false;
      } else {
        base.backgroundColor = theme.tones[ds.tone] ?? theme.tones.accent;
        base.borderRadius = 4;
        base.maxBarThickness = 38;
      }
      return base;
    }),
  };
}

function buildOptions(type, theme, extra = {}) {
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450 },
    plugins: {
      legend: {
        display: extra.legend ?? type === "doughnut",
        position: type === "doughnut" ? "bottom" : "top",
        labels: { color: theme.text, boxWidth: 12, boxHeight: 12, font: { size: 11 } },
      },
      tooltip: { enabled: true },
    },
  };

  if (type === "doughnut") {
    return { ...common, cutout: "62%" };
  }

  const horizontal = extra.horizontal;
  const stacked = Boolean(extra.stacked);
  const valueAxis = {
    beginAtZero: true,
    stacked,
    ticks: { color: theme.muted, precision: 0, font: { size: 11 } },
    grid: { color: theme.grid },
  };
  const labelAxis = {
    stacked,
    ticks: { color: theme.muted, font: { size: 11 }, maxRotation: 0, autoSkip: true },
    grid: { display: false },
  };

  return {
    ...common,
    indexAxis: horizontal ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    scales: horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis },
  };
}

// Small Chart.js wrapper. `data` should be memoised by the caller so the
// chart is only rebuilt when the numbers (or the theme) actually change.
function ChartCanvas({ type, data, height = 260, ariaLabel, legend, stacked, horizontal }) {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const colours = readTheme(canvasRef.current);
    const chart = new Chart(canvasRef.current, {
      type,
      data: paint(type, data, colours),
      options: buildOptions(type, colours, { legend, stacked, horizontal }),
    });
    return () => chart.destroy();
  }, [type, data, theme, legend, stacked, horizontal]);

  return (
    <div className="chart-canvas" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}

export default ChartCanvas;
