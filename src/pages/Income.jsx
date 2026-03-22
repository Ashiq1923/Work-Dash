import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Download, ChevronDown, ChevronUp, X, Users, FolderOpen, Printer, CheckCircle, Circle } from 'lucide-react';
import { useIncome } from '../context/IncomeContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormField';
import { formatDate, currentMonthKey, isInMonth, getLastNMonths, todayStr } from '../utils/dateUtils';
import { exportToExcel, exportSingleArticle } from '../utils/excelUtils';
import { generateId } from '../utils/constants';
import { PageLoader } from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import './Income.css';

const EMPTY_COMPONENT = () => ({
  id: generateId(),
  stitch: '',
  componentName: '',
  qtyOrMeter: 'qty',
  value: '',
  type: 'alternet',
});

/* ─── Add Party Modal ─── */
function AddPartyForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Party name is required'); return; }
    onSave(name);
    setName('');
  };
  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <Input label="Party Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rujhan Ind" required autoFocus />
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Add Party</Button>
      </div>
    </form>
  );
}

/* ─── Article Form ─── */
function ArticleForm({ initial, parties, onSave, onCancel, onAddParty }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        date: initial.date,
        articleName: initial.articleName,
        machineHead: initial.machineHead,
        partyId: initial.partyId || '',
        avgProduction: initial.avgProduction || '',
        components: initial.components.map(c => ({
          id: c.id, stitch: c.stitch || '', componentName: c.componentName,
          qtyOrMeter: c.qtyOrMeter, value: c.value, type: c.type,
        })),
      };
    }
    return {
      date: todayStr(), articleName: '', machineHead: 24,
      partyId: parties[0]?.id || '', avgProduction: '',
      components: [EMPTY_COMPONENT(), EMPTY_COMPONENT(), EMPTY_COMPONENT()],
    };
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setComp = (idx, key, val) => {
    setForm(f => ({ ...f, components: f.components.map((c, i) => i === idx ? { ...c, [key]: val } : c) }));
  };
  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, EMPTY_COMPONENT()] }));
  const removeComponent = (idx) => {
    if (form.components.length <= 1) { toast.error('At least 1 component required'); return; }
    setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  };

  const getEffHead = (type) => {
    const mh = Number(form.machineHead);
    if (type === 'all_head') return mh;
    if (type === 'alternet') return mh / 2;
    if (type === 'duble_alternet') return mh / 3;
    return mh;
  };
  const getRounds = (comp) => {
    const mh = Number(form.machineHead);
    const val = Number(comp.value) || 0;
    if (comp.qtyOrMeter === 'meter') return mh / 3 > 0 ? val / (mh / 3) : 0;
    const eh = getEffHead(comp.type);
    return eh > 0 ? val / eh : 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.articleName.trim()) { toast.error('Article name is required'); return; }
    if (!form.partyId) { toast.error('Please select a party'); return; }
    if (!form.components.some(c => c.componentName.trim())) { toast.error('At least one component name is required'); return; }
    const cleaned = {
      ...form, machineHead: Number(form.machineHead),
      avgProduction: form.avgProduction ? Number(form.avgProduction) : 0,
      components: form.components.filter(c => c.componentName.trim())
        .map(c => ({ ...c, stitch: c.stitch ? Number(c.stitch) : 0, value: Number(c.value) || 0 })),
    };
    onSave(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="article-form">
      <div className="article-form__top">
        <Input label="Date" type="date" value={form.date} onChange={e => setField('date', e.target.value)} required />
        <Input label="Article Name" value={form.articleName} onChange={e => setField('articleName', e.target.value)} placeholder="e.g. Summer Collection A" required />
        <Select label="Machine Head" value={form.machineHead} onChange={e => setField('machineHead', e.target.value)}>
          <option value={24}>24 Head</option>
          <option value={30}>30 Head</option>
        </Select>
        <div className="article-form__party-field">
          <Select label="Party" value={form.partyId} onChange={e => setField('partyId', e.target.value)}>
            <option value="">-- Select Party --</option>
            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <button type="button" className="article-form__party-add" onClick={onAddParty} title="Add new party">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="article-form__components-header">
        <h4>Components</h4>
        <span className="article-form__comp-count">{form.components.length} items</span>
      </div>

      <div className="article-form__components">
        {form.components.map((comp, idx) => {
          const rounds = getRounds(comp);
          const total = (Number(comp.stitch) || 0) * rounds;
          return (
            <div key={comp.id} className="comp-row">
              <div className="comp-row__num">{idx + 1}</div>
              <div className="comp-row__fields">
                <Input label="Stitch" type="number" min="0" value={comp.stitch} onChange={e => setComp(idx, 'stitch', e.target.value)} placeholder="Optional" />
                <Input label="Component Name *" value={comp.componentName} onChange={e => setComp(idx, 'componentName', e.target.value)} placeholder="e.g. Front XL" />
                <Select label="Qty / Meter" value={comp.qtyOrMeter} onChange={e => setComp(idx, 'qtyOrMeter', e.target.value)}>
                  <option value="qty">Qty</option>
                  <option value="meter">Meter</option>
                </Select>
                <Input label={comp.qtyOrMeter === 'qty' ? 'Qty Value' : 'Meter Value'} type="number" min="0" value={comp.value} onChange={e => setComp(idx, 'value', e.target.value)} placeholder="e.g. 200" />
                <Select label="Type" value={comp.type} onChange={e => setComp(idx, 'type', e.target.value)}>
                  <option value="alternet">Alternet</option>
                  <option value="duble_alternet">Duble Alternet</option>
                  <option value="all_head">All Head</option>
                </Select>
                {comp.value && comp.stitch ? (
                  <div className="comp-row__preview">
                    <span>Rounds: <strong>{rounds.toFixed(2)}</strong></span>
                    <span>Total: <strong>{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
                  </div>
                ) : null}
              </div>
              <button type="button" className="comp-row__remove" onClick={() => removeComponent(idx)} title="Remove">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="article-form__add-btn" onClick={addComponent}>
        <Plus size={16} /> Add More Component
      </button>

      {/* Average Production */}
      {(() => {
        const grandTotal = form.components.reduce((s, c) => {
          const r = getRounds(c);
          return s + (Number(c.stitch) || 0) * r;
        }, 0);
        const avg = Number(form.avgProduction) || 0;
        const shifts = avg > 0 ? grandTotal / avg : 0;
        const days = avg > 0 ? grandTotal / avg / 2 : 0;
        const fmtShifts = shifts === 1 ? 'Today' : `${shifts.toFixed(2)} Shifts`;
        const fmtDays = days === 1 ? 'Today' : `${days.toFixed(2)} Days`;

        return (
          <div className="avg-production-section">
            <div className="avg-production-section__input">
              <Input label="Average Production" type="number" min="0" value={form.avgProduction}
                onChange={e => setField('avgProduction', e.target.value)} placeholder="e.g. 500000" />
            </div>
            {avg > 0 && grandTotal > 0 && (
              <div className="avg-production-section__results">
                <div className="avg-result">
                  <span className="avg-result__label">Shifts</span>
                  <span className="avg-result__value">{fmtShifts}</span>
                  <span className="avg-result__formula">{Math.round(grandTotal).toLocaleString()} / {avg.toLocaleString()}</span>
                </div>
                <div className="avg-result">
                  <span className="avg-result__label">Days</span>
                  <span className="avg-result__value">{fmtDays}</span>
                  <span className="avg-result__formula">{Math.round(grandTotal).toLocaleString()} / {avg.toLocaleString()} / 2</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Save'} Article</Button>
      </div>
    </form>
  );
}

/* ─── NEW badge logic ─── */
function isNew(dateStr) {
  const created = new Date(dateStr);
  return (new Date() - created) < 24 * 60 * 60 * 1000;
}

/* ─── Print single article ─── */
function printArticle(article, partyName) {
  const typeLabel = (t) => t === 'alternet' ? 'Alternet' : t === 'duble_alternet' ? 'Duble Alternet' : 'All Head';
  const grandTotal = article.components.reduce((s, c) => s + (c.total || 0), 0);

  const html = `<!DOCTYPE html><html><head><title>${article.articleName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
  .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 14px; }
  .header h1 { font-size: 20px; margin-bottom: 6px; }
  .meta { display: flex; gap: 24px; font-size: 13px; color: #444; }
  .meta strong { color: #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  .total-row td { font-weight: 700; border-top: 2px solid #333; }
  .right { text-align: right; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div class="header">
  <h1>${article.articleName}</h1>
  <div class="meta">
    <span>Party: <strong>${partyName}</strong></span>
    <span>Machine Head: <strong>${article.machineHead}</strong></span>
    <span>Date: <strong>${article.date}</strong></span>
    <span>Components: <strong>${article.components.length}</strong></span>
  </div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>Stitch</th><th>Component</th><th>Qty/Meter</th><th>Value</th>
    <th>Type</th><th>Eff. Heads</th><th>Rounds</th><th>Stitch × Rounds</th>
  </tr></thead>
  <tbody>
    ${article.components.map((c, i) => `<tr>
      <td>${i + 1}</td>
      <td>${c.stitch ? Number(c.stitch).toLocaleString() : '-'}</td>
      <td><strong>${c.componentName}</strong></td>
      <td>${c.qtyOrMeter === 'qty' ? 'Qty' : 'Meter'}</td>
      <td>${Number(c.value).toLocaleString()}</td>
      <td>${typeLabel(c.type)}</td>
      <td>${Number(c.effectiveHeads || 0).toFixed(1)}</td>
      <td>${Number(c.rounds || 0).toFixed(2)}</td>
      <td><strong>${Math.round(c.total || 0).toLocaleString()}</strong></td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr class="total-row">
    <td colspan="8" class="right">Grand Total:</td>
    <td><strong>${Math.round(grandTotal).toLocaleString()}</strong></td>
  </tr></tfoot>
</table>
${article.avgProduction > 0 && grandTotal > 0 ? (() => {
  const avg = Number(article.avgProduction);
  const shifts = grandTotal / avg;
  const days = grandTotal / avg / 2;
  const fmtShifts = shifts === 1 ? 'Today' : shifts.toFixed(2) + ' Shifts';
  const fmtDays = days === 1 ? 'Today' : days.toFixed(2) + ' Days';
  return `<div style="margin-top:16px;display:flex;gap:32px;font-size:14px;">
    <span>Avg Production: <strong>${avg.toLocaleString()}</strong></span>
    <span>Shifts: <strong>${fmtShifts}</strong></span>
    <span>Days: <strong>${fmtDays}</strong></span>
  </div>`;
})() : ''}
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/* ─── Single Article Card ─── */
function ArticleCard({ article, partyName, onEdit, onDelete, onExport, onPrint, onToggleStatus, canEdit, showParty }) {
  const [expanded, setExpanded] = useState(false);
  const totalStitchRounds = article.components.reduce((s, c) => s + (c.total || 0), 0);
  const showNew = isNew(article.date);
  const isDone = article.status === 'done';

  return (
    <div className={`article-card ${isDone ? 'article-card--done' : ''}`}>
      {showNew && !isDone && <span className="article-card__new">NEW</span>}
      <div className="article-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="article-card__info">
          <div className="article-card__name-row">
            {canEdit ? (
              <button
                className={`status-toggle ${isDone ? 'status-toggle--done' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleStatus(article.id); }}
                title={isDone ? 'Mark as Pending' : 'Mark as Done / Delivered'}
              >
                {isDone ? <CheckCircle size={20} /> : <Circle size={20} />}
              </button>
            ) : (
              <span className={`status-toggle ${isDone ? 'status-toggle--done' : ''}`}>
                {isDone ? <CheckCircle size={20} /> : <Circle size={20} />}
              </span>
            )}
            <h3 className={`article-card__name ${isDone ? 'article-card__name--done' : ''}`}>{article.articleName}</h3>
            {isDone && <span className="badge badge--done">DELIVERED</span>}
          </div>
          <div className="article-card__meta">
            <span className="badge badge--default">{formatDate(article.date)}</span>
            {showParty && <span className="badge badge--party">{partyName}</span>}
            <span className="badge badge--accent">{article.machineHead} Head</span>
            <span className="badge badge--success">{article.components.length} Components</span>
          </div>
        </div>
        <div className="article-card__actions">
          <span className="article-card__total">
            {totalStitchRounds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <button className="action-btn" onClick={(e) => { e.stopPropagation(); onExport(article); }} title="Export to Excel">
            <Download size={15} />
          </button>
          <button className="action-btn" onClick={(e) => { e.stopPropagation(); onPrint(article); }} title="Print">
            <Printer size={15} />
          </button>
          {canEdit && (
            <>
              <button className="action-btn" onClick={(e) => { e.stopPropagation(); onEdit(article); }} title="Edit">
                <Pencil size={15} />
              </button>
              <button className="action-btn action-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(article.id); }} title="Delete">
                <Trash2 size={15} />
              </button>
            </>
          )}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="article-card__body">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Stitch</th><th>Component</th><th>Qty/Meter</th>
                  <th>Type</th><th>Eff. Heads</th><th>Rounds</th><th>Stitch × Rounds</th>
                </tr>
              </thead>
              <tbody>
                {article.components.map((comp, idx) => (
                  <tr key={comp.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{comp.stitch ? Number(comp.stitch).toLocaleString() : '-'}</td>
                    <td><strong>{comp.componentName}</strong></td>
                    <td>
                      <span className="badge badge--default">
                        {comp.qtyOrMeter === 'qty' ? 'Qty' : 'Meter'}: {Number(comp.value).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge--${comp.type === 'all_head' ? 'success' : comp.type === 'alternet' ? 'warning' : 'accent'}`}>
                        {comp.type === 'alternet' ? 'Alternet' : comp.type === 'duble_alternet' ? 'Duble Alternet' : 'All Head'}
                      </span>
                    </td>
                    <td>{Number(comp.effectiveHeads || 0).toFixed(1)}</td>
                    <td style={{ fontWeight: 600 }}>{Number(comp.rounds || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                      {Number(comp.total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '1.1em' }}>
                    {totalStitchRounds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {Number(article.avgProduction || 0) > 0 && totalStitchRounds > 0 && (() => {
            const avg = Number(article.avgProduction);
            const shifts = totalStitchRounds / avg;
            const days = totalStitchRounds / avg / 2;
            const fmtShifts = shifts === 1 ? 'Today' : `${shifts.toFixed(2)} Shifts`;
            const fmtDays = days === 1 ? 'Today' : `${days.toFixed(2)} Days`;
            return (
              <div className="article-card__avg-row">
                <div className="article-card__avg-item">
                  <span className="article-card__avg-label">Avg Production</span>
                  <span className="article-card__avg-val">{avg.toLocaleString()}</span>
                </div>
                <div className="article-card__avg-item">
                  <span className="article-card__avg-label">Shifts</span>
                  <span className="article-card__avg-val article-card__avg-val--accent">{fmtShifts}</span>
                </div>
                <div className="article-card__avg-item">
                  <span className="article-card__avg-label">Days</span>
                  <span className="article-card__avg-val article-card__avg-val--accent">{fmtDays}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ─── Party Folder ─── */
function PartyFolder({ party, articles, onEdit, onDelete, onExportArticle, onPrintArticle, onToggleStatus, canEditEntry }) {
  const [open, setOpen] = useState(true);
  const totalSR = articles.reduce((s, a) => s + a.components.reduce((cs, c) => cs + (c.total || 0), 0), 0);

  return (
    <div className="party-folder">
      <div className="party-folder__header" onClick={() => setOpen(!open)}>
        <div className="party-folder__left">
          <FolderOpen size={20} className="party-folder__icon" />
          <h2 className="party-folder__name">{party.name}</h2>
          <span className="badge badge--party">{articles.length} articles</span>
        </div>
        <div className="party-folder__right">
          <span className="party-folder__total">Total S×R: {Math.round(totalSR).toLocaleString()}</span>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      {open && (
        <div className="party-folder__body">
          {articles.length === 0 ? (
            <p className="dash-empty" style={{ padding: '12px 0' }}>No articles in this party.</p>
          ) : (
            <div className="article-list">
              {articles.map(a => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  partyName={party.name}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onExport={onExportArticle}
                  onPrint={onPrintArticle}
                  onToggleStatus={onToggleStatus}
                  canEdit={canEditEntry(a)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function Income() {
  const { entries, loading: incLoading, addEntry, updateEntry, deleteEntry, toggleStatus, canEditEntry, parties, addParty, deleteParty, getPartyName } = useIncome();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showPartyManager, setShowPartyManager] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('parties'); // 'parties' | 'articles' | 'new' | 'done' | 'pending'
  const months = useMemo(() => getLastNMonths(12), []);

  const filtered = useMemo(() => {
    let list = entries
      .filter(e => isInMonth(e.date, monthFilter))
      .filter(e => !search || e.articleName.toLowerCase().includes(search.toLowerCase()));
    if (viewMode === 'done') list = list.filter(e => e.status === 'done');
    else if (viewMode === 'pending') list = list.filter(e => e.status !== 'done');
    else if (viewMode === 'new') list = list.filter(e => isNew(e.date));
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, monthFilter, viewMode, search]);

  // Group filtered articles by party
  const groupedByParty = useMemo(() => {
    const map = new Map();
    parties.forEach(p => map.set(p.id, []));
    filtered.forEach(a => {
      const arr = map.get(a.partyId);
      if (arr) arr.push(a);
      else {
        // unknown party - group under "Unknown"
        if (!map.has('_unknown')) map.set('_unknown', []);
        map.get('_unknown').push(a);
      }
    });
    return map;
  }, [filtered, parties]);

  const allMonthEntries = useMemo(() =>
    entries
      .filter(e => isInMonth(e.date, monthFilter))
      .filter(e => !search || e.articleName.toLowerCase().includes(search.toLowerCase())),
    [entries, monthFilter, search]
  );
  const stats = useMemo(() => {
    const newArticles = allMonthEntries.filter(a => isNew(a.date)).length;
    const delivered = allMonthEntries.filter(a => a.status === 'done').length;
    const notDelivered = allMonthEntries.length - delivered;
    return { articles: allMonthEntries.length, newArticles, delivered, notDelivered };
  }, [allMonthEntries]);

  const handleSave = (data) => {
    if (editing) { updateEntry({ ...editing, ...data }); toast.success('Article updated'); }
    else { addEntry(data); toast.success('Article saved'); }
    setShowForm(false); setEditing(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this article?')) { deleteEntry(id); toast.success('Article deleted'); }
  };

  const handleAddParty = (name) => {
    addParty(name);
    toast.success(`Party "${name}" added`);
    setShowPartyModal(false);
  };

  const handleDeleteParty = (id) => {
    if (allEntries.some(e => e.partyId === id)) { toast.error('Cannot delete party with existing articles'); return; }
    if (window.confirm('Delete this party?')) { deleteParty(id); toast.success('Party deleted'); }
  };

  const handleToggleStatus = (id) => {
    toggleStatus(id);
  };

  const handleExportAll = () => {
    const rows = [];
    filtered.forEach(a => {
      a.components.forEach(c => {
        rows.push({
          Date: a.date, Party: getPartyName(a.partyId), Article: a.articleName,
          'Machine Head': a.machineHead, Stitch: c.stitch || '', Component: c.componentName,
          'Qty/Meter': c.qtyOrMeter, Value: c.value,
          Type: c.type === 'alternet' ? 'Alternet' : c.type === 'duble_alternet' ? 'Duble Alternet' : 'All Head',
          'Eff. Heads': Number(c.effectiveHeads || 0).toFixed(1),
          Rounds: Number(c.rounds || 0).toFixed(2),
          'Stitch × Rounds': Math.round(c.total || 0),
        });
      });
    });
    exportToExcel({ Articles: rows }, `articles_${monthFilter}`);
    toast.success('Excel file downloaded!');
  };

  const handleExportSingle = useCallback((article) => {
    exportSingleArticle(article, getPartyName(article.partyId));
    toast.success('Article exported to Excel!');
  }, [getPartyName]);

  const handlePrintSingle = useCallback((article) => {
    printArticle(article, getPartyName(article.partyId));
  }, [getPartyName]);

  if (incLoading) return <div className="page-container"><PageLoader text="Loading Articles..." /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Articles</h1>
          <p className="page-subtitle">Manage parties, articles & components</p>
        </div>
        <div className="prod-actions">
          <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {isAdmin && (
            <Button variant="secondary" onClick={() => setShowPartyManager(true)}>
              <Users size={16} /> Parties
            </Button>
          )}
          <Button variant="secondary" onClick={handleExportAll}><Download size={16} /> Export All</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> New Article
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="income-summary">
        <div
          className={`income-summary__item income-summary__item--clickable ${viewMode === 'parties' ? 'income-summary__item--active' : ''}`}
          onClick={() => setViewMode('parties')}
        >
          <span className="income-summary__label">Parties</span>
          <span className="income-summary__value">{parties.length}</span>
        </div>
        <div className="income-summary__divider" />
        <div
          className={`income-summary__item income-summary__item--clickable ${viewMode === 'articles' ? 'income-summary__item--active' : ''}`}
          onClick={() => setViewMode(v => v === 'articles' ? 'parties' : 'articles')}
        >
          <span className="income-summary__label">Articles</span>
          <span className="income-summary__value">{stats.articles}</span>
        </div>
        <div className="income-summary__divider" />
        <div
          className={`income-summary__item income-summary__item--clickable ${viewMode === 'new' ? 'income-summary__item--active' : ''}`}
          onClick={() => setViewMode(v => v === 'new' ? 'parties' : 'new')}
        >
          <span className="income-summary__label">New Articles</span>
          <span className="income-summary__value income-summary__value--income">{stats.newArticles}</span>
        </div>
        <div className="income-summary__divider" />
        <div
          className={`income-summary__item income-summary__item--clickable ${viewMode === 'done' ? 'income-summary__item--active' : ''}`}
          onClick={() => setViewMode(v => v === 'done' ? 'parties' : 'done')}
        >
          <span className="income-summary__label">Delivered</span>
          <span className="income-summary__value" style={{ color: 'var(--color-success)' }}>{stats.delivered}</span>
        </div>
        <div className="income-summary__divider" />
        <div
          className={`income-summary__item income-summary__item--clickable ${viewMode === 'pending' ? 'income-summary__item--active' : ''}`}
          onClick={() => setViewMode(v => v === 'pending' ? 'parties' : 'pending')}
        >
          <span className="income-summary__label">Not Delivered</span>
          <span className="income-summary__value" style={{ color: 'var(--color-danger)' }}>{stats.notDelivered}</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Search articles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Articles List */}
      {viewMode === 'parties' ? (
        /* Party Folders (default view) */
        <div className="party-folders">
          {parties.map(party => {
            const partyArticles = groupedByParty.get(party.id) || [];
            if (search && partyArticles.length === 0) return null;
            return (
              <PartyFolder
                key={party.id}
                party={party}
                articles={partyArticles}
                onEdit={(a) => { setEditing(a); setShowForm(true); }}
                onDelete={handleDelete}
                onExportArticle={handleExportSingle}
                onPrintArticle={handlePrintSingle}
                onToggleStatus={handleToggleStatus}
                canEditEntry={canEditEntry}
              />
            );
          })}
        </div>
      ) : (
        /* Flat list for articles / new / done / pending */
        filtered.length === 0 ? (
          <div className="card"><div className="empty-state"><p>No {viewMode === 'done' ? 'delivered' : viewMode === 'pending' ? 'not delivered' : viewMode === 'new' ? 'new' : ''} articles.</p></div></div>
        ) : (
          <div className="article-list">
            {filtered.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                partyName={getPartyName(article.partyId)}
                onEdit={(a) => { setEditing(a); setShowForm(true); }}
                onDelete={handleDelete}
                onExport={handleExportSingle}
                onPrint={handlePrintSingle}
                onToggleStatus={handleToggleStatus}
                canEdit={canEditEntry(article)}
                showParty
              />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Edit Article' : 'New Article'} size="lg">
        <ArticleForm initial={editing} parties={parties} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onAddParty={() => setShowPartyModal(true)} />
      </Modal>

      <Modal isOpen={showPartyModal} onClose={() => setShowPartyModal(false)} title="Add New Party" size="sm">
        <AddPartyForm onSave={handleAddParty} onCancel={() => setShowPartyModal(false)} />
      </Modal>

      <Modal isOpen={showPartyManager} onClose={() => setShowPartyManager(false)} title="Manage Parties">
        <div className="party-manager">
          <div className="party-manager__list">
            {parties.length === 0 ? (
              <p className="dash-empty">No parties added yet.</p>
            ) : parties.map(p => {
              const count = entries.filter(e => e.partyId === p.id).length;
              return (
                <div key={p.id} className="party-manager__item">
                  <div>
                    <span className="party-manager__name">{p.name}</span>
                    <span className="party-manager__count">{count} articles</span>
                  </div>
                  <button className="action-btn action-btn--danger"
                    onClick={() => handleDeleteParty(p.id)}
                    title={count > 0 ? 'Has articles' : 'Delete'} disabled={count > 0}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <button className="article-form__add-btn" onClick={() => setShowPartyModal(true)} style={{ marginTop: 12 }}>
            <Plus size={16} /> Add New Party
          </button>
        </div>
      </Modal>
    </div>
  );
}
