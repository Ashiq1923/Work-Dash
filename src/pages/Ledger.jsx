import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Pencil, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/FormField';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import * as db from '../lib/db';
import { exportToExcel } from '../utils/excelUtils';
import { PageLoader } from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import './Ledger.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Ledger() {
  const { activeDataKey } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAccForm, setShowAccForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [accFilter, setAccFilter] = useState('all');
  const [openAccs, setOpenAccs] = useState({});
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const months = useMemo(() => getLastNMonths(12), []);

  useEffect(() => {
    if (!activeDataKey) { setAccounts([]); setAllEntries([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([db.fetchLedgerAccounts(activeDataKey), db.fetchLedgerEntries(activeDataKey)])
      .then(([accs, ents]) => {
        setAccounts(accs.map(a => ({ id: a.id, name: a.name, userId: a.user_id })));
        setAllEntries(ents); setLoading(false);
      });
  }, [activeDataKey]);

  const filteredAccs = useMemo(() => accFilter === 'all' ? accounts : accounts.filter(a => a.id === accFilter), [accounts, accFilter]);
  const toggleAcc = (id) => setOpenAccs(p => ({ ...p, [id]: !p[id] }));

  const getAccRows = (accId) => {
    const all = allEntries.filter(e => e.accountId === accId).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.order || 0) - (b.order || 0));
    let balance = 0;
    all.forEach(e => { if (e.date < monthFilter + '-00') balance += Number(e.debit || 0) - Number(e.credit || 0); });
    const carryForward = balance;
    const monthEntries = all.filter(e => e.date?.startsWith(monthFilter));
    const rows = [];
    monthEntries.forEach(e => { balance += Number(e.debit || 0) - Number(e.credit || 0); rows.push({ ...e, balance }); });
    return { carryForward, rows };
  };

  const grandTotals = useMemo(() => {
    let debit = 0, credit = 0;
    filteredAccs.forEach(acc => { const { rows } = getAccRows(acc.id); rows.forEach(r => { debit += Number(r.debit || 0); credit += Number(r.credit || 0); }); });
    return { debit, credit };
  }, [filteredAccs, allEntries, monthFilter]);

  const handleAddAcc = async (name) => {
    if (accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) { toast.error('Already exists'); return; }
    try {
      const row = await db.insertLedgerAccount(activeDataKey, name.trim());
      setAccounts(prev => [...prev, { id: row.id, name: row.name, userId: row.user_id }]);
      toast.success(`"${name}" added`); setShowAccForm(false);
    } catch { toast.error('Failed'); }
  };

  const handleDeleteAcc = async (id) => {
    if (allEntries.some(e => e.accountId === id) && !window.confirm('Has entries. Delete all?')) return;
    await db.removeLedgerAccount(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    setAllEntries(prev => prev.filter(e => e.accountId !== id));
    toast.success('Deleted');
  };

  const handleAddEntry = async (entry) => {
    try {
      const maxOrder = allEntries.length > 0 ? Math.max(...allEntries.map(e => e.order || 0)) : 0;
      const row = await db.insertLedgerEntry(activeDataKey, { ...entry, order: maxOrder + 1 });
      const mapped = { id: row.id, userId: row.user_id, accountId: row.account_id, date: row.date, description: row.description, debit: row.debit, credit: row.credit, order: row.sort_order };
      setAllEntries(prev => [...prev, mapped].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.order || 0) - (b.order || 0)));
      toast.success('Entry added');
    } catch { toast.error('Failed'); }
  };

  const handleUpdateEntry = async (entry) => {
    try {
      await db.updateLedgerEntry(editingEntry.id, entry);
      setAllEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...entry } : e));
      toast.success('Updated'); setEditingEntry(null); setShowEntryForm(false);
    } catch { toast.error('Failed'); }
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm('Delete?')) { await db.removeLedgerEntry(id); setAllEntries(prev => prev.filter(e => e.id !== id)); toast.success('Deleted'); }
  };

  const exportAcc = (acc) => {
    const { carryForward, rows } = getAccRows(acc.id);
    const exRows = [];
    if (carryForward !== 0) exRows.push({ Date: '', Description: 'Carry Forward', Debit: '', Credit: '', Balance: carryForward.toFixed(2) });
    rows.forEach(r => exRows.push({ Date: r.date, Description: r.description || '', Debit: r.debit || '', Credit: r.credit || '', Balance: r.balance.toFixed(2) }));
    const tD = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const tC = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;
    exRows.push({ Date: 'TOTAL', Description: '', Debit: tD, Credit: tC, Balance: lastBal.toFixed(2) });
    exportToExcel({ [acc.name]: exRows }, `ledger_${acc.name}_${monthFilter}`);
    toast.success('Exported!');
  };

  const printAcc = (acc) => {
    const { carryForward, rows } = getAccRows(acc.id);
    let tD = 0, tC = 0;
    const trs = [];
    if (carryForward !== 0) trs.push(`<tr class="carry"><td></td><td><em>Carry Forward</em></td><td></td><td></td><td><strong>${fmtRS(carryForward)}</strong></td></tr>`);
    rows.forEach(r => {
      tD += Number(r.debit || 0); tC += Number(r.credit || 0);
      const d = r.date.split('-').reverse().slice(0, 2).join('-');
      trs.push(`<tr><td>${d}</td><td>${r.description || ''}</td><td class="deb">${r.debit > 0 ? fmtRS(r.debit) : ''}</td><td class="cre">${r.credit > 0 ? fmtRS(r.credit) : ''}</td><td style="font-weight:700;color:${r.balance >= 0 ? '#059669' : '#dc2626'}">${fmtRS(r.balance)}</td></tr>`);
    });
    const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;
    const html = `<!DOCTYPE html><html><head><title>Ledger - ${acc.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:6px}p{font-size:12px;color:#666;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f0f0f0;font-weight:600}.carry td{background:#f8f8f8}.deb{color:#059669}.cre{color:#dc2626}.total td{font-weight:700;border-top:2px solid #333}@media print{body{padding:10px}}</style></head><body><h1>Ledger — ${acc.name}</h1><p>Month: ${monthFilter}</p><table><thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>${trs.join('')}</tbody><tfoot><tr class="total"><td colspan="2" style="text-align:right">Total:</td><td>${fmtRS(tD)}</td><td>${fmtRS(tC)}</td><td style="color:${lastBal >= 0 ? '#059669' : '#dc2626'}">${fmtRS(lastBal)}</td></tr></tfoot></table></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;
  if (loading) return <div className="page-container"><PageLoader text="Loading Ledger..." /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Ledger</h1><p className="page-subtitle">Party accounts — Debit / Credit / Balance</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={accFilter} onChange={e => setAccFilter(e.target.value)}>
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setShowAccForm(true)}><Plus size={16} /> Add Account</Button>
          <Button onClick={() => { if (accounts.length === 0) { toast.error('Add account first'); return; } setEditingEntry(null); setShowEntryForm(true); }}><Plus size={16} /> Add Entry</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Accounts</p><p className="stats-card__value">{accounts.length}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Debit</p><p className="stats-card__value" style={{ color: 'var(--color-success)' }}>{fmtRS(grandTotals.debit)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Credit</p><p className="stats-card__value" style={{ color: 'var(--color-danger)' }}>{fmtRS(grandTotals.credit)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Net Balance</p><p className="stats-card__value" style={{ color: (grandTotals.debit - grandTotals.credit) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(grandTotals.debit - grandTotals.credit)}</p></div></div>
      </div>

      {filteredAccs.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No accounts. Add a party account to start.</p></div></div>
      ) : (
        <div className="ledger-sheets-list">
          {filteredAccs.map(acc => {
            const isOpen = openAccs[acc.id] ?? false;
            const { carryForward, rows } = getAccRows(acc.id);
            const tD = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
            const tC = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
            const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;
            return (
              <div key={acc.id} className="ledger-sheet card">
                <div className="ledger-sheet__header" onClick={() => toggleAcc(acc.id)}>
                  <div className="ledger-sheet__info">
                    <strong className="ledger-sheet__name">{acc.name}</strong>
                    <span className="badge badge--default">{rows.length} entries</span>
                    <span className="ledger-sheet__summary">Dr: {fmtRS(tD)} | Cr: {fmtRS(tC)} | Bal: <span style={{ color: lastBal >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(lastBal)}</span></span>
                  </div>
                  <div className="ledger-sheet__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); exportAcc(acc); }} title="Export"><Download size={15} /></button>
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printAcc(acc); }} title="Print"><Printer size={15} /></button>
                    <button className="action-btn action-btn--danger" onClick={e => { e.stopPropagation(); handleDeleteAcc(acc.id); }} title="Delete"><Trash2 size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
                {isOpen && (
                  <div className="ledger-sheet__body">
                    <div className="table-wrapper">
                      <table className="data-table ledger-table">
                        <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead>
                        <tbody>
                          {carryForward !== 0 && (<tr className="ledger-carry"><td></td><td style={{ fontWeight: 600, fontStyle: 'italic' }}>Carry Forward</td><td></td><td></td><td style={{ fontWeight: 700 }}>{fmtRS(carryForward)}</td><td></td></tr>)}
                          {rows.length === 0 && carryForward === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 20 }}>No entries this month.</td></tr>
                          ) : rows.map(r => (
                            <tr key={r.id}>
                              <td className="ledger-date">{r.date.split('-').reverse().slice(0, 2).join('-')}</td>
                              <td style={{ fontWeight: 500 }}>{r.description || '—'}</td>
                              <td className="ledger-debit-cell">{r.debit > 0 ? fmtRS(r.debit) : ''}</td>
                              <td className="ledger-credit-cell">{r.credit > 0 ? fmtRS(r.credit) : ''}</td>
                              <td style={{ fontWeight: 700, color: r.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(r.balance)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  <button className="action-btn" onClick={() => { setEditingEntry(r); setShowEntryForm(true); }}><Pencil size={13} /></button>
                                  <button className="action-btn action-btn--danger" onClick={() => handleDeleteEntry(r.id)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr><td style={{ fontWeight: 700, textAlign: 'right' }}>Total:</td><td></td><td className="ledger-debit-cell" style={{ fontWeight: 700 }}>{fmtRS(tD)}</td><td className="ledger-credit-cell" style={{ fontWeight: 700 }}>{fmtRS(tC)}</td><td style={{ fontWeight: 800, color: lastBal >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRS(lastBal)}</td><td></td></tr></tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showAccForm} onClose={() => setShowAccForm(false)} title="Add Party Account" size="sm">
        <AccForm onSave={handleAddAcc} onCancel={() => setShowAccForm(false)} />
      </Modal>
      <Modal isOpen={showEntryForm} onClose={() => { setShowEntryForm(false); setEditingEntry(null); }} title={editingEntry ? 'Edit Entry' : 'Add Ledger Entry'}>
        <EntryForm accounts={accounts} initial={editingEntry} onSave={editingEntry ? handleUpdateEntry : handleAddEntry} onCancel={() => { setShowEntryForm(false); setEditingEntry(null); }} />
      </Modal>
    </div>
  );
}

function AccForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) { toast.error('Name required'); return; } onSave(name); }} className="form-grid">
      <Input label="Party / Account Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rujhan Ind" required autoFocus />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add Account</Button></div>
    </form>
  );
}

function EntryForm({ accounts, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { accountId: accounts[0]?.id || '', description: '', debit: '', credit: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!form.accountId) { toast.error('Select account'); return; }
      if (!form.debit && !form.credit) { toast.error('Enter debit or credit'); return; }
      onSave({ accountId: form.accountId, description: form.description, debit: Number(form.debit) || 0, credit: Number(form.credit) || 0, date: form.date });
      set('description', ''); set('debit', ''); set('credit', '');
    }} className="form-grid">
      <div style={{ gridColumn: '1/-1' }}>
        <label className="form-field__label">Account *</label>
        <select className="form-input" value={form.accountId} onChange={e => set('accountId', e.target.value)}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      <Input label="Description (Invoice # / Detail)" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. INV-001 / 50 pcs delivered" />
      <Input label="Debit (Rs)" type="number" min="0" step="0.01" value={form.debit} onChange={e => set('debit', e.target.value)} placeholder="0" />
      <Input label="Credit (Rs)" type="number" min="0" step="0.01" value={form.credit} onChange={e => set('credit', e.target.value)} placeholder="0" />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{initial ? 'Update' : 'Add Entry'}</Button></div>
    </form>
  );
}
