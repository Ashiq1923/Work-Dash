import { useState, useMemo } from 'react';
import { Plus, Trash2, Download, Pencil, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/FormField';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { exportToExcel } from '../utils/excelUtils';
import toast from 'react-hot-toast';
import './Thread.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Thread() {
  const { activeDataKey } = useAuth();
  const [data, setData] = useState(() => loadFromStorage(STORAGE_KEYS.THREAD, { accounts: [], entries: [] }));
  const [showAccForm, setShowAccForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [accFilter, setAccFilter] = useState('all');
  const [openAccs, setOpenAccs] = useState({});
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const months = useMemo(() => getLastNMonths(12), []);

  const save = (d) => { saveToStorage(STORAGE_KEYS.THREAD, d); setData(d); };

  const accounts = useMemo(() => data.accounts.filter(a => a.userId === activeDataKey), [data.accounts, activeDataKey]);
  const allEntries = useMemo(() => data.entries.filter(e => e.userId === activeDataKey), [data.entries, activeDataKey]);

  const getAccName = (id) => accounts.find(a => a.id === id)?.name || '?';
  const toggleAcc = (id) => setOpenAccs(p => ({ ...p, [id]: !p[id] }));

  const filteredAccs = useMemo(() => {
    if (accFilter === 'all') return accounts;
    return accounts.filter(a => a.id === accFilter);
  }, [accounts, accFilter]);

  // Get entries for an account, sorted by date+order
  const getAccEntries = (accId) => {
    return allEntries.filter(e => e.accountId === accId).sort((a, b) => a.date.localeCompare(b.date) || (a.order || 0) - (b.order || 0));
  };

  // Get entries for account filtered by month, with running balance
  const getAccRows = (accId) => {
    const all = getAccEntries(accId);
    let balance = 0;
    // Carry forward from before this month
    all.forEach(e => {
      if (e.date < monthFilter + '-00') {
        balance += Number(e.amount || 0) - Number(e.pay || 0);
      }
    });
    const carryForward = balance;
    const monthEntries = all.filter(e => e.date?.startsWith(monthFilter));
    const rows = [];
    monthEntries.forEach(e => {
      balance += Number(e.amount || 0) - Number(e.pay || 0);
      rows.push({ ...e, balance });
    });
    return { carryForward, rows };
  };

  // Totals
  const grandTotals = useMemo(() => {
    let totalAmt = 0, totalPay = 0;
    filteredAccs.forEach(acc => {
      const { rows } = getAccRows(acc.id);
      rows.forEach(r => { totalAmt += Number(r.amount || 0); totalPay += Number(r.pay || 0); });
    });
    return { totalAmt, totalPay };
  }, [filteredAccs, allEntries, monthFilter]);

  // Add account
  const handleAddAcc = (name) => {
    if (accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) { toast.error('Account already exists'); return; }
    const acc = { id: generateId(), name: name.trim(), userId: activeDataKey };
    save({ ...data, accounts: [...data.accounts, acc] });
    toast.success(`Account "${name}" added`);
    setShowAccForm(false);
  };

  const handleDeleteAcc = (id) => {
    const hasEntries = allEntries.some(e => e.accountId === id);
    if (hasEntries && !window.confirm('Account has entries. Delete all?')) return;
    save({ accounts: data.accounts.filter(a => a.id !== id), entries: data.entries.filter(e => e.accountId !== id) });
    toast.success('Account deleted');
  };

  // Add entry
  const handleAddEntry = (entry) => {
    const maxOrder = allEntries.length > 0 ? Math.max(...allEntries.map(e => e.order || 0)) : 0;
    const newEntry = { ...entry, id: generateId(), userId: activeDataKey, order: maxOrder + 1 };
    save({ ...data, entries: [...data.entries, newEntry] });
    toast.success('Entry added');
  };

  const handleUpdateEntry = (entry) => {
    save({ ...data, entries: data.entries.map(e => e.id === editingEntry.id ? { ...editingEntry, ...entry } : e) });
    toast.success('Updated');
    setEditingEntry(null); setShowEntryForm(false);
  };

  const handleDeleteEntry = (id) => {
    if (window.confirm('Delete?')) { save({ ...data, entries: data.entries.filter(e => e.id !== id) }); toast.success('Deleted'); }
  };

  // Export single account
  const exportAcc = (acc) => {
    const { carryForward, rows } = getAccRows(acc.id);
    const exRows = [];
    if (carryForward !== 0) exRows.push({ Date: '', Description: 'Carry Forward', Amount: '', Pay: '', Balance: carryForward.toFixed(2) });
    rows.forEach(r => exRows.push({ Date: r.date, Description: r.description || '', Amount: r.amount || '', Pay: r.pay || '', Balance: r.balance.toFixed(2) }));
    const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;
    const tAmt = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const tPay = rows.reduce((s, r) => s + Number(r.pay || 0), 0);
    exRows.push({ Date: 'TOTAL', Description: '', Amount: tAmt, Pay: tPay, Balance: lastBal.toFixed(2) });
    exportToExcel({ [acc.name]: exRows }, `thread_${acc.name}_${monthFilter}`);
    toast.success('Exported!');
  };

  // Print single account
  const printAcc = (acc) => {
    const { carryForward, rows } = getAccRows(acc.id);
    let tAmt = 0, tPay = 0;
    const trs = [];
    if (carryForward !== 0) trs.push(`<tr class="carry"><td></td><td><em>Carry Forward</em></td><td></td><td></td><td><strong>${fmtRS(carryForward)}</strong></td></tr>`);
    rows.forEach(r => {
      tAmt += Number(r.amount || 0); tPay += Number(r.pay || 0);
      const d = r.date.split('-').reverse().slice(0, 2).join('-');
      trs.push(`<tr><td>${d}</td><td>${r.description || ''}</td><td class="${r.amount > 0 ? 'amt' : ''}">${r.amount > 0 ? fmtRS(r.amount) : ''}</td><td class="${r.pay > 0 ? 'pay' : ''}">${r.pay > 0 ? fmtRS(r.pay) : ''}</td><td style="font-weight:700;color:${r.balance >= 0 ? '#059669' : '#dc2626'}">${fmtRS(r.balance)}</td></tr>`);
    });
    const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;
    const html = `<!DOCTYPE html><html><head><title>Thread - ${acc.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:18px;margin-bottom:4px;border-bottom:2px solid #333;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f0f0f0;font-weight:600}.carry td{background:#f8f8f8;font-style:italic}.amt{color:#059669}.pay{color:#dc2626}.total td{font-weight:700;border-top:2px solid #333}@media print{body{padding:10px}}</style></head><body><h1>Thread Account — ${acc.name}</h1><p style="font-size:12px;color:#666;margin:6px 0">Month: ${monthFilter}</p><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Pay</th><th>Balance</th></tr></thead><tbody>${trs.join('')}</tbody><tfoot><tr class="total"><td colspan="2" style="text-align:right">Total:</td><td>${fmtRS(tAmt)}</td><td>${fmtRS(tPay)}</td><td style="color:${lastBal >= 0 ? '#059669' : '#dc2626'}">${fmtRS(lastBal)}</td></tr></tfoot></table></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Thread</h1><p className="page-subtitle">Thread accounts — Amount / Pay / Balance</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={accFilter} onChange={e => setAccFilter(e.target.value)}>
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setShowAccForm(true)}><Plus size={16} /> Add Account</Button>
          <Button onClick={() => {
            if (accounts.length === 0) { toast.error('Add account first'); return; }
            setEditingEntry(null); setShowEntryForm(true);
          }}><Plus size={16} /> Add Entry</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Accounts</p><p className="stats-card__value">{accounts.length}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Amount</p><p className="stats-card__value" style={{ color: 'var(--color-danger)' }}>{fmtRS(grandTotals.totalAmt)}</p><p className="stats-card__subtitle">{monthFilter}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Pay</p><p className="stats-card__value" style={{ color: 'var(--color-success)' }}>{fmtRS(grandTotals.totalPay)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Net Balance</p><p className="stats-card__value" style={{ color: (grandTotals.totalAmt - grandTotals.totalPay) >= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRS(grandTotals.totalAmt - grandTotals.totalPay)}</p><p className="stats-card__subtitle">Remaining</p></div></div>
      </div>

      {/* Account Sheets */}
      {filteredAccs.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No accounts. Add an account to start tracking.</p></div></div>
      ) : (
        <div className="thread-sheets-list">
          {filteredAccs.map(acc => {
            const isOpen = openAccs[acc.id] ?? false;
            const { carryForward, rows } = getAccRows(acc.id);
            const tAmt = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
            const tPay = rows.reduce((s, r) => s + Number(r.pay || 0), 0);
            const lastBal = rows.length > 0 ? rows[rows.length - 1].balance : carryForward;

            return (
              <div key={acc.id} className="thread-sheet card">
                <div className="thread-sheet__header" onClick={() => toggleAcc(acc.id)}>
                  <div className="thread-sheet__info">
                    <strong className="thread-sheet__name">{acc.name}</strong>
                    <span className="badge badge--default">{rows.length} entries</span>
                    <span className="thread-sheet__summary">
                      Amt: {fmtRS(tAmt)} | Pay: {fmtRS(tPay)} | Bal: <span style={{ color: lastBal > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRS(lastBal)}</span>
                    </span>
                  </div>
                  <div className="thread-sheet__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); exportAcc(acc); }} title="Export"><Download size={15} /></button>
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printAcc(acc); }} title="Print"><Printer size={15} /></button>
                    <button className="action-btn action-btn--danger" onClick={e => { e.stopPropagation(); handleDeleteAcc(acc.id); }} title="Delete Account"><Trash2 size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div className="thread-sheet__body">
                    <div className="table-wrapper">
                      <table className="data-table thread-table">
                        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Pay</th><th>Balance</th><th></th></tr></thead>
                        <tbody>
                          {carryForward !== 0 && (
                            <tr className="thread-carry"><td></td><td style={{ fontWeight: 600, fontStyle: 'italic' }}>Carry Forward</td><td></td><td></td><td style={{ fontWeight: 700 }}>{fmtRS(carryForward)}</td><td></td></tr>
                          )}
                          {rows.length === 0 && carryForward === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 20 }}>No entries this month.</td></tr>
                          ) : rows.map(r => (
                            <tr key={r.id}>
                              <td className="thread-date">{r.date.split('-').reverse().slice(0, 2).join('-')}</td>
                              <td style={{ fontWeight: 500 }}>{r.description || '—'}</td>
                              <td className="thread-amt-cell">{r.amount > 0 ? fmtRS(r.amount) : ''}</td>
                              <td className="thread-pay-cell">{r.pay > 0 ? fmtRS(r.pay) : ''}</td>
                              <td style={{ fontWeight: 700, color: r.balance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRS(r.balance)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  <button className="action-btn" onClick={() => { setEditingEntry(r); setShowEntryForm(true); }}><Pencil size={13} /></button>
                                  <button className="action-btn action-btn--danger" onClick={() => handleDeleteEntry(r.id)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={{ fontWeight: 700, textAlign: 'right' }}>Total:</td><td></td>
                            <td className="thread-amt-cell" style={{ fontWeight: 700 }}>{fmtRS(tAmt)}</td>
                            <td className="thread-pay-cell" style={{ fontWeight: 700 }}>{fmtRS(tPay)}</td>
                            <td style={{ fontWeight: 800, color: lastBal > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRS(lastBal)}</td>
                            <td></td>
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

      {/* Add Account Modal */}
      <Modal isOpen={showAccForm} onClose={() => setShowAccForm(false)} title="Add Thread Account" size="sm">
        <AccForm onSave={handleAddAcc} onCancel={() => setShowAccForm(false)} />
      </Modal>

      {/* Add/Edit Entry Modal */}
      <Modal isOpen={showEntryForm} onClose={() => { setShowEntryForm(false); setEditingEntry(null); }} title={editingEntry ? 'Edit Entry' : 'Add Entry'}>
        <EntryForm accounts={accounts} initial={editingEntry} onSave={editingEntry ? handleUpdateEntry : handleAddEntry} onCancel={() => { setShowEntryForm(false); setEditingEntry(null); }} />
      </Modal>
    </div>
  );
}

function AccForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) { toast.error('Name required'); return; } onSave(name); }} className="form-grid">
      <Input label="Account Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Al-Madina Thread" required autoFocus />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add Account</Button></div>
    </form>
  );
}

function EntryForm({ accounts, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { accountId: accounts[0]?.id || '', description: '', amount: '', pay: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!form.accountId) { toast.error('Select account'); return; }
      if (!form.amount && !form.pay) { toast.error('Enter amount or pay'); return; }
      onSave({ accountId: form.accountId, description: form.description, amount: Number(form.amount) || 0, pay: Number(form.pay) || 0, date: form.date });
      // Reset for quick multi-entry
      set('description', ''); set('amount', ''); set('pay', '');
    }} className="form-grid">
      <Select label="Account *" value={form.accountId} onChange={e => set('accountId', e.target.value)}>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. 10 Bobin white" />
      <Input label="Amount (Rs) — Thread liya" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
      <Input label="Pay (Rs) — Paisa diya" type="number" min="0" step="0.01" value={form.pay} onChange={e => set('pay', e.target.value)} placeholder="0" />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{initial ? 'Update' : 'Add Entry'}</Button></div>
    </form>
  );
}
