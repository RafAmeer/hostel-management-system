// Simple bar chart built from divs, styled via dashboard.css .chart__*
// classes. Kept dependency-free (no recharts/chart.js) since this project
// only has react/react-dom/@supabase/supabase-js installed. If the charts
// need to get more advanced later (multi-series, tooltips), that's the
// point to bring in a real charting library.

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="chart__bars">
      {data.map((d) => (
        <div className="chart__col" key={d.label}>
          <span className="chart__value">{d.value}</span>
          <div
            className={`chart__bar chart__bar--${d.tone ?? "neutral"}`}
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <span className="chart__label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
