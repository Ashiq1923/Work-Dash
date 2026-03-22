import { useState, useMemo, useEffect } from 'react';
import { Download, Printer, ChevronDown, ChevronUp, Plus, Trash2, Pencil } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/FormField';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import * as db from '../lib/db';
import { exportToExcel } from '../utils/excelUtils';
import { PageLoader } from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import './SalarySheet.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function calcBonus(p) { if (p < 400000) return 0; return 100 + Math.floor((p - 400000) / 50000) * 50; }
function isSunday(y, m, d) { return new Date(y, m - 1, d).getDay() === 0; }

export default function SalarySheet() {
  const { operators, sheets, getHelperName } = useProduction();
  const { activeDataKey } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [allWorkerSalary, setAllWorkerSalary] = useState([]);
  const [allAdvances, setAllAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [openSheets, setOpenSheets] = useState({});
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [editingWorkerSalary, setEditingWorkerSalary] = useState(null);
  const months = useMemo(() => getLastNMonths(12), []);
  const [year, monthNum] = monthFilter.split('-').map(Number);
  const numDays = new Date(year, monthNum, 0).getDate();

  useEffect(() => {
    if (!activeDataKey) { setWorkers([]); setAllWorkerSalary([]); setAllAdvances([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([db.fetchWorkers(activeDataKey), db.fetchWorkerSalaryEntries(activeDataKey), db.fetchAdvances(activeDataKey)])
      .then(([w, s, a]) => {
        setWorkers(w.map(x => ({ id: x.id, name: x.name, userId: x.user_id })));
        setAllWorkerSalary(s); setAllAdvances(a); setLoading(false);
      });
  }, [activeDataKey]);

  const toggleSheet = (id) => setOpenSheets(p => ({ ...p, [id]: !p[id] }));

  const calcOpSalary = (op) => {
    const sheet = sheets.find(s => s.operatorId === op.id && s.month === monthFilter);
    let totalProd = 0, totalBonus = 0, totalSalary = 0, workDays = 0;
    for (let d = 1; d <= numDays; d++) {
      const dd = sheet?.days[String(d)];
      if (!dd || dd.substituteOperatorId) continue;
      const prod = Number(dd.production) || 0;
      const sun = isSunday(year, monthNum, d);
      const disp = sun ? prod * 2 : prod;
      const bonus = calcBonus(prod);
      const rate = Number(op.head) === 30 ? 280 : 240;
      totalProd += disp; totalBonus += bonus; totalSalary += (disp / 100000) * rate + bonus; workDays++;
    }
    sheets.forEach(s => {
      if (s.operatorId === op.id || s.month !== monthFilter) return;
      Object.entries(s.days || {}).forEach(([dayStr, dd]) => {
        if (dd.substituteOperatorId === op.id) {
          const prod = Number(dd.production) || 0;
          const sun = isSunday(year, monthNum, Number(dayStr));
          const disp = sun ? prod * 2 : prod;
          const bonus = calcBonus(prod);
          const rate = Number(op.head) === 30 ? 280 : 240;
          totalProd += disp; totalBonus += bonus; totalSalary += (disp / 100000) * rate + bonus; workDays++;
        }
      });
    });
    const opAdvances = allAdvances.filter(a => a.personId === op.id && a.personType === 'operator' && a.date?.startsWith(monthFilter));
    const totalAdvance = opAdvances.reduce((s, a) => s + Number(a.amount || 0), 0);
    return { totalProd, totalBonus, totalSalary, workDays, advances: opAdvances, totalAdvance, netSalary: totalSalary - totalAdvance };
  };

  const getWorkerSalary = (workerId) => {
    const entries = allWorkerSalary.filter(e => e.workerId === workerId && e.date?.startsWith(monthFilter));
    const total = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
    const advances = allAdvances.filter(a => a.personId === workerId && a.personType === 'worker' && a.date?.startsWith(monthFilter));
    const totalAdvance = advances.reduce((s, a) => s + Number(a.amount || 0), 0);
    return { entries, total, advances, totalAdvance, netSalary: total - totalAdvance };
  };

  const grandTotals = useMemo(() => {
    let opSalary = 0, opNet = 0, wSalary = 0, wNet = 0;
    operators.forEach(op => { const d = calcOpSalary(op); opSalary += d.totalSalary; opNet += d.netSalary; });
    workers.forEach(w => { const d = getWorkerSalary(w.id); wSalary += d.total; wNet += d.netSalary; });
    return { opSalary, opNet, wSalary, wNet, total: opSalary + wSalary, totalNet: opNet + wNet };
  }, [operators, workers, sheets, allWorkerSalary, allAdvances, monthFilter]);

  // Worker CRUD
  const addWorker = async (name) => {
    if (workers.some(w => w.name.toLowerCase() === name.toLowerCase())) { toast.error('Already exists'); return; }
    try {
      const row = await db.insertWorker(activeDataKey, name.trim());
      setWorkers(prev => [...prev, { id: row.id, name: row.name, userId: row.user_id }]);
      toast.success(`"${name}" added`); setShowWorkerForm(false);
    } catch { toast.error('Failed'); }
  };
  const deleteWorker = async (id) => {
    if (window.confirm('Delete worker?')) {
      await db.removeWorker(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
      setAllWorkerSalary(prev => prev.filter(e => e.workerId !== id));
      setAllAdvances(prev => prev.filter(a => !(a.personId === id && a.personType === 'worker')));
      toast.success('Deleted');
    }
  };

  const addWorkerSalary = async (entry) => {
    try {
      const row = await db.insertWorkerSalaryEntry(activeDataKey, entry);
      const mapped = { id: row.id, userId: row.user_id, workerId: row.worker_id, date: row.date, description: row.description, amount: row.amount };
      setAllWorkerSalary(prev => [...prev, mapped]);
      toast.success('Salary entry added');
    } catch { toast.error('Failed'); }
  };
  const updateWorkerSalary = async (entry) => {
    try {
      await db.updateWorkerSalaryEntry(editingWorkerSalary.id, entry);
      setAllWorkerSalary(prev => prev.map(e => e.id === editingWorkerSalary.id ? { ...e, ...entry } : e));
      toast.success('Updated'); setEditingWorkerSalary(null); setShowSalaryForm(false);
    } catch { toast.error('Failed'); }
  };
  const deleteWorkerSalary = async (id) => {
    if (window.confirm('Delete?')) { await db.removeWorkerSalaryEntry(id); setAllWorkerSalary(prev => prev.filter(e => e.id !== id)); toast.success('Deleted'); }
  };

  const addAdvance = async (entry) => {
    try {
      const row = await db.insertAdvance(activeDataKey, entry);
      const mapped = { id: row.id, userId: row.user_id, personId: row.person_id, personType: row.person_type, date: row.date, description: row.description, amount: row.amount };
      setAllAdvances(prev => [...prev, mapped]);
      toast.success('Advance added');
    } catch { toast.error('Failed'); }
  };
  const deleteAdvance = async (id) => {
    if (window.confirm('Delete?')) { await db.removeAdvance(id); setAllAdvances(prev => prev.filter(a => a.id !== id)); toast.success('Deleted'); }
  };

  const printPerson = (name, salary, advances, totalAdv, net, extra) => {
    const advRows = advances.map(a => `<tr><td>${a.date}</td><td>${a.description || 'Advance'}</td><td class="neg">${fmtRS(a.amount)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Salary - ${name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f0f0f0}.neg{color:#dc2626}.net{font-size:16px;font-weight:800;border-top:3px solid #333}@media print{body{padding:10px}}</style></head><body><h1>Salary Sheet — ${name}</h1><p style="font-size:12px;color:#666;margin-bottom:12px">Month: ${monthFilter}${extra ? ' | ' + extra : ''}</p><table><tbody><tr><td><strong>Base Salary</strong></td><td><strong>${fmtRS(salary)}</strong></td></tr>${advRows ? `<tr><td colspan="2" style="background:#f8f8f8;font-weight:600">Advances</td></tr>${advRows}<tr><td>Total Advance</td><td class="neg">${fmtRS(totalAdv)}</td></tr>` : ''}<tr class="net"><td>NET SALARY</td><td style="color:${net >= 0 ? '#059669' : '#dc2626'}">${fmtRS(net)}</td></tr></tbody></table></body></html>`;
    const w = window.open('', '_blank', 'width=700,height=500');
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;
  if (loading) return <div className="page-container"><PageLoader text="Loading Salary Sheet..." /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Salary Sheet</h1><p className="page-subtitle">Operators (auto) + Workers (manual) + Advances</p></div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setShowWorkerForm(true)}><Plus size={16} /> Add Worker</Button>
          <Button variant="secondary" onClick={() => { if (workers.length === 0) { toast.error('Add workers first'); return; } setEditingWorkerSalary(null); setShowSalaryForm(true); }}><Plus size={16} /> Worker Salary</Button>
          <Button onClick={() => { if (operators.length === 0 && workers.length === 0) { toast.error('No one to add advance for'); return; } setShowAdvanceForm(true); }}><Plus size={16} /> Advance</Button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Op. Salary</p><p className="stats-card__value" style={{ color: 'var(--color-accent)' }}>{fmtRS(grandTotals.opSalary)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Worker Salary</p><p className="stats-card__value" style={{ color: 'var(--color-warning)' }}>{fmtRS(grandTotals.wSalary)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Salary</p><p className="stats-card__value">{fmtRS(grandTotals.total)}</p></div></div>
        <div className="stats-card"><div className="stats-card__content"><p className="stats-card__title">Total Net</p><p className="stats-card__value" style={{ color: 'var(--color-success)' }}>{fmtRS(grandTotals.totalNet)}</p><p className="stats-card__subtitle">After advances</p></div></div>
      </div>

      <h3 className="ss-section-title">Operators (Auto from Production)</h3>
      <div className="ss-list">
        {operators.length === 0 ? <div className="card"><p className="ss-empty">No operators registered.</p></div> :
          operators.map(op => {
            const isOpen = openSheets[`op-${op.id}`] ?? false;
            const d = calcOpSalary(op);
            return (
              <div key={op.id} className="ss-card card">
                <div className="ss-card__header" onClick={() => toggleSheet(`op-${op.id}`)}>
                  <div className="ss-card__info">
                    <span className="badge badge--accent">{op.machine}</span><strong>{op.name}</strong><span className="badge badge--default">{op.head}H</span>
                    <span className="ss-card__summary">Salary: {fmtRS(d.totalSalary)} | Adv: {fmtRS(d.totalAdvance)} | <strong style={{ color: 'var(--color-success)' }}>Net: {fmtRS(d.netSalary)}</strong></span>
                  </div>
                  <div className="ss-card__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printPerson(op.name, d.totalSalary, d.advances, d.totalAdvance, d.netSalary, `${op.machine} | ${op.head}H`); }} title="Print"><Printer size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
                {isOpen && (
                  <div className="ss-card__body">
                    <div className="ss-details">
                      <div className="ss-row"><span>Production</span><span className="ss-row__val">{d.totalProd.toLocaleString()}</span></div>
                      <div className="ss-row"><span>Days</span><span className="ss-row__val">{d.workDays}</span></div>
                      <div className="ss-row"><span>Bonus</span><span className="ss-row__val">{fmtRS(d.totalBonus)}</span></div>
                      <div className="ss-row ss-row--highlight"><span>Base Salary</span><span className="ss-row__val">{fmtRS(d.totalSalary)}</span></div>
                      {d.advances.length > 0 && (<>
                        <div className="ss-adv-title">Advances</div>
                        {d.advances.map(a => (
                          <div key={a.id} className="ss-adv-row">
                            <span>{a.date.split('-').reverse().slice(0,2).join('-')} — {a.description || 'Advance'}</span>
                            <span className="ss-adv-neg">{fmtRS(a.amount)}</span>
                            <button className="action-btn action-btn--danger" onClick={() => deleteAdvance(a.id)}><Trash2 size={12} /></button>
                          </div>
                        ))}
                        <div className="ss-row"><span>Total Advance</span><span className="ss-row__val ss-adv-neg">{fmtRS(d.totalAdvance)}</span></div>
                      </>)}
                      <div className="ss-row ss-row--net"><span>NET SALARY</span><span className="ss-row__val" style={{ fontSize: '1.1rem', color: 'var(--color-success)' }}>{fmtRS(d.netSalary)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <h3 className="ss-section-title" style={{ marginTop: 24 }}>Workers (Manual Entry)</h3>
      <div className="ss-list">
        {workers.length === 0 ? <div className="card"><p className="ss-empty">No workers. Add workers to manage their salary.</p></div> :
          workers.map(w => {
            const isOpen = openSheets[`w-${w.id}`] ?? false;
            const d = getWorkerSalary(w.id);
            return (
              <div key={w.id} className="ss-card card">
                <div className="ss-card__header" onClick={() => toggleSheet(`w-${w.id}`)}>
                  <div className="ss-card__info">
                    <span className="badge badge--warning">Worker</span><strong>{w.name}</strong>
                    <span className="ss-card__summary">Salary: {fmtRS(d.total)} | Adv: {fmtRS(d.totalAdvance)} | <strong style={{ color: 'var(--color-success)' }}>Net: {fmtRS(d.netSalary)}</strong></span>
                  </div>
                  <div className="ss-card__actions">
                    <button className="action-btn" onClick={e => { e.stopPropagation(); printPerson(w.name, d.total, d.advances, d.totalAdvance, d.netSalary); }} title="Print"><Printer size={15} /></button>
                    <button className="action-btn action-btn--danger" onClick={e => { e.stopPropagation(); deleteWorker(w.id); }} title="Delete"><Trash2 size={15} /></button>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
                {isOpen && (
                  <div className="ss-card__body">
                    <div className="ss-details">
                      {d.entries.length === 0 ? <p className="ss-empty">No salary entries.</p> :
                        d.entries.map(e => (
                          <div key={e.id} className="ss-adv-row">
                            <span>{e.date.split('-').reverse().slice(0,2).join('-')} — {e.description || 'Salary'}</span>
                            <span className="ss-row__val">{fmtRS(e.amount)}</span>
                            <button className="action-btn" onClick={() => { setEditingWorkerSalary(e); setShowSalaryForm(true); }}><Pencil size={12} /></button>
                            <button className="action-btn action-btn--danger" onClick={() => deleteWorkerSalary(e.id)}><Trash2 size={12} /></button>
                          </div>
                        ))}
                      <div className="ss-row ss-row--highlight"><span>Total Salary</span><span className="ss-row__val">{fmtRS(d.total)}</span></div>
                      {d.advances.length > 0 && (<>
                        <div className="ss-adv-title">Advances</div>
                        {d.advances.map(a => (
                          <div key={a.id} className="ss-adv-row">
                            <span>{a.date.split('-').reverse().slice(0,2).join('-')} — {a.description || 'Advance'}</span>
                            <span className="ss-adv-neg">{fmtRS(a.amount)}</span>
                            <button className="action-btn action-btn--danger" onClick={() => deleteAdvance(a.id)}><Trash2 size={12} /></button>
                          </div>
                        ))}
                        <div className="ss-row"><span>Total Advance</span><span className="ss-row__val ss-adv-neg">{fmtRS(d.totalAdvance)}</span></div>
                      </>)}
                      <div className="ss-row ss-row--net"><span>NET SALARY</span><span className="ss-row__val" style={{ fontSize: '1.1rem', color: 'var(--color-success)' }}>{fmtRS(d.netSalary)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <Modal isOpen={showWorkerForm} onClose={() => setShowWorkerForm(false)} title="Add Worker" size="sm">
        <WorkerForm onSave={addWorker} onCancel={() => setShowWorkerForm(false)} />
      </Modal>
      <Modal isOpen={showSalaryForm} onClose={() => { setShowSalaryForm(false); setEditingWorkerSalary(null); }} title={editingWorkerSalary ? 'Edit Salary Entry' : 'Add Worker Salary'}>
        <SalaryEntryForm workers={workers} initial={editingWorkerSalary} onSave={editingWorkerSalary ? updateWorkerSalary : addWorkerSalary} onCancel={() => { setShowSalaryForm(false); setEditingWorkerSalary(null); }} />
      </Modal>
      <Modal isOpen={showAdvanceForm} onClose={() => setShowAdvanceForm(false)} title="Add Advance">
        <AdvanceForm operators={operators} workers={workers} onSave={async d => { await addAdvance(d); setShowAdvanceForm(false); }} onCancel={() => setShowAdvanceForm(false)} />
      </Modal>
    </div>
  );
}

function WorkerForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (!name.trim()) { toast.error('Name required'); return; } onSave(name); }} className="form-grid">
      <Input label="Worker Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Usman Helper" required autoFocus />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add</Button></div>
    </form>
  );
}

function SalaryEntryForm({ workers, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { workerId: workers[0]?.id || '', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); if (!form.workerId || !form.amount) { toast.error('Select worker & enter amount'); return; } onSave({ workerId: form.workerId, description: form.description, amount: Number(form.amount), date: form.date }); set('description', ''); set('amount', ''); }} className="form-grid">
      <div style={{ gridColumn: '1/-1' }}><label className="form-field__label">Worker *</label><select className="form-input" value={form.workerId} onChange={e => set('workerId', e.target.value)}>{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Monthly pay" />
      <Input label="Amount (Rs) *" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{initial ? 'Update' : 'Add'}</Button></div>
    </form>
  );
}

function AdvanceForm({ operators, workers, onSave, onCancel }) {
  const allPeople = [...operators.map(o => ({ id: o.id, name: `${o.name} (${o.machine})`, type: 'operator' })), ...workers.map(w => ({ id: w.id, name: `${w.name} (Worker)`, type: 'worker' }))];
  const [form, setForm] = useState({ personKey: allPeople[0] ? `${allPeople[0].type}_${allPeople[0].id}` : '', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!form.personKey || !form.amount) { toast.error('Select person & enter amount'); return; }
      const [type, id] = form.personKey.split('_');
      onSave({ personId: id, personType: type, description: form.description, amount: Number(form.amount), date: form.date });
    }} className="form-grid">
      <div style={{ gridColumn: '1/-1' }}><label className="form-field__label">Person *</label><select className="form-input" value={form.personKey} onChange={e => set('personKey', e.target.value)}>{allPeople.map(p => <option key={`${p.type}_${p.id}`} value={`${p.type}_${p.id}`}>{p.name}</option>)}</select></div>
      <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Personal advance" />
      <Input label="Amount (Rs) *" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required />
      <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Add Advance</Button></div>
    </form>
  );
}
