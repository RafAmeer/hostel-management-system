// Turns a simple "report" shape ({ title, generatedAt, sections }) into a
// downloadable PDF, Word (.docx) or Excel (.xlsx) file. Used by the Warden
// Overview and Finance Overview "Export report" buttons.
//
// A report section is either:
//   { heading, rows: [[cell, cell, ...], ...] }          -> a table
//   { heading, lines: ["line 1", "line 2"] }              -> plain text
// The first row of `rows` is treated as the header row.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
} from "docx";
import writeExcelFile from "write-excel-file/browser";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileStem(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

export function exportReportAsPdf(report) {
  const doc = new jsPDF();
  const stem = safeFileStem(report.title);

  doc.setFontSize(16);
  doc.text(report.title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${report.generatedAt}`, 14, 25);
  doc.setTextColor(0);

  let y = 32;
  for (const section of report.sections) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.text(section.heading, 14, y);
    y += 4;

    if (section.rows) {
      autoTable(doc, {
        startY: y,
        head: [section.rows[0]],
        body: section.rows.slice(1),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [242, 166, 90], textColor: 20 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    } else if (section.lines) {
      doc.setFontSize(10);
      for (const line of section.lines) {
        doc.text(`• ${line}`, 16, y);
        y += 6;
      }
      y += 6;
    }
  }

  doc.save(`${stem}.pdf`);
}

export async function exportReportAsWord(report) {
  const stem = safeFileStem(report.title);

  const children = [
    new Paragraph({ text: report.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${report.generatedAt}`, italics: true, color: "888888" }),
      ],
    }),
  ];

  for (const section of report.sections) {
    children.push(
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } })
    );

    if (section.rows) {
      const [header, ...body] = section.rows;
      const makeRow = (cells, bold) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(cell), bold })] })],
              })
          ),
        });
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [makeRow(header, true), ...body.map((row) => makeRow(row, false))],
        })
      );
    } else if (section.lines) {
      for (const line of section.lines) {
        children.push(new Paragraph({ text: line, bullet: { level: 0 } }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${stem}.docx`);
}

export async function exportReportAsExcel(report) {
  const stem = safeFileStem(report.title);

  const sheets = report.sections
    .filter((section) => section.rows)
    .map((section) => {
      const [header, ...body] = section.rows;
      const headerRow = header.map((cell) => ({ value: cell, fontWeight: "bold" }));
      const bodyRows = body.map((row) => row.map((cell) => ({ value: cell })));
      return {
        sheet: section.heading.slice(0, 31) || "Sheet",
        data: [headerRow, ...bodyRows],
      };
    });

  if (sheets.length === 0) {
    // Nothing tabular to export (text-only report) — write a one-column sheet instead.
    const lines = report.sections.flatMap((s) => s.lines ?? []);
    await writeExcelFile([[{ value: report.title, fontWeight: "bold" }], ...lines.map((l) => [{ value: l }])], {
      fileName: `${stem}.xlsx`,
    });
    return;
  }

  await writeExcelFile(
    sheets.map((s) => ({ data: s.data, sheet: s.sheet })),
    { fileName: `${stem}.xlsx` }
  );
}
