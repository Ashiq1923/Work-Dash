import { useState, useMemo } from 'react';
import { Download, Printer, ChevronDown, ChevronUp, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';
import { useSalary } from '../context/SalaryContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelUtils';
import toast from 'react-hot-toast';
import './Salary.css';

/* ─── Bonus: 400K=100, every +50K=+50 ─── */
function calcBonus(production) {
  const p = Number(production) || 0;
  if (p < 400000) return 0;
  return 100 + Math.floor((p - 400000) / 50000) * 50;
}

/* ─── Salary: (prod/100000)*(30H→280,24H→240)+bonus ─── */
/* Sunday: production doubled, bonus on single (original) */
function calcSalary(production, head, isSun = false) {
  const original = Number(production) || 0;
  const displayProd = isSun ? original * 2 : original;
  const bonus = calcBonus(original); // always on single/original
  const rate = Number(head) === 30 ? 280 : 240;
  return (displayProd / 100000) * rate + bonus;
}
function getSundayProd(production, isSun) {
  const p = Number(production) || 0;
  return isSun ? p * 2 : p;
}

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function isSunday(y, m, d) { return new Date(y, m - 1, d).getDay() === 0; }
function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }

/* ─── Inline Edit Row ─── */
function EditRow({ day, monthNum, currentProd, currentDesc, isOverride, onSave, onCancel, onReset }) {
  const [prod, setProd] = useState(currentProd);
  const [desc, setDesc] = useState(currentDesc);
  return (
    <tr className="salary-edit-row">
      <td className="salary-day-table__day">{day}-{monthNum}</td>
      <td><input className="salary-edit-input" type="number" value={prod} onChange={e => setProd(e.target.value)} /></td>
      <td colSpan={2}></td>
      <td colSpan={2}><input className="salary-edit-input salary-edit-input--wide" type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description / reason..." /></td>
      <td>
        <div className="salary-edit-actions">
          <button className="action-btn" style={{ color: 'var(--color-success)' }} onClick={() => onSave(Number(prod), desc)} title="Save"><Check size={15} /></button>
          <button className="action-btn" onClick={onCancel} title="Cancel"><X size={15} /></button>
          {isOverride && <button className="action-btn" style={{ color: 'var(--color-warning)' }} onClick={onReset} title="Reset to original"><RotateCcw size={14} /></button>}
        </div>
      </td>
    </tr>
  );
}

/* ─── Print ─── */
function printSalarySheet(op, monthKey, numDays, monthNum, year, sheet, getHelperName, getOverride) {
  let totalProd = 0, totalBonus = 0, totalSalary = 0;
  const fmt = (v) => `Rs ${Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const rows = [];
  for (let d = 1; d <= numDays; d++) {
    const sunday = isSunday(year, monthNum, d);
    const dd = sheet?.days[String(d)];
    const ov = getOverride(op.id, monthKey, d);
    if (sunday && !dd && !ov) { rows.push(`<tr class="sunday"><td>${d}-${monthNum}</td><td colspan="5" class="sun-label">Sunday</td></tr>`); continue; }
    if (!dd && !ov) { rows.push(`<tr class="empty"><td>${d}-${monthNum}</td><td colspan="5">—</td></tr>`); continue; }
    const originalProd = ov ? Number(ov.production) : Number(dd?.production || 0);
    const dispProd = sunday ? originalProd * 2 : originalProd;
    const bonus = calcBonus(originalProd); // bonus on single
    const sal = calcSalary(originalProd, op.head, sunday);
    const desc = ov?.description || '';
    const hn = dd ? (dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)') : '-';
    totalProd += dispProd; totalBonus += bonus; totalSalary += sal;
    rows.push(`<tr${sunday ? ' class="sunday"' : ''}><td>${d}-${monthNum}${sunday ? ' <small>(Sun)</small>' : ''}${ov ? ' *' : ''}</td><td>${dispProd.toLocaleString()}${sunday ? ' <small>(×2)</small>' : ''}</td><td>${fmt(bonus)}</td><td><strong>${fmt(sal)}</strong></td><td>${hn}</td><td>${desc}</td></tr>`);
  }
  const html = `<!DOCTYPE html><html><head><title>Salary - ${op.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;color:#111}.header{margin-bottom:16px;border-bottom:2px solid #333;padding-bottom:12px}.header h1{font-size:18px;margin-bottom:4px}.meta{display:flex;gap:20px;font-size:12px;color:#444}.meta strong{color:#111}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#f0f0f0;font-weight:600}.empty td{color:#aaa}.sunday{background:#fff3f3}.sun-label{color:#d33;font-style:italic;text-align:center}.total td{font-weight:700;border-top:2px solid #333;font-size:12px}@media print{body{padding:10px}}</style></head><body><div class="header"><h1>Salary Sheet — ${op.name}</h1><div class="meta"><span>Machine: <strong>${op.machine}</strong></span><span>Head: <strong>${op.head}</strong></span><span>Helper: <strong>${getHelperName(op.defaultHelperId)}</strong></span><span>Month: <strong>${monthKey}</strong></span></div></div><table><thead><tr><th>Date</th><th>Production</th><th>Bonus</th><th>Salary</th><th>Helper</th><th>Description</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr class="total"><td>Total</td><td>${totalProd.toLocaleString()}</td><td>${fmt(totalBonus)}</td><td>${fmt(totalSalary)}</td><td colspan="2"></td></tr></tfoot></table><p style="margin-top:8px;font-size:10px;color:#888">* = Edited production (differs from original)</p></body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 400);
}

/* ─── Main ─── */
export default function Salary() {
  const { operators, sheets, getHelperName, getOperator } = useProduction();
  const { setOverride, deleteOverride, getOverride } = useSalary();
  const { activeDataKey } = useAuth();

  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [openSheets, setOpenSheets] = useState({});
  const [editingRow, setEditingRow] = useState(null); // { opId, day }
  const months = useMemo(() => getLastNMonths(12), []);

  const [year, monthNum] = monthFilter.split('-').map(Number);
  const numDays = daysInMonth(monthFilter);

  const filteredOperators = useMemo(() => {
    if (operatorFilter === 'all') return operators;
    return operators.filter(o => o.id === operatorFilter);
  }, [operators, operatorFilter]);

  const toggleSheet = (id) => setOpenSheets(prev => ({ ...prev, [id]: !prev[id] }));
  const getSheet = (operatorId) => sheets.find(s => s.operatorId === operatorId && s.month === monthFilter);

  // Get effective production (override or original)
  const getEffProd = (op, day, dd) => {
    const ov = getOverride(op.id, monthFilter, day);
    return ov ? Number(ov.production) : Number(dd?.production || 0);
  };

  // Get substitute production entries for an operator (from other sheets)
  const getSubEntries = (opId) => {
    const subs = [];
    sheets.forEach(s => {
      if (s.operatorId === opId) return; // skip own sheet
      if (s.month !== monthFilter) return;
      Object.entries(s.days || {}).forEach(([dayStr, dd]) => {
        if (dd.substituteOperatorId === opId) {
          subs.push({ day: Number(dayStr), dd, fromSheet: s });
        }
      });
    });
    return subs;
  };

  const calcOpTotals = (op) => {
    const sheet = getSheet(op.id);
    let totalProd = 0, totalBonus = 0, totalSalary = 0;
    // Own sheet days (exclude where substitute was assigned = operator absent)
    for (let d = 1; d <= numDays; d++) {
      const dd = sheet?.days[String(d)];
      const ov = getOverride(op.id, monthFilter, d);
      if (!dd && !ov) continue;
      if (dd?.substituteOperatorId) continue; // absent, salary goes to substitute
      const originalProd = ov ? Number(ov.production) : Number(dd?.production || 0);
      const isSun = isSunday(year, monthNum, d);
      const dispProd = getSundayProd(originalProd, isSun);
      totalProd += dispProd;
      totalBonus += calcBonus(originalProd);
      totalSalary += calcSalary(originalProd, op.head, isSun);
    }
    // Substitute entries from other sheets (credited to this operator)
    getSubEntries(op.id).forEach(({ day, dd }) => {
      const isSun = isSunday(year, monthNum, day);
      const prod = Number(dd.production) || 0;
      const dispProd = getSundayProd(prod, isSun);
      totalProd += dispProd;
      totalBonus += calcBonus(prod);
      totalSalary += calcSalary(prod, op.head, isSun);
    });
    return { totalProd, totalBonus, totalSalary };
  };

  const grandTotals = useMemo(() => {
    let prod = 0, bonus = 0, salary = 0;
    filteredOperators.forEach(op => {
      const t = calcOpTotals(op);
      prod += t.totalProd; bonus += t.totalBonus; salary += t.totalSalary;
    });
    return { prod, bonus, salary };
  }, [filteredOperators, sheets, monthFilter]);

  const handleEditSave = (opId, day, production, description) => {
    setOverride(opId, monthFilter, day, { production, description });
    setEditingRow(null);
    toast.success('Salary entry updated (local only)');
  };

  const handleReset = (opId, day) => {
    deleteOverride(opId, monthFilter, day);
    setEditingRow(null);
    toast.success('Reset to original production');
  };

  const exportSheet = (op) => {
    const sheet = getSheet(op.id);
    const rows = [];
    let totalProd = 0, totalBonus = 0, totalSal = 0;
    for (let d = 1; d <= numDays; d++) {
      const sunday = isSunday(year, monthNum, d);
      const dd = sheet?.days[String(d)];
      const ov = getOverride(op.id, monthFilter, d);
      if (sunday && !dd && !ov) { rows.push({ Date: `${d}-${monthNum}`, Production: '', Bonus: '', Salary: '', Helper: 'Sunday', Description: '' }); continue; }
      if (!dd && !ov) { rows.push({ Date: `${d}-${monthNum}`, Production: '', Bonus: '', Salary: '', Helper: '', Description: '' }); continue; }
      const originalProd = ov ? Number(ov.production) : Number(dd?.production || 0);
      const dispProd = sunday ? originalProd * 2 : originalProd;
      const bonus = calcBonus(originalProd);
      const sal = calcSalary(originalProd, op.head, sunday);
      totalProd += dispProd; totalBonus += bonus; totalSal += sal;
      const hn = dd ? (dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)') : '-';
      rows.push({ Date: `${d}-${monthNum}${sunday ? ' (Sun)' : ''}${ov ? ' *' : ''}`, Production: dispProd, 'Bonus (Rs)': bonus, 'Salary (Rs)': sal.toFixed(2), Helper: hn, Description: ov?.description || '' });
    }
    rows.push({ Date: 'TOTAL', Production: totalProd, 'Bonus (Rs)': totalBonus, 'Salary (Rs)': totalSal.toFixed(2), Helper: '', Description: '' });
    exportToExcel({ [`${op.name}_Salary`]: rows }, `salary_${op.name}_${monthFilter}`);
    toast.success('Exported!');
  };

  const exportAll = () => {
    const allRows = [];
    filteredOperators.forEach(op => {
      const sheet = getSheet(op.id);
      for (let d = 1; d <= numDays; d++) {
        const dd = sheet?.days[String(d)];
        const ov = getOverride(op.id, monthFilter, d);
        if (!dd && !ov) continue;
        const originalProd = ov ? Number(ov.production) : Number(dd?.production || 0);
        const sunday = isSunday(year, monthNum, d);
        const dispProd = sunday ? originalProd * 2 : originalProd;
        const bonus = calcBonus(originalProd);
        const sal = calcSalary(originalProd, op.head, sunday);
        allRows.push({ Operator: op.name, Machine: op.machine, Date: `${d}-${monthNum}${sunday ? ' (Sun)' : ''}`, Production: dispProd, 'Bonus (Rs)': bonus, 'Salary (Rs)': sal.toFixed(2), Description: ov?.description || '' });
      }
    });
    exportToExcel({ Salary: allRows }, `salary_all_${monthFilter}`);
    toast.success('Exported!');
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Salary</h1><p className="page-subtitle">Operator salary sheets from production data</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}>
            <option value="all">All Operators</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name} — {o.machine}</option>)}
          </select>
          <Button variant="secondary" onClick={exportAll}><Download size={16} /> Export All</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Operators</p><p className="stats-card__value">{filteredOperators.length}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Production</p><p className="stats-card__value">{grandTotals.prod.toLocaleString()}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Bonus</p><p className="stats-card__value" style={{ color: 'var(--color-warning)' }}>{fmtRS(grandTotals.bonus)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Salary</p><p className="stats-card__value" style={{ color: 'var(--color-accent)' }}>{fmtRS(grandTotals.salary)}</p></div></div>
      </div>

      <div className="salary-bonus-rule card" style={{ marginBottom: 16, padding: '10px 16px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        <strong>Salary Formula:</strong> (Prod/100K) × {'{30H→280, 24H→240}'} + Bonus | <strong>Bonus:</strong> 400K = Rs 100, every +50K = +Rs 50
      </div>

      {filteredOperators.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No operators. Register in Production section first.</p></div></div>
      ) : (
        <div className="salary-sheets-list">
          {filteredOperators.map(op => {
            const sheet = getSheet(op.id);
            const isOpen = openSheets[op.id] ?? false;
            const { totalProd, totalBonus, totalSalary } = calcOpTotals(op);
            const filledDays = new Set([
              ...Object.keys(sheet?.days || {}),
              ...Array.from({ length: numDays }, (_, i) => i + 1).filter(d => getOverride(op.id, monthFilter, d)).map(String)
            ]).size;

            return (
              <div key={op.id} className="salary-sheet card">
                <div className="salary-sheet__header" onClick={() => toggleSheet(op.id)}>
                  <div className="salary-sheet__info">
                    <span className="badge badge--accent">{op.machine}</span>
                    <strong>{op.name}</strong>
                    <span className="badge badge--default">{op.head}H</span>
                    <span className="badge badge--party">{getHelperName(op.defaultHelperId)}</span>
                    <span className="badge badge--success">{filledDays} days</span>
                    <span className="salary-sheet__summary">
                      Prod: {totalProd.toLocaleString()} | Bonus: {fmtRS(totalBonus)} | Salary: {fmtRS(totalSalary)}
                    </span>
                  </div>
                  <div className="salary-sheet__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); exportSheet(op); }} title="Export Excel"><Download size={15} /></button>
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printSalarySheet(op, monthFilter, numDays, monthNum, year, sheet, getHelperName, getOverride); }} title="Print"><Printer size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div className="salary-sheet__body">
                    <div className="table-wrapper">
                      <table className="data-table salary-day-table">
                        <thead><tr><th>Date</th><th>Production</th><th>Bonus</th><th>Salary</th><th>Helper</th><th>Description</th><th></th></tr></thead>
                        <tbody>
                          {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
                            const sunday = isSunday(year, monthNum, day);
                            const dd = sheet?.days[String(day)];
                            const ov = getOverride(op.id, monthFilter, day);
                            const dayLabel = `${day}-${monthNum}`;
                            const isAbsent = dd?.substituteOperatorId;

                            if (editingRow?.opId === op.id && editingRow?.day === day) {
                              const curProd = ov ? ov.production : (dd ? dd.production : 0);
                              const curDesc = ov?.description || '';
                              return <EditRow key={day} day={day} monthNum={monthNum} currentProd={curProd} currentDesc={curDesc} isOverride={!!ov}
                                onSave={(p, d) => handleEditSave(op.id, day, p, d)} onCancel={() => setEditingRow(null)} onReset={() => handleReset(op.id, day)} />;
                            }

                            if (isAbsent) {
                              const subOp = operators.find(o => o.id === dd.substituteOperatorId);
                              return (<tr key={day} className="salary-absent-row"><td className="salary-day-table__day">{dayLabel}</td><td colSpan={5} style={{ color: 'var(--color-danger)', fontSize: '0.8rem', fontStyle: 'italic' }}>Absent — Worked by {subOp?.name || '?'} ({subOp?.machine})</td><td><button className="action-btn" onClick={() => setEditingRow({ opId: op.id, day })} title="Edit"><Pencil size={13} /></button></td></tr>);
                            }

                            if (sunday && !dd && !ov) {
                              return (<tr key={day} className="salary-sunday"><td className="salary-day-table__day">{dayLabel}</td><td colSpan={5} className="salary-sunday-label">Sunday</td><td><button className="action-btn" onClick={() => setEditingRow({ opId: op.id, day })} title="Edit"><Pencil size={13} /></button></td></tr>);
                            }

                            if (!dd && !ov) {
                              return (<tr key={day} className="salary-day-empty"><td className="salary-day-table__day">{dayLabel}</td><td colSpan={5} style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</td><td><button className="action-btn" onClick={() => setEditingRow({ opId: op.id, day })} title="Edit"><Pencil size={13} /></button></td></tr>);
                            }

                            const originalProd = ov ? Number(ov.production) : Number(dd?.production || 0);
                            const dispProd = getSundayProd(originalProd, sunday);
                            const bonus = calcBonus(originalProd);
                            const salary = calcSalary(originalProd, op.head, sunday);
                            const hn = dd ? (dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)') : '-';
                            const desc = ov?.description || '';

                            return (
                              <tr key={day} className={`${sunday ? 'salary-sunday-filled' : ''} ${ov ? 'salary-override-row' : ''}`}>
                                <td className="salary-day-table__day">{dayLabel}{sunday ? <small className="salary-sun-tag"> Sun</small> : ''}{ov ? <small className="salary-edited-tag"> *</small> : ''}</td>
                                <td style={{ fontWeight: 600 }}>{dispProd.toLocaleString()}{sunday ? <small className="salary-sun-tag"> (×2)</small> : ''}</td>
                                <td><span className={`badge ${bonus > 0 ? 'badge--warning' : 'badge--default'}`}>{fmtRS(bonus)}</span></td>
                                <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtRS(salary)}</td>
                                <td><span className={`badge badge--${dd?.useDefaultHelper !== false ? 'default' : 'warning'}`}>{hn}</span></td>
                                <td className="salary-desc-cell">{desc ? <span className="salary-desc">{desc}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                                <td><button className="action-btn" onClick={() => setEditingRow({ opId: op.id, day })} title="Edit"><Pencil size={13} /></button></td>
                              </tr>
                            );
                          })}
                          {/* Substitute entries from other machines */}
                          {getSubEntries(op.id).map(({ day, dd, fromSheet }) => {
                            const sunday = isSunday(year, monthNum, day);
                            const prod = Number(dd.production) || 0;
                            const dispProd = getSundayProd(prod, sunday);
                            const bonus = calcBonus(prod);
                            const salary = calcSalary(prod, op.head, sunday);
                            const fromOp = operators.find(o => o.id === fromSheet.operatorId);
                            return (
                              <tr key={`sub-${fromSheet.id}-${day}`} className="salary-sub-row">
                                <td className="salary-day-table__day">{day}-{monthNum}</td>
                                <td style={{ fontWeight: 600 }}>{dispProd.toLocaleString()}{sunday ? <small className="salary-sun-tag"> (×2)</small> : ''}</td>
                                <td><span className={`badge ${bonus > 0 ? 'badge--warning' : 'badge--default'}`}>{fmtRS(bonus)}</span></td>
                                <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtRS(salary)}</td>
                                <td><span className="badge badge--danger">Sub: {fromOp?.machine}</span></td>
                                <td className="salary-desc-cell"><span className="salary-desc">Covered {fromOp?.name}'s {fromOp?.machine}</span></td>
                                <td></td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={{ fontWeight: 700, textAlign: 'right' }}>Total:</td>
                            <td style={{ fontWeight: 700 }}>{totalProd.toLocaleString()}</td>
                            <td style={{ fontWeight: 700 }}>{fmtRS(totalBonus)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtRS(totalSalary)}</td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
