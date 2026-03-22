import { useState, useMemo } from 'react';
import { Plus, Trash2, Download, Settings2, ChevronDown, ChevronUp, Printer, Pencil, Check, X } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormField';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelUtils';
import { PageLoader } from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import './Production.css';

/* ─── Helper Form ─── */
function HelperForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) { toast.error('Name required'); return; } onSave(name); setName(''); }} className="form-grid">
      <Input label="Helper Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Usman" required autoFocus />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add Helper</Button></div>
    </form>
  );
}

/* ─── Operator Form ─── */
function OperatorForm({ helpers, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', machine: 'M1', head: 24, defaultHelperId: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); if (!form.name.trim()) { toast.error('Name required'); return; } if (!form.defaultHelperId) { toast.error('Select helper'); return; } onSave(form); }} className="form-grid">
      <Input label="Operator Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ahmed" required />
      <Select label="Machine" value={form.machine} onChange={e => set('machine', e.target.value)}>
        {['M1','M2','M3','M4','M5','M6','M7'].map(m => <option key={m} value={m}>{m}</option>)}
      </Select>
      <Select label="Machine Head" value={form.head} onChange={e => set('head', e.target.value)}>
        <option value={24}>24 Head</option><option value={30}>30 Head</option>
      </Select>
      <Select label="Default Helper" value={form.defaultHelperId} onChange={e => set('defaultHelperId', e.target.value)}>
        <option value="">-- Select --</option>
        {helpers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
      </Select>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Register Operator</Button></div>
    </form>
  );
}

/* ─── Add Entry Form ─── */
function EntryForm({ operators, helpers, sheets, month, getHelperName, onSave, onCancel }) {
  const [form, setForm] = useState({ operatorId: '', useDefaultHelper: true, extraHelperId: '', production: '', type: 'alternet', rate: '', day: '', isSubstitute: false, substituteOperatorId: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedOp = operators.find(o => o.id === form.operatorId);
  const defaultHelperName = selectedOp ? getHelperName(selectedOp.defaultHelperId) : '';
  const otherHelpers = selectedOp ? helpers.filter(h => h.id !== selectedOp.defaultHelperId) : [];
  const [y, m] = month.split('-').map(Number);
  const numDays = new Date(y, m, 0).getDate();
  const today = new Date();
  const currentDay = (today.getFullYear() === y && today.getMonth() + 1 === m) ? today.getDate() : numDays;
  const existingDays = useMemo(() => {
    if (!form.operatorId) return new Set();
    const sheet = sheets.find(s => s.operatorId === form.operatorId && s.month === month);
    return new Set(Object.keys(sheet?.days || {}).map(Number));
  }, [form.operatorId, sheets, month]);
  const dayOptions = useMemo(() => {
    const days = [];
    for (let d = 1; d <= Math.min(currentDay, numDays); d++) if (!existingDays.has(d)) days.push(d);
    return days;
  }, [currentDay, numDays, existingDays]);

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!form.operatorId) { toast.error('Select operator'); return; }
      if (!form.production) { toast.error('Production required'); return; }
      if (!form.rate) { toast.error('Rate required'); return; }
      if (!form.day) { toast.error('Select date'); return; }
      if (form.isSubstitute && !form.substituteOperatorId) { toast.error('Select substitute operator'); return; }
      onSave({ operatorId: form.operatorId, day: Number(form.day), entry: { production: Number(form.production), useDefaultHelper: form.useDefaultHelper, extraHelperId: form.useDefaultHelper ? null : (form.extraHelperId || null), type: form.type, rate: Number(form.rate), substituteOperatorId: form.isSubstitute ? form.substituteOperatorId : null } });
      set('day', ''); set('production', '');
    }} className="form-grid">
      <Select label="Operator" value={form.operatorId} onChange={e => { set('operatorId', e.target.value); set('day', ''); }}>
        <option value="">-- Select Operator --</option>
        {operators.map(o => <option key={o.id} value={o.id}>{o.name} — {o.machine} ({o.head}H)</option>)}
      </Select>
      {selectedOp && (<>
        <div className="sheet-helper-section">
          <div className="sheet-helper-default"><label className="form-field__label">Helper</label>
            <div className="sheet-helper-row"><span className="sheet-helper-name">{defaultHelperName}</span>
              <label className="sheet-helper-check"><input type="checkbox" checked={form.useDefaultHelper} onChange={e => { set('useDefaultHelper', e.target.checked); if (e.target.checked) set('extraHelperId', ''); }} /><span>Default</span></label>
            </div>
          </div>
          {!form.useDefaultHelper && (<Select label="Other Helper (D)" value={form.extraHelperId} onChange={e => set('extraHelperId', e.target.value)}><option value="">-- Select --</option>{otherHelpers.map(h => <option key={h.id} value={h.id}>{h.name} (D)</option>)}</Select>)}
        </div>
        <Input label="Production *" type="number" min="0" value={form.production} onChange={e => set('production', e.target.value)} placeholder="e.g. 650000" required />
        <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}><option value="alternet">Alternet</option><option value="duble_alternet">Duble Alternet</option><option value="all_head">All Head</option></Select>
        <Input label="Rate *" type="number" min="0" step="0.01" value={form.rate} onChange={e => set('rate', e.target.value)} placeholder="e.g. 1.40" required />
        <div className="sheet-substitute-section" style={{ gridColumn: '1/-1' }}>
          <label className="sheet-helper-check"><input type="checkbox" checked={form.isSubstitute} onChange={e => { set('isSubstitute', e.target.checked); if (!e.target.checked) set('substituteOperatorId', ''); }} /><span>Operator Absent — Worked by substitute</span></label>
          {form.isSubstitute && (
            <Select label="Salary credited to (substitute operator)" value={form.substituteOperatorId} onChange={e => set('substituteOperatorId', e.target.value)}>
              <option value="">-- Select Substitute --</option>
              {operators.filter(o => o.id !== form.operatorId).map(o => <option key={o.id} value={o.id}>{o.name} — {o.machine}</option>)}
            </Select>
          )}
        </div>
        <Select label="Date" value={form.day} onChange={e => set('day', e.target.value)}><option value="">-- Select --</option>{dayOptions.map(d => <option key={d} value={d}>{d}-{m}</option>)}</Select>
        {dayOptions.length === 0 && <p style={{ gridColumn: '1/-1', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600 }}>All dates filled!</p>}
      </>)}
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add Entry</Button></div>
    </form>
  );
}

/* ─── Inline Edit Row ─── */
function EditRow({ day, monthNum, dd, helpers, op, operators, getHelperName, onSave, onCancel }) {
  const [form, setForm] = useState({ production: dd.production, useDefaultHelper: dd.useDefaultHelper, extraHelperId: dd.extraHelperId || '', type: dd.type, rate: dd.rate, isSubstitute: !!dd.substituteOperatorId, substituteOperatorId: dd.substituteOperatorId || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const otherHelpers = helpers.filter(h => h.id !== op.defaultHelperId);
  return (<>
    <tr className="prod-edit-row">
      <td className="prod-day-table__day">{day}-{monthNum}</td>
      <td>
        <div className="prod-edit-helper">
          <label className="sheet-helper-check-sm"><input type="checkbox" checked={form.useDefaultHelper} onChange={e => { set('useDefaultHelper', e.target.checked); if (e.target.checked) set('extraHelperId', ''); }} /></label>
          {!form.useDefaultHelper ? (
            <select className="prod-edit-select" value={form.extraHelperId} onChange={e => set('extraHelperId', e.target.value)}>
              <option value="">--</option>{otherHelpers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          ) : <span style={{ fontSize: '0.8rem' }}>{getHelperName(op.defaultHelperId)}</span>}
        </div>
      </td>
      <td><input className="prod-edit-input" type="number" value={form.production} onChange={e => set('production', e.target.value)} /></td>
      <td>
        <select className="prod-edit-select" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="alternet">Alt</option><option value="duble_alternet">D.Alt</option><option value="all_head">All</option>
        </select>
      </td>
      <td><input className="prod-edit-input prod-edit-input--sm" type="number" step="0.01" value={form.rate} onChange={e => set('rate', e.target.value)} /></td>
      <td>
        <div className="prod-edit-helper">
          <label className="sheet-helper-check-sm" title="Substitute"><input type="checkbox" checked={form.isSubstitute} onChange={e => { set('isSubstitute', e.target.checked); if (!e.target.checked) set('substituteOperatorId', ''); }} /></label>
          {form.isSubstitute && <select className="prod-edit-select" value={form.substituteOperatorId} onChange={e => set('substituteOperatorId', e.target.value)}><option value="">--</option>{operators.filter(o => o.id !== op.id).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="action-btn" style={{ color: 'var(--color-success)' }} onClick={() => onSave({ production: Number(form.production), useDefaultHelper: form.useDefaultHelper, extraHelperId: form.useDefaultHelper ? null : form.extraHelperId, type: form.type, rate: Number(form.rate), substituteOperatorId: form.isSubstitute ? form.substituteOperatorId : null })} title="Save"><Check size={15} /></button>
          <button className="action-btn" onClick={onCancel} title="Cancel"><X size={15} /></button>
        </div>
      </td>
    </tr>
  </>);
}

/* ─── Print Sheet ─── */
function printSheet(sheet, op, numDays, monthNum, getHelperName, calcGenIncome) {
  let totalProd = 0, totalGI = 0;
  const rows = [];
  for (let d = 1; d <= numDays; d++) {
    const dd = sheet.days[String(d)];
    if (!dd) { rows.push(`<tr class="empty"><td>${d}-${monthNum}</td><td colspan="5">—</td></tr>`); continue; }
    const gi = calcGenIncome(dd.production, op.head, dd.type, dd.rate);
    totalProd += Number(dd.production); totalGI += gi;
    const hn = dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)';
    const tl = `${getEffectiveHead(op.head, dd.type)}H`;
    rows.push(`<tr><td>${d}-${monthNum}</td><td>${hn}</td><td>${Number(dd.production).toLocaleString()}</td><td>${tl}</td><td>${Number(dd.rate).toFixed(2)}</td><td><strong>${gi.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td></tr>`);
  }
  const html = `<!DOCTYPE html><html><head><title>${op.name} - ${op.machine}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;color:#111}.header{margin-bottom:16px;border-bottom:2px solid #333;padding-bottom:12px}.header h1{font-size:18px;margin-bottom:4px}.meta{display:flex;gap:20px;font-size:12px;color:#444}.meta strong{color:#111}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f0f0f0;font-weight:600}.empty td{color:#aaa}.total td{font-weight:700;border-top:2px solid #333}@media print{body{padding:10px}}</style></head><body><div class="header"><h1>${op.name} — ${op.machine}</h1><div class="meta"><span>Head: <strong>${op.head}</strong></span><span>Helper: <strong>${getHelperName(op.defaultHelperId)}</strong></span><span>Month: <strong>${sheet.month}</strong></span></div></div><table><thead><tr><th>Date</th><th>Helper</th><th>Production</th><th>Type</th><th>Rate</th><th>Gen Income</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr class="total"><td colspan="2" style="text-align:right">Total:</td><td>${totalProd.toLocaleString()}</td><td colspan="2"></td><td>${totalGI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr></tfoot></table></body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 400);
}

function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }

/* ─── Main ─── */
export default function Production() {
  const { helpers, operators, sheets, loading: prodLoading, addHelper, deleteHelper, getHelperName, addOperator, deleteOperator, addDayEntry, deleteDayEntry, deleteSheet, calcGenIncome, getEffectiveHead, getOperator } = useProduction();
  const { activeDataKey } = useAuth();

  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [openSheets, setOpenSheets] = useState({});
  const [editingRow, setEditingRow] = useState(null); // { sheetId, day }
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showHelperForm, setShowHelperForm] = useState(false);
  const [showOperatorForm, setShowOperatorForm] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const months = useMemo(() => getLastNMonths(12), []);

  const monthSheets = useMemo(() => {
    let s = sheets.filter(s => s.month === monthFilter);
    if (operatorFilter !== 'all') s = s.filter(s => s.operatorId === operatorFilter);
    return s;
  }, [sheets, monthFilter, operatorFilter]);
  const numDays = daysInMonth(monthFilter);
  const [, monthNum] = monthFilter.split('-').map(Number);

  const toggleSheet = (id) => setOpenSheets(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAddHelper = (name) => { addHelper(name); toast.success(`Helper "${name}" added`); setShowHelperForm(false); };
  const handleAddOperator = (data) => { addOperator(data); toast.success(`"${data.name}" registered + sheet created`); setShowOperatorForm(false); };
  const handleAddEntry = (data) => { addDayEntry(data.operatorId, monthFilter, data.day, data.entry); toast.success(`Day ${data.day} added`); };
  const handleDeleteDay = (sheetId, day) => { if (window.confirm(`Delete day ${day}?`)) { deleteDayEntry(sheetId, day); toast.success('Deleted'); } };

  const handleEditSave = (sheetId, day, entry) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const updated = { ...sheet, days: { ...sheet.days, [String(day)]: entry } };
    // Direct dispatch via context update
    addDayEntry(sheet.operatorId, sheet.month, day, entry);
    setEditingRow(null);
    toast.success('Updated');
  };

  const exportSheet = (sheet) => {
    const op = getOperator(sheet.operatorId);
    if (!op) return;
    const rows = [];
    let totalProd = 0, totalGI = 0;
    for (let d = 1; d <= numDays; d++) {
      const dd = sheet.days[String(d)];
      if (!dd) continue;
      const gi = calcGenIncome(dd.production, op.head, dd.type, dd.rate);
      totalProd += Number(dd.production); totalGI += gi;
      rows.push({ Date: `${d}-${monthNum}`, Helper: dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)', Production: dd.production, Head: `${getEffectiveHead(op.head, dd.type)}H`, Rate: dd.rate, 'Gen Income': gi.toFixed(2) });
    }
    rows.push({ Date: 'TOTAL', Helper: '', Production: totalProd, Type: '', Rate: '', 'Gen Income': totalGI.toFixed(2) });
    exportToExcel({ [`${op.name}_${op.machine}`]: rows }, `${op.name}_${op.machine}_${monthFilter}`);
    toast.success('Exported!');
  };

  const handleExportAll = () => {
    const rows = [];
    monthSheets.forEach(sheet => {
      const op = getOperator(sheet.operatorId);
      if (!op) return;
      for (let d = 1; d <= numDays; d++) {
        const dd = sheet.days[String(d)];
        if (!dd) continue;
        const gi = calcGenIncome(dd.production, op.head, dd.type, dd.rate);
        rows.push({ Machine: op.machine, Operator: op.name, 'M.Head': op.head, Helper: dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)', Date: `${d}-${monthNum}`, Production: dd.production, Head: `${getEffectiveHead(op.head, dd.type)}H`, Rate: dd.rate, 'Gen Income': gi.toFixed(2) });
      }
    });
    exportToExcel({ Production: rows }, `production_${monthFilter}`);
    toast.success('Exported!');
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;
  if (prodLoading) return <div className="page-container"><PageLoader text="Loading Production..." /></div>;

  let grandProd = 0, grandGI = 0;
  monthSheets.forEach(s => { const op = getOperator(s.operatorId); if (!op) return; Object.values(s.days).forEach(d => { grandProd += Number(d.production || 0); grandGI += calcGenIncome(d.production, op.head, d.type, d.rate); }); });

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Production</h1><p className="page-subtitle">Monthly 31-day production sheets</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}>
            <option value="all">All Operators</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name} — {o.machine}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setShowManage(true)}><Settings2 size={16} /> Manage</Button>
          <Button variant="secondary" onClick={handleExportAll}><Download size={16} /> Export All</Button>
          <Button onClick={() => { if (operators.length === 0) { toast.error('Register operators first'); return; } setShowEntryForm(true); }}><Plus size={16} /> Add Entry</Button>
        </div>
      </div>

      <div className="grid-4 prod-stats">
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Operators</p><p className="stats-card__value">{operators.length}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Sheets</p><p className="stats-card__value">{monthSheets.length}</p><p className="stats-card__subtitle">{monthFilter}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Production</p><p className="stats-card__value">{grandProd.toLocaleString()}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Gen Income</p><p className="stats-card__value" style={{ color: 'var(--color-success)' }}>{grandGI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div>
      </div>

      {monthSheets.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No sheets. Register operators or select a different filter.</p></div></div>
      ) : (
        <div className="prod-sheets-list">
          {monthSheets.map(sheet => {
            const op = getOperator(sheet.operatorId);
            if (!op) return null;
            const isOpen = openSheets[sheet.id] ?? false;
            let totalProd = 0, totalGI = 0;
            for (let d = 1; d <= numDays; d++) { const dd = sheet.days[String(d)]; if (!dd) continue; totalProd += Number(dd.production || 0); totalGI += calcGenIncome(dd.production, op.head, dd.type, dd.rate); }
            const filledDays = Object.keys(sheet.days).length;
            return (
              <div key={sheet.id} className="prod-sheet card">
                <div className="prod-sheet__header" onClick={() => toggleSheet(sheet.id)}>
                  <div className="prod-sheet__info">
                    <span className="badge badge--accent">{op.machine}</span>
                    <strong>{op.name}</strong>
                    <span className="badge badge--default">{op.head}H</span>
                    <span className="badge badge--party">{getHelperName(op.defaultHelperId)}</span>
                    <span className="badge badge--success">{filledDays}/{numDays} days</span>
                    <span className="prod-sheet__total">Prod: {totalProd.toLocaleString()} | GI: {totalGI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="prod-sheet__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); exportSheet(sheet); }} title="Export"><Download size={15} /></button>
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printSheet(sheet, op, numDays, monthNum, getHelperName, calcGenIncome); }} title="Print"><Printer size={15} /></button>
                    <button className="action-btn action-btn--danger" onClick={e => { e.stopPropagation(); if (window.confirm('Delete sheet?')) deleteSheet(sheet.id); }} title="Delete"><Trash2 size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
                {isOpen && (
                  <div className="prod-sheet__body">
                    <div className="table-wrapper">
                      <table className="data-table prod-day-table">
                        <thead><tr><th>Date</th><th>Helper</th><th>Production</th><th>Head</th><th>Rate</th><th>Substitute</th><th>Gen Income</th><th></th></tr></thead>
                        <tbody>
                          {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
                            const dd = sheet.days[String(day)];
                            if (!dd) return (
                              <tr key={day} className="prod-day-empty"><td className="prod-day-table__day">{day}-{monthNum}</td><td colSpan={7} style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</td></tr>
                            );
                            if (editingRow?.sheetId === sheet.id && editingRow?.day === day) {
                              return <EditRow key={day} day={day} monthNum={monthNum} dd={dd} helpers={helpers} op={op} operators={operators} getHelperName={getHelperName} onSave={entry => handleEditSave(sheet.id, day, entry)} onCancel={() => setEditingRow(null)} />;
                            }
                            const gi = calcGenIncome(dd.production, op.head, dd.type, dd.rate);
                            const hn = dd.useDefaultHelper ? getHelperName(op.defaultHelperId) : getHelperName(dd.extraHelperId) + ' (D)';
                            const tl = `${getEffectiveHead(op.head, dd.type)}H`;
                            const subOp = dd.substituteOperatorId ? getOperator(dd.substituteOperatorId) : null;
                            return (
                              <tr key={day} className={dd.substituteOperatorId ? 'prod-substitute-row' : ''}>
                                <td className="prod-day-table__day">{day}-{monthNum}</td>
                                <td><span className={`badge badge--${dd.useDefaultHelper ? 'default' : 'warning'}`}>{hn}</span></td>
                                <td style={{ fontWeight: 600 }}>{Number(dd.production).toLocaleString()}</td>
                                <td><span className={`badge badge--${dd.type === 'all_head' ? 'success' : dd.type === 'alternet' ? 'warning' : 'accent'}`}>{tl}</span></td>
                                <td>{Number(dd.rate).toFixed(2)}</td>
                                <td>{subOp ? <span className="badge badge--danger" title="Salary goes to this operator">{subOp.name}</span> : <span style={{color:'var(--color-text-muted)'}}>—</span>}</td>
                                <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{gi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    <button className="action-btn" onClick={() => setEditingRow({ sheetId: sheet.id, day })} title="Edit"><Pencil size={13} /></button>
                                    <button className="action-btn action-btn--danger" onClick={() => handleDeleteDay(sheet.id, day)} title="Delete"><Trash2 size={13} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot><tr><td colSpan={2} style={{ fontWeight: 700, textAlign: 'right' }}>Total:</td><td style={{ fontWeight: 700 }}>{totalProd.toLocaleString()}</td><td colSpan={3}></td><td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{totalGI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td></td></tr></tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showEntryForm} onClose={() => setShowEntryForm(false)} title="Add Production Entry">
        <EntryForm operators={operators} helpers={helpers} sheets={sheets} month={monthFilter} getHelperName={getHelperName} onSave={handleAddEntry} onCancel={() => setShowEntryForm(false)} />
      </Modal>
      <Modal isOpen={showManage} onClose={() => setShowManage(false)} title="Manage Helpers & Operators" size="lg">
        <div className="manage-section">
          <div className="manage-block">
            <div className="manage-block__header"><h4>Helpers</h4><Button onClick={() => setShowHelperForm(true)}><Plus size={14} /> Add</Button></div>
            {helpers.length === 0 ? <p className="dash-empty">No helpers.</p> : <div className="manage-list">{helpers.map(h => (<div key={h.id} className="manage-list__item"><span>{h.name}</span><button className="action-btn action-btn--danger" onClick={() => { if (operators.some(o => o.defaultHelperId === h.id)) { toast.error('Assigned to operator'); return; } deleteHelper(h.id); }}><Trash2 size={14} /></button></div>))}</div>}
          </div>
          <div className="manage-block">
            <div className="manage-block__header"><h4>Operators</h4><Button onClick={() => { if (helpers.length === 0) { toast.error('Add helpers first'); return; } setShowOperatorForm(true); }}><Plus size={14} /> Register</Button></div>
            {operators.length === 0 ? <p className="dash-empty">No operators.</p> : <div className="manage-list">{operators.map(o => (<div key={o.id} className="manage-list__item"><div><strong>{o.name}</strong><span className="badge badge--accent" style={{ marginLeft: 6 }}>{o.machine}</span><span className="badge badge--default" style={{ marginLeft: 4 }}>{o.head}H</span><span className="badge badge--party" style={{ marginLeft: 4 }}>{getHelperName(o.defaultHelperId)}</span></div><button className="action-btn action-btn--danger" onClick={() => { if (sheets.some(s => s.operatorId === o.id && Object.keys(s.days).length > 0)) { toast.error('Has data'); return; } deleteOperator(o.id); }}><Trash2 size={14} /></button></div>))}</div>}
          </div>
        </div>
      </Modal>
      <Modal isOpen={showHelperForm} onClose={() => setShowHelperForm(false)} title="Add Helper" size="sm">
        <HelperForm onSave={handleAddHelper} onCancel={() => setShowHelperForm(false)} />
      </Modal>
      <Modal isOpen={showOperatorForm} onClose={() => setShowOperatorForm(false)} title="Register Operator">
        <OperatorForm helpers={helpers} onSave={handleAddOperator} onCancel={() => setShowOperatorForm(false)} />
      </Modal>
    </div>
  );
}
