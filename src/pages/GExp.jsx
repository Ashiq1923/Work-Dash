import { useState, useMemo } from 'react';
import { Plus, Trash2, Download, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/FormField';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { exportToExcel } from '../utils/excelUtils';
import toast from 'react-hot-toast';
import './GExp.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GExp() {
  const { activeDataKey } = useAuth();
  const [allEntries, setAllEntries] = useState(() => loadFromStorage(STORAGE_KEYS.GEXP, []));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const months = useMemo(() => getLastNMonths(12), []);

  const save = (data) => { saveToStorage(STORAGE_KEYS.GEXP, data); setAllEntries(data); };

  // All entries for this user, sorted by date then by order added
  const userEntries = useMemo(() =>
    allEntries.filter(e => e.userId === activeDataKey).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order),
  [allEntries, activeDataKey]);

  // Filtered by month
  const filtered = useMemo(() =>
    userEntries.filter(e => e.date?.startsWith(monthFilter)),
  [userEntries, monthFilter]);

  // Calculate running balance
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    // Get carry-forward: all entries BEFORE this month
    userEntries.forEach(e => {
      if (e.date < monthFilter + '-00') {
        balance += Number(e.debit || 0) - Number(e.credit || 0);
      }
    });
    const carryForward = balance;
    const rows = [];
    filtered.forEach(e => {
      balance += Number(e.debit || 0) - Number(e.credit || 0);
      rows.push({ ...e, balance });
    });
    return { carryForward, rows };
  }, [filtered, userEntries, monthFilter]);

  const totalDebit = filtered.reduce((s, e) => s + Number(e.debit || 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + Number(e.credit || 0), 0);
  const finalBalance = rowsWithBalance.rows.length > 0 ? rowsWithBalance.rows[rowsWithBalance.rows.length - 1].balance : rowsWithBalance.carryForward;

  const handleAdd = (data) => {
    const maxOrder = userEntries.length > 0 ? Math.max(...userEntries.map(e => e.order || 0)) : 0;
    const entry = { ...data, id: generateId(), userId: activeDataKey, order: maxOrder + 1 };
    save([...allEntries, entry]);
    toast.success('Entry added');
    setShowForm(false);
  };

  const handleUpdate = (data) => {
    save(allEntries.map(e => e.id === editing.id ? { ...editing, ...data } : e));
    toast.success('Updated');
    setEditing(null); setShowForm(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete?')) { save(allEntries.filter(e => e.id !== id)); toast.success('Deleted'); }
  };

  const handleExport = () => {
    const rows = rowsWithBalance.rows.map(e => ({
      Date: e.date, Component: e.component, Debit: e.debit || '', Credit: e.credit || '', Balance: e.balance.toFixed(2)
    }));
    if (rowsWithBalance.carryForward !== 0) {
      rows.unshift({ Date: '', Component: 'Carry Forward', Debit: '', Credit: '', Balance: rowsWithBalance.carryForward.toFixed(2) });
    }
    rows.push({ Date: 'TOTAL', Component: '', Debit: totalDebit, Credit: totalCredit, Balance: finalBalance.toFixed(2) });
    exportToExcel({ 'G-Exp': rows }, `g-exp_${monthFilter}`);
    toast.success('Exported!');
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">G-Exp</h1><p className="page-subtitle">General Expenses — Debit / Credit Ledger</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="secondary" onClick={handleExport}><Download size={16} /> Export</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Add Entry</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Debit</p><p className="stats-card__value" style={{ color: 'var(--color-success)' }}>{fmtRS(totalDebit)}</p><p className="stats-card__subtitle">Received</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Credit</p><p className="stats-card__value" style={{ color: 'var(--color-danger)' }}>{fmtRS(totalCredit)}</p><p className="stats-card__subtitle">Spent</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Balance</p><p className="stats-card__value" style={{ color: finalBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(finalBalance)}</p><p className="stats-card__subtitle">Remaining</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Entries</p><p className="stats-card__value">{filtered.length}</p><p className="stats-card__subtitle">{monthFilter}</p></div></div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table gexp-table">
            <thead><tr><th>Date</th><th>Component</th><th>Debit (Received)</th><th>Credit (Spent)</th><th>Balance</th><th></th></tr></thead>
            <tbody>
              {rowsWithBalance.carryForward !== 0 && (
                <tr className="gexp-carry"><td></td><td style={{ fontWeight: 600, fontStyle: 'italic' }}>Carry Forward</td><td></td><td></td><td style={{ fontWeight: 700 }}>{fmtRS(rowsWithBalance.carryForward)}</td><td></td></tr>
              )}
              {rowsWithBalance.rows.length === 0 && rowsWithBalance.carryForward === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 30 }}>No entries. Click "Add Entry" to start.</td></tr>
              ) : rowsWithBalance.rows.map(e => (
                <tr key={e.id} className={e.debit > 0 ? 'gexp-debit-row' : 'gexp-credit-row'}>
                  <td className="gexp-date">{e.date.split('-').reverse().slice(0, 2).join('-')}</td>
                  <td style={{ fontWeight: 500 }}>{e.component}</td>
                  <td className="gexp-debit-cell">{e.debit > 0 ? fmtRS(e.debit) : ''}</td>
                  <td className="gexp-credit-cell">{e.credit > 0 ? fmtRS(e.credit) : ''}</td>
                  <td style={{ fontWeight: 700, color: e.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(e.balance)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="action-btn" onClick={() => { setEditing(e); setShowForm(true); }}><Pencil size={13} /></button>
                      <button className="action-btn action-btn--danger" onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>Total:</td><td></td>
                <td className="gexp-debit-cell" style={{ fontWeight: 700 }}>{fmtRS(totalDebit)}</td>
                <td className="gexp-credit-cell" style={{ fontWeight: 700 }}>{fmtRS(totalCredit)}</td>
                <td style={{ fontWeight: 800, color: finalBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(finalBalance)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Entry' : 'Add Entry'}>
        <GExpForm initial={editing} onSave={editing ? handleUpdate : handleAdd} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}

function GExpForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { component: '', debit: '', credit: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [type, setType] = useState(initial ? (initial.debit > 0 ? 'debit' : 'credit') : 'debit');

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!form.component) { toast.error('Component required'); return; }
      const amt = Number(form.debit || form.credit || 0);
      if (amt <= 0) { toast.error('Enter amount'); return; }
      const entry = {
        component: form.component,
        debit: type === 'debit' ? amt : 0,
        credit: type === 'credit' ? amt : 0,
        date: form.date,
      };
      onSave(entry);
    }} className="form-grid">
      <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      <Input label="Component / Description *" value={form.component} onChange={e => set('component', e.target.value)} placeholder="e.g. Received funds / 1 Bobin" required />
      <div className="gexp-type-toggle">
        <label className="form-field__label">Type</label>
        <div className="gexp-type-btns">
          <button type="button" className={`gexp-type-btn ${type === 'debit' ? 'gexp-type-btn--active-debit' : ''}`} onClick={() => setType('debit')}>Debit (Received)</button>
          <button type="button" className={`gexp-type-btn ${type === 'credit' ? 'gexp-type-btn--active-credit' : ''}`} onClick={() => setType('credit')}>Credit (Spent)</button>
        </div>
      </div>
      <Input label={type === 'debit' ? 'Amount Received (Rs) *' : 'Amount Spent (Rs) *'} type="number" min="0" step="0.01" value={type === 'debit' ? (form.debit || '') : (form.credit || '')} onChange={e => { if (type === 'debit') set('debit', e.target.value); else set('credit', e.target.value); }} required />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{initial ? 'Update' : 'Add'}</Button></div>
    </form>
  );
}
