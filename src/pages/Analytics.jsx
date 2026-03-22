import { useState, useMemo, useEffect } from 'react';
import { useProduction } from '../context/ProductionContext';
import { useAuth } from '../context/AuthContext';
import { currentMonthKey, getLastNMonths } from '../utils/dateUtils';
import * as db from '../lib/db';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageLoader } from '../components/ui/Spinner';
import './Analytics.css';

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function calcBonus(p) { if (p < 400000) return 0; return 100 + Math.floor((p - 400000) / 50000) * 50; }
function isSunday(y, m, d) { return new Date(y, m - 1, d).getDay() === 0; }

const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem' };
const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899'];

export default function Analytics() {
  const { sheets, operators, calcGenIncome } = useProduction();
  const { activeDataKey } = useAuth();
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const months = useMemo(() => getLastNMonths(12), []);

  const [loading, setLoading] = useState(true);
  const [threadEntries, setThreadEntries] = useState([]);
  const [gexpEntries, setGexpEntries] = useState([]);
  const [workerSalaryEntries, setWorkerSalaryEntries] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  useEffect(() => {
    if (!activeDataKey) {
      setThreadEntries([]); setGexpEntries([]);
      setWorkerSalaryEntries([]); setAdvances([]); setLedgerEntries([]);
      setLoading(false); return;
    }
    setLoading(true);
    Promise.all([
      db.fetchThreadEntries(activeDataKey),
      db.fetchGexpEntries(activeDataKey),
      db.fetchWorkerSalaryEntries(activeDataKey),
      db.fetchAdvances(activeDataKey),
      db.fetchLedgerEntries(activeDataKey),
    ]).then(([thread, gexp, ws, adv, ledger]) => {
      setThreadEntries(thread);
      setGexpEntries(gexp);
      setWorkerSalaryEntries(ws);
      setAdvances(adv);
      setLedgerEntries(ledger);
      setLoading(false);
    });
  }, [activeDataKey, monthFilter]);

  const [y, m] = monthFilter.split('-').map(Number);
  const numDays = new Date(y, m, 0).getDate();

  const threadTotal = useMemo(() =>
    threadEntries.filter(e => e.date?.startsWith(monthFilter)).reduce((s, e) => s + Number(e.amount || 0), 0),
  [threadEntries, monthFilter]);

  const gexpTotal = useMemo(() =>
    gexpEntries.filter(e => e.date?.startsWith(monthFilter)).reduce((s, e) => s + Number(e.credit || 0), 0),
  [gexpEntries, monthFilter]);

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

  const salarySheetData = useMemo(() => {
    const workerTotal = workerSalaryEntries.filter(e => e.date?.startsWith(monthFilter)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalAdvance = advances.filter(a => a.date?.startsWith(monthFilter)).reduce((s, a) => s + Number(a.amount || 0), 0);
    return { workerTotal, totalAdvance };
  }, [workerSalaryEntries, advances, monthFilter]);

  const salaryTotal = opSalaryTotal + salarySheetData.workerTotal;
  const totalAdvance = salarySheetData.totalAdvance;

  const physicalBilling = useMemo(() =>
    ledgerEntries.filter(e => e.date?.startsWith(monthFilter)).reduce((s, e) => s + Number(e.debit || 0), 0),
  [ledgerEntries, monthFilter]);

  const prodBilling = useMemo(() => {
    let total = 0;
    operators.forEach(op => {
      const sheet = sheets.find(s => s.operatorId === op.id && s.month === monthFilter);
      if (!sheet) return;
      Object.values(sheet.days || {}).forEach(dd => {
        total += calcGenIncome(Number(dd.production) || 0, op.head, dd.type, dd.rate, dd.genHead);
      });
    });
    return total;
  }, [operators, sheets, monthFilter, calcGenIncome]);

  const totalExp = gexpTotal + threadTotal + salaryTotal;
  const profit = physicalBilling - totalExp;

  const pieData = useMemo(() => {
    const base = physicalBilling || totalExp;
    if (base <= 0) return [];
    const items = [
      { name: 'G-Exp', value: Math.max(0, gexpTotal) },
      { name: 'Thread', value: Math.max(0, threadTotal) },
      { name: 'Salary', value: Math.max(0, salaryTotal) },
    ];
    if (profit > 0) items.push({ name: 'Profit', value: profit });
    return items.filter(i => i.value > 0);
  }, [physicalBilling, gexpTotal, threadTotal, salaryTotal, profit, totalExp]);

  const renderLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`;

  if (!activeDataKey) return <div className="page-container"><div className="card"><div className="empty-state"><p>Select a user first.</p></div></div></div>;
  if (loading) return <div className="page-container"><PageLoader text="Loading Analytics..." /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1><p className="page-subtitle">Monthly Overview</p></div>
        <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <h3 className="analytics-section-title">Expenses</h3>
      <div className="analytics-cards-row">
        <div className="analytics-exp-card analytics-exp-card--gexp"><span className="analytics-exp-card__label">G-Exp</span><span className="analytics-exp-card__value">{fmtRS(gexpTotal)}</span></div>
        <div className="analytics-exp-card analytics-exp-card--thread"><span className="analytics-exp-card__label">Thread</span><span className="analytics-exp-card__value">{fmtRS(threadTotal)}</span></div>
        <div className="analytics-exp-card analytics-exp-card--salary">
          <span className="analytics-exp-card__label">Salary</span><span className="analytics-exp-card__value">{fmtRS(salaryTotal)}</span>
          <div className="analytics-exp-card__detail"><span>Operators: {fmtRS(opSalaryTotal)}</span><span>Workers: {fmtRS(salarySheetData.workerTotal)}</span><span className="analytics-exp-card__adv">Advance: {fmtRS(totalAdvance)}</span></div>
        </div>
        <div className="analytics-exp-card analytics-exp-card--total"><span className="analytics-exp-card__label">Total Expenses</span><span className="analytics-exp-card__value">{fmtRS(totalExp)}</span></div>
      </div>

      <h3 className="analytics-section-title">Billing</h3>
      <div className="analytics-cards-row">
        <div className="analytics-bill-card analytics-bill-card--physical"><span className="analytics-bill-card__label">Physical Billing</span><span className="analytics-bill-card__value">{fmtRS(physicalBilling)}</span><span className="analytics-bill-card__sub">From Ledger (Debit Total)</span></div>
        <div className="analytics-bill-card analytics-bill-card--production"><span className="analytics-bill-card__label">Production Billing</span><span className="analytics-bill-card__value">{fmtRS(prodBilling)}</span><span className="analytics-bill-card__sub">Gen Income Total</span></div>
        <div className={`analytics-bill-card analytics-bill-card--profit ${profit >= 0 ? '' : 'analytics-bill-card--loss'}`}>
          <span className="analytics-bill-card__label">{profit >= 0 ? 'Profit' : 'Loss'}</span><span className="analytics-bill-card__value">{fmtRS(Math.abs(profit))}</span>
          <span className="analytics-bill-card__sub">Physical Billing - Expenses</span>
        </div>
      </div>

      {pieData.length > 0 ? (
        <div className="card analytics-pie-section">
          <h3 className="analytics-title">Billing Breakdown — {fmtRS(physicalBilling)} = 100%</h3>
          <div className="analytics-pie-row">
            <div className="analytics-pie-chart">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={120} dataKey="value" label={renderLabel} labelLine={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => fmtRS(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-pie-legend">
              {pieData.map((item, i) => {
                const base = physicalBilling || totalExp;
                const pct = base > 0 ? ((item.value / base) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item.name} className="analytics-pie-item">
                    <div className="analytics-pie-item__color" style={{ background: COLORS[i % COLORS.length] }} />
                    <div className="analytics-pie-item__info"><span className="analytics-pie-item__name">{item.name}</span><span className="analytics-pie-item__value">{fmtRS(item.value)}</span></div>
                    <span className="analytics-pie-item__pct">{pct}%</span>
                  </div>
                );
              })}
              <div className="analytics-pie-total">
                <span>Billing: {fmtRS(physicalBilling)}</span><span>Expenses: {fmtRS(totalExp)}</span>
                <span style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>{profit >= 0 ? 'Profit' : 'Loss'}: {fmtRS(Math.abs(profit))}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Add data to see the breakdown chart.</p>
        </div>
      )}
    </div>
  );
}
