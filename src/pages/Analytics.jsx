import { useState, useMemo, useEffect } from 'react';
import { useProduction } from '../context/ProductionContext';
import { useAuth } from '../context/AuthContext';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Input } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import './Analytics.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function calcBonus(p) { if (p < 400000) return 0; return 100 + Math.floor((p - 400000) / 50000) * 50; }
function calcSalaryVal(prod, head) { const r = Number(head) === 30 ? 280 : 240; return (Number(prod) / 100000) * r + calcBonus(Number(prod)); }
function isSunday(y, m, d) { return new Date(y, m - 1, d).getDay() === 0; }

const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem' };
const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899'];

export default function Analytics() {
  const { sheets, operators, calcGenIncome } = useProduction();
  const { activeDataKey } = useAuth();
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const months = useMemo(() => getLastNMonths(12), []);
  const [goalBilling, setGoalBilling] = useState(() => {
    const saved = loadFromStorage('wd_analytics_goals', {});
    return saved[`${activeDataKey}_${monthFilter}`] || '';
  });

  useEffect(() => {
    const saved = loadFromStorage('wd_analytics_goals', {});
    setGoalBilling(saved[`${activeDataKey}_${monthFilter}`] || '');
  }, [activeDataKey, monthFilter]);

  const saveGoal = (val) => {
    setGoalBilling(val);
    const saved = loadFromStorage('wd_analytics_goals', {});
    saved[`${activeDataKey}_${monthFilter}`] = val;
    saveToStorage('wd_analytics_goals', saved);
  };

  const [y, m] = monthFilter.split('-').map(Number);
  const numDays = new Date(y, m, 0).getDate();

  // ─── Thread Total (from localStorage) ───
  const threadTotal = useMemo(() => {
    const data = loadFromStorage(STORAGE_KEYS.THREAD, { accounts: [], entries: [] });
    const entries = data.entries?.filter(e => e.userId === activeDataKey && e.date?.startsWith(monthFilter)) || [];
    return entries.reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [activeDataKey, monthFilter]);

  // ─── G-Exp Total (from localStorage) ───
  const gexpTotal = useMemo(() => {
    const entries = loadFromStorage(STORAGE_KEYS.GEXP, []);
    const filtered = entries.filter(e => e.userId === activeDataKey && e.date?.startsWith(monthFilter));
    return filtered.reduce((s, e) => s + Number(e.credit || 0), 0);
  }, [activeDataKey, monthFilter]);

  // ─── Operator Salary Total (from production) ───
  const opSalaryTotal = useMemo(() => {
    let total = 0;
    operators.forEach(op => {
      const sheet = sheets.find(s => s.operatorId === op.id && s.month === monthFilter);
      if (!sheet) return;
      for (let d = 1; d <= numDays; d++) {
        const dd = sheet.days[String(d)];
        if (!dd || dd.substituteOperatorId) continue;
        const prod = Number(dd.production) || 0;
        const sun = isSunday(y, m, d);
        const displayProd = sun ? prod * 2 : prod;
        const bonus = calcBonus(prod);
        const rate = Number(op.head) === 30 ? 280 : 240;
        total += (displayProd / 100000) * rate + bonus;
      }
      sheets.forEach(s => {
        if (s.operatorId === op.id || s.month !== monthFilter) return;
        Object.entries(s.days || {}).forEach(([dayStr, dd]) => {
          if (dd.substituteOperatorId === op.id) {
            const prod = Number(dd.production) || 0;
            const sun = isSunday(y, m, Number(dayStr));
            const displayProd = sun ? prod * 2 : prod;
            const bonus = calcBonus(prod);
            const rate = Number(op.head) === 30 ? 280 : 240;
            total += (displayProd / 100000) * rate + bonus;
          }
        });
      });
    });
    return total;
  }, [operators, sheets, monthFilter, numDays, y, m]);

  // ─── Worker Salary + Advances (from salary sheet data) ───
  const salarySheetData = useMemo(() => {
    const ssData = loadFromStorage(STORAGE_KEYS.SALARY_SHEET, { workers: [], workerSalary: [], advances: [] });
    const workerSalary = (ssData.workerSalary || []).filter(e => e.userId === activeDataKey && e.date?.startsWith(monthFilter));
    const advances = (ssData.advances || []).filter(a => a.userId === activeDataKey && a.date?.startsWith(monthFilter));
    const workerTotal = workerSalary.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalAdvance = advances.reduce((s, a) => s + Number(a.amount || 0), 0);
    return { workerTotal, totalAdvance };
  }, [activeDataKey, monthFilter]);

  const salaryTotal = opSalaryTotal + salarySheetData.workerTotal;
  const totalAdvance = salarySheetData.totalAdvance;

  // ─── Physical Billing (from Ledger — total debit) ───
  const physicalBilling = useMemo(() => {
    const ledgerData = loadFromStorage(STORAGE_KEYS.LEDGER, { accounts: [], entries: [] });
    const entries = (ledgerData.entries || []).filter(e => e.userId === activeDataKey && e.date?.startsWith(monthFilter));
    return entries.reduce((s, e) => s + Number(e.debit || 0), 0);
  }, [activeDataKey, monthFilter]);

  // ─── Production Billing = Gen Income Total ───
  const prodBilling = useMemo(() => {
    let total = 0;
    operators.forEach(op => {
      const sheet = sheets.find(s => s.operatorId === op.id && s.month === monthFilter);
      if (!sheet) return;
      Object.values(sheet.days || {}).forEach(dd => {
        total += calcGenIncome(Number(dd.production) || 0, op.head, dd.type, dd.rate);
      });
    });
    return total;
  }, [operators, sheets, monthFilter, calcGenIncome]);

  // ─── Totals ───
  const totalExp = gexpTotal + threadTotal + salaryTotal;
  const goal = Number(goalBilling) || 0;
  const profit = goal > 0 ? goal - totalExp : prodBilling - totalExp;

  // ─── Pie Chart Data ───
  const pieData = useMemo(() => {
    if (goal <= 0) return [];
    const items = [
      { name: 'G-Exp', value: Math.max(0, gexpTotal) },
      { name: 'Thread', value: Math.max(0, threadTotal) },
      { name: 'Salary', value: Math.max(0, salaryTotal) },
    ];
    const expTotal = items.reduce((s, i) => s + i.value, 0);
    const profitVal = Math.max(0, goal - expTotal);
    if (profitVal > 0) items.push({ name: 'Profit', value: profitVal });
    return items.filter(i => i.value > 0);
  }, [goal, gexpTotal, threadTotal, salaryTotal]);

  const renderLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`;

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1><p className="page-subtitle">Monthly Overview</p></div>
        <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* ─── Expense Cards ─── */}
      <h3 className="analytics-section-title">Expenses</h3>
      <div className="analytics-cards-row">
        <div className="analytics-exp-card analytics-exp-card--gexp">
          <span className="analytics-exp-card__label">G-Exp</span>
          <span className="analytics-exp-card__value">{fmtRS(gexpTotal)}</span>
        </div>
        <div className="analytics-exp-card analytics-exp-card--thread">
          <span className="analytics-exp-card__label">Thread</span>
          <span className="analytics-exp-card__value">{fmtRS(threadTotal)}</span>
        </div>
        <div className="analytics-exp-card analytics-exp-card--salary">
          <span className="analytics-exp-card__label">Salary</span>
          <span className="analytics-exp-card__value">{fmtRS(salaryTotal)}</span>
          <div className="analytics-exp-card__detail">
            <span>Operators: {fmtRS(opSalaryTotal)}</span>
            <span>Workers: {fmtRS(salarySheetData.workerTotal)}</span>
            <span className="analytics-exp-card__adv">Advance: {fmtRS(totalAdvance)}</span>
          </div>
        </div>
        <div className="analytics-exp-card analytics-exp-card--total">
          <span className="analytics-exp-card__label">Total Expenses</span>
          <span className="analytics-exp-card__value">{fmtRS(totalExp)}</span>
        </div>
      </div>

      {/* ─── Billing Cards ─── */}
      <h3 className="analytics-section-title">Billing</h3>
      <div className="analytics-cards-row">
        <div className="analytics-bill-card analytics-bill-card--physical">
          <span className="analytics-bill-card__label">Physical Billing</span>
          <span className="analytics-bill-card__value">{fmtRS(physicalBilling)}</span>
          <span className="analytics-bill-card__sub">From Ledger (Debit Total)</span>
        </div>
        <div className="analytics-bill-card analytics-bill-card--production">
          <span className="analytics-bill-card__label">Production Billing</span>
          <span className="analytics-bill-card__value">{fmtRS(prodBilling)}</span>
          <span className="analytics-bill-card__sub">Gen Income Total</span>
        </div>
        <div className="analytics-bill-card analytics-bill-card--goal">
          <span className="analytics-bill-card__label">Monthly Goal</span>
          <div className="analytics-goal-input">
            <input type="number" className="analytics-goal-field" value={goalBilling} onChange={e => saveGoal(e.target.value)} placeholder="Enter goal..." />
          </div>
          {goal > 0 && <span className="analytics-bill-card__sub">{fmtRS(goal)}</span>}
        </div>
        <div className={`analytics-bill-card analytics-bill-card--profit ${profit >= 0 ? '' : 'analytics-bill-card--loss'}`}>
          <span className="analytics-bill-card__label">{profit >= 0 ? 'Profit' : 'Loss'}</span>
          <span className="analytics-bill-card__value">{fmtRS(Math.abs(profit))}</span>
          {goal > 0 && <span className="analytics-bill-card__sub">{((profit / goal) * 100).toFixed(1)}% of goal</span>}
        </div>
      </div>

      {/* ─── Circle Chart ─── */}
      {goal > 0 && pieData.length > 0 && (
        <div className="card analytics-pie-section">
          <h3 className="analytics-title">Goal Breakdown — {fmtRS(goal)} = 100%</h3>
          <div className="analytics-pie-row">
            <div className="analytics-pie-chart">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={120} dataKey="value"
                    label={renderLabel} labelLine={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => fmtRS(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-pie-legend">
              {pieData.map((item, i) => {
                const pct = ((item.value / goal) * 100).toFixed(1);
                return (
                  <div key={item.name} className="analytics-pie-item">
                    <div className="analytics-pie-item__color" style={{ background: COLORS[i % COLORS.length] }} />
                    <div className="analytics-pie-item__info">
                      <span className="analytics-pie-item__name">{item.name}</span>
                      <span className="analytics-pie-item__value">{fmtRS(item.value)}</span>
                    </div>
                    <span className="analytics-pie-item__pct">{pct}%</span>
                  </div>
                );
              })}
              <div className="analytics-pie-total">
                <span>Goal: {fmtRS(goal)}</span>
                <span>Expenses: {fmtRS(totalExp)}</span>
                <span style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                  {profit >= 0 ? 'Profit' : 'Loss'}: {fmtRS(Math.abs(profit))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {goal <= 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Enter a <strong>Monthly Goal</strong> above to see the breakdown chart.</p>
        </div>
      )}
    </div>
  );
}
