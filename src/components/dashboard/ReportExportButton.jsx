import { useEffect, useRef, useState } from "react";
import { exportReportAsPdf, exportReportAsWord, exportReportAsExcel } from "../../lib/reportExport";

const FORMATS = [
  { key: "pdf", label: "Export as PDF" },
  { key: "docx", label: "Export as Word (.docx)" },
  { key: "xlsx", label: "Export as Excel (.xlsx)" },
];

// Small "Export report" button with a dropdown for the three formats.
// `buildReport()` is called lazily, only once a format is actually picked,
// so nothing is computed unless the warden/finance user asks for it.
function ReportExportButton({ buildReport }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
      const report = buildReport();
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
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              className="report-export__item"
              onClick={() => handlePick(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportExportButton;
