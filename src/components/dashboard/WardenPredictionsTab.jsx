import { useMemo, useState } from "react";
import ChartCanvas from "./ChartCanvas";
import { buildPredictions, predictionsForAi, hourLabel } from "../../lib/predictions";
import { askHostelAssistant } from "../../lib/aiChat";
import { formatDateTime } from "../../lib/formatters";

const RISK_TONE = { high: "danger", medium: "warn", low: "neutral" };
const RISK_LABEL = { high: "High risk", medium: "Medium risk", low: "Low risk" };
const TREND_TEXT = { rising: "↗ Rising", falling: "↘ Falling", steady: "→ Steady" };
const TREND_TONE = { rising: "warn", falling: "ok", steady: "neutral" };

const AI_QUESTION =
  "Explain these hostel forecasts to the warden and give 3 practical actions to take this week, most urgent first.";

function Card({ title, hint, how, children, wide }) {
  return (
    <section className={"chart-card glass-panel predict-card" + (wide ? " chart-card--wide" : "")}>
      <h3 className="chart__title">{title}</h3>
      {hint && <p className="list-row__meta chart-card__hint">{hint}</p>}
      {children}
      {how && (
        <details className="predict-how">
          <summary>How is this predicted?</summary>
          <p>{how}</p>
        </details>
      )}
    </section>
  );
}

// Splits the AI's answer into bullet points when it wrote a list.
function AiText({ text }) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => /^([-•*]|\d+[.)])\s+/.test(l));
  if (bullets.length >= 2) {
    const intro = lines.filter((l) => !bullets.includes(l));
    return (
      <>
        {intro.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        <ol className="predict-ai__list">
          {bullets.map((l, i) => (
            <li key={i}>{l.replace(/^([-•*]|\d+[.)])\s+/, "").replace(/\*\*/g, "")}</li>
          ))}
        </ol>
      </>
    );
  }
  return lines.map((l, i) => <p key={i}>{l.replace(/\*\*/g, "")}</p>);
}

function WardenPredictionsTab({ bookings, complaints, rooms, students, curfewLogs, onNavigate }) {
  const p = useMemo(
    () => buildPredictions({ bookings, complaints, rooms, students, curfewLogs }),
    [bookings, complaints, rooms, students, curfewLogs]
  );
  const [ai, setAi] = useState({ text: "", error: "", loading: false });

  const complaintChart = useMemo(() => {
    const labels = [...p.complaints.labels, "Next week"];
    const actual = [...p.complaints.weekly, null];
    const forecast = labels.map((_, i) =>
      i === labels.length - 2 ? p.complaints.weekly.at(-1) : i === labels.length - 1 ? p.complaints.nextWeek : null
    );
    return {
      labels,
      datasets: [
        { label: "Complaints per week", data: actual, tone: "accent", fill: true },
        { label: "Forecast", data: forecast, tone: "warm", borderDash: [6, 5], spanGaps: true },
      ],
    };
  }, [p]);

  const categoryChart = useMemo(
    () => ({
      labels: p.complaints.categories.map((c) => c.category),
      datasets: [{ label: "Expected next week", data: p.complaints.categories.map((c) => c.expected), tone: "warn" }],
    }),
    [p]
  );

  const curfewChart = useMemo(() => {
    // Afternoon to early morning is where check-outs happen.
    const hours = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
    return {
      labels: hours.map(hourLabel),
      datasets: [{ label: "Check-outs (last 30 days)", data: hours.map((h) => p.curfew.outByHour[h]), tone: "info" }],
    };
  }, [p]);

  const explain = async () => {
    setAi({ text: "", error: "", loading: true });
    try {
      const text = await askHostelAssistant(AI_QUESTION, { predictions: predictionsForAi(p) }, { mode: "predictions" });
      setAi({ text: text || "The AI didn't return anything. Try again.", error: "", loading: false });
    } catch (e) {
      setAi({ text: "", error: e.message, loading: false });
    }
  };

  const c = p.complaints;
  const o = p.occupancy;
  const cf = p.curfew;

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">AI Predictions</h2>
        <span className={"badge predict-confidence badge--" + (c.confidence.level === "low" ? "warn" : "ok")}>
          Data confidence: {c.confidence.label}
        </span>
      </div>
      <p className="tab__lede">
        What's likely to happen next, worked out from your past bookings, complaints and curfew scans.
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Complaints expected next week</span>
          <span className="stat-card__value">{c.nextWeek}</span>
          <span className={"badge badge--" + TREND_TONE[c.trend]}>{TREND_TEXT[c.trend]}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Occupancy if pending approved</span>
          <span className="stat-card__value">{o.projectedRate === null ? "—" : `${o.projectedRate}%`}</span>
          <span className={"badge badge--" + (o.willBeFull ? "danger" : "ok")}>
            {o.capacity ? (o.willBeFull ? "May run out of beds" : `${o.bedsLeftAfterPending} beds left`) : "Add rooms first"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Rooms likely to need repairs</span>
          <span className="stat-card__value">{p.hotspots.length}</span>
          <span className={"badge badge--" + (p.hotspots.some((h) => h.risk === "high") ? "danger" : "neutral")}>
            {p.hotspots.filter((h) => h.risk === "high").length} high risk
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Late returns expected next week</span>
          <span className="stat-card__value">{cf.expectedLateReturnsNextWeek}</span>
          <span className="badge badge--neutral">Curfew {hourLabel(cf.curfewHour)}</span>
        </div>
      </div>

      <section className="glass-panel predict-ai">
        <div className="predict-ai__head">
          <div>
            <h3 className="chart__title">✨ AI insight</h3>
            <p className="list-row__meta">
              The AI reads the forecasts below and suggests what to do. Student names are not sent to the AI.
            </p>
          </div>
          <button type="button" className="primary-btn" onClick={explain} disabled={ai.loading}>
            {ai.loading ? "Thinking…" : ai.text ? "Ask again" : "Explain with AI"}
          </button>
        </div>
        {ai.error && (
          <p className="message message--error" role="alert">
            {ai.error}
          </p>
        )}
        {ai.text && (
          <div className="predict-ai__answer" aria-live="polite">
            <AiText text={ai.text} />
          </div>
        )}
      </section>

      <div className="chart-card-grid">
        <Card
          wide
          title="Complaints forecast"
          hint={`Expected next week: ${c.nextWeek} (likely between ${c.low} and ${c.high}). Average so far: ${c.weeklyAverage} a week.`}
          how={`A straight trend line is fitted through the number of complaints in each of the last 8 weeks (least-squares linear regression) and extended one week ahead. The range comes from how far the real weeks usually sit from that line. Based on ${c.basedOn} complaints. ${c.confidence.note}`}
        >
          <ChartCanvas type="line" data={complaintChart} height={240} legend ariaLabel="Line chart of weekly complaints with next week's forecast" />
        </Card>

        <Card
          title="Likely complaint types next week"
          hint={c.busiestDay ? `Most complaints usually come in on ${c.busiestDay}.` : undefined}
          how="Next week's forecast is split by each category's share of complaints over the last 8 weeks."
        >
          {c.categories.length ? (
            <ChartCanvas type="bar" data={categoryChart} horizontal ariaLabel="Bar chart of expected complaints by category" />
          ) : (
            <p className="tab__empty chart-card__empty">No complaints in the last 8 weeks.</p>
          )}
        </Card>

        <Card
          title="Bed demand"
          hint={
            o.capacity
              ? `${o.occupied} of ${o.capacity} beds taken (${o.currentRate}%) · ${o.pending} pending requests`
              : "Add rooms under Hostels & Rooms to forecast occupancy."
          }
          how="Projected occupancy assumes every pending request is approved. New requests for the next 30 days come from the booking trend over the last 8 weeks."
        >
          <ul className="predict-facts">
            <li>
              <span>Now</span>
              <strong>{o.currentRate === null ? "—" : `${o.currentRate}%`}</strong>
            </li>
            <li>
              <span>If pending approved</span>
              <strong>{o.projectedRate === null ? "—" : `${o.projectedRate}%`}</strong>
            </li>
            <li>
              <span>New requests expected (30 days)</span>
              <strong>{o.expectedRequestsNext30Days}</strong>
            </li>
            <li>
              <span>Demand</span>
              <strong>
                <span className={"badge badge--" + TREND_TONE[o.demandTrend]}>{TREND_TEXT[o.demandTrend]}</span>
              </strong>
            </li>
          </ul>
          {o.pending > 0 && (
            <button type="button" className="link-btn" onClick={() => onNavigate?.("bookings")}>
              Review {o.pending} pending request{o.pending > 1 ? "s" : ""} →
            </button>
          )}
        </Card>

        <Card
          title="Rooms likely to need maintenance"
          hint="Rooms with 2 or more complaints in the last 90 days."
          how="Each complaint in the last 90 days adds up to 1 point to the room (newer ones count more). +1 if the same problem came back, +0.5 for each complaint still open. 4.5+ points = high risk, 2.5+ = medium."
        >
          {p.hotspots.length === 0 ? (
            <p className="tab__empty chart-card__empty">No repeat problems found. 👍</p>
          ) : (
            <ul className="predict-list">
              {p.hotspots.map((h) => (
                <li key={`${h.hostel}-${h.room}`}>
                  <div>
                    <p className="list-row__title">
                      Room {h.room}
                      {h.hostel ? ` · ${h.hostel}` : ""}
                    </p>
                    <p className="list-row__meta">
                      {h.complaints} complaints
                      {h.repeatCategory ? ` · ${h.repeatCategory} keeps coming back` : ` · mostly ${h.topCategory}`}
                      {h.open ? ` · ${h.open} still open` : ""} · last {formatDateTime(h.lastReported)}
                    </p>
                  </div>
                  <span className={"badge badge--" + RISK_TONE[h.risk]}>{RISK_LABEL[h.risk]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="When students go out"
          hint={cf.peakCheckoutHour !== null ? `Most check-outs happen around ${hourLabel(cf.peakCheckoutHour)}.` : "No check-outs in the last 30 days."}
          how="Counts check-out scans by hour over the last 30 days."
        >
          <ChartCanvas type="bar" data={curfewChart} height={220} ariaLabel="Bar chart of check-outs by hour" />
        </Card>

        <Card
          title="Students likely to miss curfew"
          hint={`Late = checked back in after ${hourLabel(cf.curfewHour)} in the last 30 days.`}
          how="Students who returned late before are the most likely to do it again. 4+ late returns = high risk, 2-3 = medium, 1 = low."
        >
          {cf.atRisk.length === 0 ? (
            <p className="tab__empty chart-card__empty">No late returns in the last 30 days. 🌙</p>
          ) : (
            <ul className="predict-list">
              {cf.atRisk.map((s) => (
                <li key={s.id}>
                  <div>
                    <p className="list-row__title">{s.name}</p>
                    <p className="list-row__meta">
                      {s.lateReturns} late return{s.lateReturns > 1 ? "s" : ""}
                      {s.room ? ` · Room ${s.room}` : ""}
                      {s.usualNights.length ? ` · usually ${s.usualNights.join(" / ")}` : ""}
                    </p>
                  </div>
                  <span className={"badge badge--" + RISK_TONE[s.risk]}>{RISK_LABEL[s.risk]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default WardenPredictionsTab;
