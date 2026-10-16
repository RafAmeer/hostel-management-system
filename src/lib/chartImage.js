// Draws a chart off-screen with Chart.js and returns it as a PNG, so exported
// reports (PDF / Word / Excel) can contain the same graphs the dashboard
// shows. Reports are meant for paper, so charts always use a white
// background and dark text, whatever theme the app is in.
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

const TONES = {
  accent: "#1f6f94",
  success: "#2f9e6e",
  warn: "#d9a21b",
  danger: "#cf4f52",
  info: "#4f9bb8",
  warm: "#e0792f",
  muted: "#b4bcc3",
};

// White canvas behind the chart (PNG would otherwise be transparent and
// show black in some PDF/Word viewers).
const whiteBackground = {
  id: "whiteBackground",
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// Shows the value on each bar / slice so the numbers are readable on paper
// (there is no hover tooltip in a printed report).
const valueLabels = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const type = chart.config.type;
    ctx.save();
    ctx.font = "600 13px sans-serif";
    ctx.fillStyle = "#1f2a33";
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((el, i) => {
        const v = ds.data[i];
        if (!v) return;
        if (type === "doughnut") {
          const total = ds.data.reduce((a, b) => a + b, 0);
          if (!total || v / total < 0.06) return;
          const p = el.tooltipPosition();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(v), p.x, p.y);
        } else if (type === "bar") {
          const horizontal = chart.options.indexAxis === "y";
          const p = el.tooltipPosition();
          ctx.fillStyle = "#1f2a33";
          if (horizontal) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(String(v), el.x + 5, p.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(String(v), p.x, el.y - 4);
          }
        }
      });
    });
    ctx.restore();
  },
};

function paint(type, data) {
  return {
    ...data,
    datasets: data.datasets.map((ds) => {
      const base = { ...ds };
      if (type === "doughnut") {
        base.backgroundColor = (ds.tones ?? []).map((t) => TONES[t] ?? TONES.accent);
        base.borderColor = "#ffffff";
        base.borderWidth = 2;
      } else if (type === "line") {
        const c = TONES[ds.tone] ?? TONES.accent;
        base.borderColor = c;
        base.backgroundColor = c + "33";
        base.pointBackgroundColor = c;
        base.tension = 0.3;
        base.pointRadius = 3;
        base.borderWidth = 2;
        base.fill = ds.fill ?? false;
      } else {
        base.backgroundColor = TONES[ds.tone] ?? TONES.accent;
        base.maxBarThickness = 46;
      }
      return base;
    }),
  };
}

// chart: { type: "bar" | "line" | "doughnut", data, horizontal?, stacked?, legend? }
// Resolves to { dataUrl, width, height } (pixels, drawn at 2x for sharpness).
export async function renderChartImage(chart, { width = 640, height = 340 } = {}) {
  const { type, data, horizontal = false, stacked = false } = chart;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const text = "#1f2a33";
  const grid = "rgba(31,42,51,0.12)";
  const showLegend = chart.legend ?? type === "doughnut";

  const options = {
    responsive: false,
    animation: false,
    devicePixelRatio: scale,
    plugins: {
      legend: {
        display: showLegend,
        position: type === "doughnut" ? "right" : "top",
        labels: { color: text, boxWidth: 12, boxHeight: 12, font: { size: 12 } },
      },
      tooltip: { enabled: false },
    },
  };

  if (type !== "doughnut") {
    options.indexAxis = horizontal ? "y" : "x";
    const valueAxis = {
      beginAtZero: true,
      stacked,
      ticks: { color: text, precision: 0, font: { size: 11 } },
      grid: { color: grid },
    };
    const labelAxis = { stacked, ticks: { color: text, font: { size: 11 }, autoSkip: true }, grid: { display: false } };
    options.scales = horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis };
  } else {
    options.cutout = "55%";
  }

  const instance = new Chart(canvas, {
    type,
    data: paint(type, data),
    options,
    plugins: [whiteBackground, ...(stacked ? [] : [valueLabels])],
  });
  const dataUrl = canvas.toDataURL("image/png");
  instance.destroy();
  return { dataUrl, width, height };
}

// Renders every section that has a `chart`, returning a Map(section -> image).
export async function renderReportCharts(report) {
  const out = new Map();
  for (const section of report.sections) {
    if (!section.chart) continue;
    try {
      out.set(section, await renderChartImage(section.chart));
    } catch {
      /* a chart that fails to draw is skipped; its table (if any) still exports */
    }
  }
  return out;
}
