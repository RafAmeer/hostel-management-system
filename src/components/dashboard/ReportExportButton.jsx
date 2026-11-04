import { useEffect, useRef, useState } from "react";
import { exportReportAsPdf, exportReportAsWord, exportReportAsExcel } from "../../lib/reportExport";

const FORMATS = [
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "Word (.docx)" },
  { key: "xlsx", label: "Excel (.xlsx)" },
];

// "Export report" button with a dropdown for the three formats.
//
// Pass either `buildReport` (one report) or `reports` — a list of
// { key, label, build } — to let the user pick which report first
// (Overview offers summary, occupancy, curfew, complaints, bookings).
// Reports are only built once a format is picked.
function ReportExportButton({ buildReport, reports }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState(reports?.[0]?.key ?? "");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handlePick = async (formatKey) => {
    setOpen(false);
    setBusy(true);
    try {
      const build = reports ? reports.find((r) => r.key === choice)?.build : buildReport;
      const report = build();
      if (formatKey === "pdf") await exportReportAsPdf(report);
      else if (formatKey === "docx") await exportReportAsWord(report);
      else await exportReportAsExcel(report);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-export" ref={containerRef}>
      <button
        type="button"
        className="btn-outline btn-outline--neutral"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? "Preparing…" : "Export report"}
      </button>
      {open && (
        <div className="report-export__menu" role="menu">
          {reports && (
            <div className="report-export__pick">
              <span className="report-export__label">Report</span>
              {reports.map((r) => (
                <label key={r.key} className="report-export__option">
                  <input
                    type="radio"
                    name="report-type"
                    value={r.key}
                    checked={choice === r.key}
                    onChange={() => setChoice(r.key)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
              <span className="report-export__label">Download as</span>
            </div>
          )}
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              className="report-export__item"
              onClick={() => handlePick(f.key)}
            >
              {reports ? f.label : `Export as ${f.label}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportExportButton;
