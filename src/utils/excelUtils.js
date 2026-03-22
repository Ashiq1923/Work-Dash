import * as XLSX from 'xlsx';

export function exportToExcel(sheetDataMap, filename) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheetDataMap).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export a single article to Excel with a proper print layout:
 * Header row with article info, then component table with calculations.
 */
export function exportSingleArticle(article, partyName) {
  const wb = XLSX.utils.book_new();

  // Build rows: header info first, then blank, then table
  const data = [];
  data.push({ A: 'Party', B: partyName });
  data.push({ A: 'Article', B: article.articleName });
  data.push({ A: 'Machine Head', B: article.machineHead });
  data.push({ A: 'Date', B: article.date });
  data.push({}); // blank row

  // Table header
  data.push({
    A: '#', B: 'Stitch', C: 'Component', D: 'Qty/Meter', E: 'Value',
    F: 'Type', G: 'Eff. Heads', H: 'Rounds', I: 'Stitch × Rounds',
  });

  let grandTotal = 0;
  article.components.forEach((c, i) => {
    const total = Math.round(c.total || 0);
    grandTotal += total;
    data.push({
      A: i + 1,
      B: c.stitch || 0,
      C: c.componentName,
      D: c.qtyOrMeter === 'qty' ? 'Qty' : 'Meter',
      E: c.value,
      F: c.type === 'alternet' ? 'Alternet' : c.type === 'duble_alternet' ? 'Duble Alternet' : 'All Head',
      G: Number(c.effectiveHeads || 0).toFixed(1),
      H: Number(c.rounds || 0).toFixed(2),
      I: total,
    });
  });

  // Grand total row
  data.push({});
  data.push({ A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: 'Grand Total:', I: grandTotal });

  // Avg Production, Shifts, Days
  if (article.avgProduction > 0 && grandTotal > 0) {
    const avg = Number(article.avgProduction);
    const shifts = grandTotal / avg;
    const days = grandTotal / avg / 2;
    const fmtShifts = shifts === 1 ? 'Today' : shifts.toFixed(2) + ' Shifts';
    const fmtDays = days === 1 ? 'Today' : days.toFixed(2) + ' Days';
    data.push({});
    data.push({ A: 'Avg Production', B: avg });
    data.push({ A: 'Shifts', B: fmtShifts });
    data.push({ A: 'Days', B: fmtDays });
  }

  const ws = XLSX.utils.json_to_sheet(data, { header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], skipHeader: true });

  // Column widths for print
  ws['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
    { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Article');

  const safeName = article.articleName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}
