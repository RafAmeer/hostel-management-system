// Turns a simple "report" shape ({ title, generatedAt, sections }) into a
// downloadable PDF, Word (.docx) or Excel (.xlsx) file. Used by the Warden
// Overview and Finance Overview "Export report" buttons.
//
// A report section is either:
//   { heading, rows: [[cell, cell, ...], ...] }          -> a table
//   { heading, lines: ["line 1", "line 2"] }              -> plain text
//   { heading, chart: { type, data, horizontal?, stacked?, legend? } }  -> a graph
//     (same shape the dashboard's ChartCanvas takes; drawn to a PNG by
//     lib/chartImage.js). A section may have `rows` AND a `chart`.
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
  ImageRun,
} from "docx";
import { renderReportCharts } from "./chartImage";

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

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function exportReportAsPdf(report) {
  const images = await renderReportCharts(report);
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

    const img = images.get(section);
    if (img) {
      const w = 180;
      const h = (w * img.height) / img.width;
      if (y + h > 285) {
        doc.addPage();
        y = 20;
        doc.setFontSize(12);
        doc.text(section.heading, 14, y);
        y += 4;
      }
      doc.addImage(img.dataUrl, "PNG", 14, y, w, h, undefined, "FAST"); // FAST = deflate; uncompressed PNGs made 40MB PDFs
      y += h + 8;
    }

    if (section.rows) {
      autoTable(doc, {
        startY: y,
        head: [section.rows[0]],
        body: section.rows.slice(1),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [47, 127, 163], textColor: 255 },
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
  const images = await renderReportCharts(report);

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

    const img = images.get(section);
    if (img) {
      const w = 560;
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: dataUrlToBytes(img.dataUrl),
              transformation: { width: w, height: Math.round((w * img.height) / img.width) },
              altText: { title: section.heading, description: `Chart: ${section.heading}`, name: section.heading },
            }),
          ],
        })
      );
    }

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
  const images = await renderReportCharts(report);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DormSphere";

  const usedNames = new Set();
  const sheetName = (heading) => {
    let base = heading.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
    let name = base;
    let n = 2;
    while (usedNames.has(name.toLowerCase())) name = `${base.slice(0, 25)} ${n++}`;
    usedNames.add(name.toLowerCase());
    return name;
  };

  // One sheet per table.
  for (const section of report.sections) {
    if (!section.rows) continue;
    const ws = workbook.addWorksheet(sheetName(section.heading));
    const [header, ...body] = section.rows;
    const headerRow = ws.addRow(header);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F7FA3" } };
    });
    body.forEach((row) => ws.addRow(row));
    ws.columns.forEach((col, i) => {
      const longest = Math.max(...section.rows.map((r) => String(r[i] ?? "").length), 8);
      col.width = Math.min(longest + 2, 40);
    });
  }

  // All graphs on one "Charts" sheet, stacked top to bottom as pictures.
  if (images.size > 0) {
    const ws = workbook.addWorksheet(sheetName("Charts"), { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 2;
    let row = 1;
    for (const section of report.sections) {
      const img = images.get(section);
      if (!img) continue;
      const title = ws.getCell(row, 2);
      title.value = section.heading;
      title.font = { bold: true, size: 13 };
      const id = workbook.addImage({ base64: img.dataUrl, extension: "png" });
      ws.addImage(id, { tl: { col: 1, row }, ext: { width: img.width, height: img.height } });
      row += Math.ceil(img.height / 20) + 3; // default row height is 20px
    }
  }

  if (workbook.worksheets.length === 0) {
    const ws = workbook.addWorksheet("Report");
    ws.addRow([report.title]).font = { bold: true };
    report.sections.flatMap((s) => s.lines ?? []).forEach((l) => ws.addRow([l]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${stem}.xlsx`
  );
}
