import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Factory, Users, ArrowRight, TrendingUp, Calendar, Zap } from 'lucide-react';
import { useIncome } from '../context/IncomeContext';
import { useProduction } from '../context/ProductionContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateUtils';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { PageLoader } from '../components/ui/Spinner';
import './Dashboard.css';

function getLastNDays(n) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function dateToKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtRS = (v) => `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const { entries: articleEntries, getPartyName } = useIncome();
  const { sheets: prodSheets, operators: prodOperators, loading: prodLoading, calcGenIncome, getHelperName } = useProduction();
  const { activeDataKey, activeUserName } = useAuth();

  const last7 = useMemo(() => getLastNDays(7), []);
  const todayStr = useMemo(() => dateToKey(new Date()), []);

  // Weekly articles (last 7 days)
  const weekArticles = useMemo(() => {
    const startKey = dateToKey(last7[0]);
    return articleEntries.filter(e => e.date >= startKey).sort((a, b) => b.date.localeCompare(a.date));
  }, [articleEntries, last7]);

  // Daily operator production for last 7 days
  const dailyProdData = useMemo(() => {
    return last7.map(d => {
      const monthKey = dateToMonth(d);
      const dayNum = d.getDate();
      const dayName = d.toLocaleDateString('en', { weekday: 'short' });
      const dateLabel = `${dayNum}/${d.getMonth() + 1}`;
      let totalProd = 0, totalGI = 0;
      const opData = [];

      prodOperators.forEach(op => {
        const sheet = prodSheets.find(s => s.operatorId === op.id && s.month === monthKey);
        const dd = sheet?.days[String(dayNum)];
        if (!dd) return;
        const prod = Number(dd.production) || 0;
        const gi = calcGenIncome(prod, op.head, dd.type, dd.rate);
        const subOp = dd.substituteOperatorId ? prodOperators.find(o => o.id === dd.substituteOperatorId) : null;
        totalProd += prod;
        totalGI += gi;
        opData.push({ op, prod, gi, dd, subOp });
      });

      return { date: d, dayName, dateLabel, totalProd, totalGI, opData };
    });
  }, [last7, prodSheets, prodOperators, calcGenIncome]);

  // Totals
  const weekTotalProd = dailyProdData.reduce((s, d) => s + d.totalProd, 0);
  const weekTotalGI = dailyProdData.reduce((s, d) => s + d.totalGI, 0);
  const todayData = dailyProdData.find(d => dateToKey(d.date) === todayStr);

  // Group operators by machine
  const machineGroups = useMemo(() => {
    const groups = {};
    prodOperators.forEach(op => {
      if (!groups[op.machine]) groups[op.machine] = [];
      groups[op.machine].push(op);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [prodOperators]);

  // Get today's data for a specific operator
  const getTodayOp = (opId) => todayData?.opData.find(d => d.op.id === opId);

  // Chart data for area chart
  const chartData = useMemo(() =>
    dailyProdData.map(d => ({
      name: d.dayName,
      Production: Math.round(d.totalProd / 1000),
      'Gen Income': Math.round(d.totalGI),
    })),
  [dailyProdData]);

  if (prodLoading) return <div className="page-container"><PageLoader text="Loading Dashboard..." /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{activeUserName ? `${activeUserName} — ` : ''}Week Overview</p>
        </div>
        <div className="dash-header-actions">
          <Link to="/income"><button className="btn btn--primary btn--md"><FileText size={16} /> New Article</button></Link>
          <Link to="/production"><button className="btn btn--secondary btn--md"><Factory size={16} /> Add Production</button></Link>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="dash-hero-grid">
        <div className="dash-hero-card dash-hero-card--prod">
          <div className="dash-hero-icon"><Factory size={28} /></div>
          <div className="dash-hero-content">
            <span className="dash-hero-label">Week Production</span>
            <span className="dash-hero-value">{weekTotalProd.toLocaleString()}</span>
          </div>
        </div>
        <div className="dash-hero-card dash-hero-card--gi">
          <div className="dash-hero-icon"><TrendingUp size={28} /></div>
          <div className="dash-hero-content">
            <span className="dash-hero-label">Week Gen Income</span>
            <span className="dash-hero-value">{fmtRS(weekTotalGI)}</span>
          </div>
        </div>
        <div className="dash-hero-card dash-hero-card--articles">
          <div className="dash-hero-icon"><FileText size={28} /></div>
          <div className="dash-hero-content">
            <span className="dash-hero-label">Week Articles</span>
            <span className="dash-hero-value">{weekArticles.length}</span>
          </div>
        </div>
        <div className="dash-hero-card dash-hero-card--ops">
          <div className="dash-hero-icon"><Users size={28} /></div>
          <div className="dash-hero-content">
            <span className="dash-hero-label">Operators</span>
            <span className="dash-hero-value">{prodOperators.length}</span>
          </div>
        </div>
      </div>

      {/* Machine Cards - Today's Production grouped by machine */}
      {machineGroups.length > 0 && (
        <div className="dash-section">
          <div className="dash-card-header" style={{ marginBottom: 12 }}>
            <h3><Zap size={16} style={{ color: 'var(--color-warning)' }} /> Today's Production by Machine</h3>
            <span className="badge badge--success">{new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          <div className="dash-machine-grid">
            {machineGroups.map(([machine, ops]) => {
              let machineProd = 0, machineGI = 0;
              const opsWithData = ops.map(op => {
                const td = getTodayOp(op.id);
                if (td && !td.dd?.substituteOperatorId) { machineProd += td.prod; machineGI += td.gi; }
                return { op, td };
              });
              return (
                <div key={machine} className="dash-machine-card card">
                  <div className="dash-machine-card__header">
                    <span className="dash-machine-badge">{machine}</span>
                    <div className="dash-machine-totals">
                      <span className="dash-machine-totals__prod">{machineProd.toLocaleString()}</span>
                      <span className="dash-machine-totals__gi">{fmtRS(machineGI)}</span>
                    </div>
                  </div>
                  <div className="dash-machine-ops">
                    {opsWithData.map(({ op, td }) => {
                      const isAbsent = td?.dd?.substituteOperatorId;
                      const subName = isAbsent ? td.subOp?.name : null;
                      return (
                        <div key={op.id} className={`dash-machine-op ${isAbsent ? 'dash-machine-op--absent' : ''}`}>
                          <div className="dash-machine-op__info">
                            <span className="dash-machine-op__name">{op.name}{isAbsent ? <span className="dash-machine-op__absent-tag"> (Absent)</span> : ''}</span>
                            <span className="dash-machine-op__meta">
                              {op.head}H — {getHelperName(op.defaultHelperId)}
                              {subName && <> — <strong style={{color:'var(--color-accent)'}}>Worked by {subName}</strong></>}
                            </span>
                          </div>
                          {td && !isAbsent ? (
                            <div className="dash-machine-op__data">
                              <span className="dash-machine-op__prod">{td.prod.toLocaleString()}</span>
                              <span className="dash-machine-op__gi">{fmtRS(td.gi)}</span>
                            </div>
                          ) : td && isAbsent ? (
                            <div className="dash-machine-op__data">
                              <span className="dash-machine-op__prod" style={{color:'var(--color-text-muted)'}}>{td.prod.toLocaleString()}</span>
                              <span className="dash-machine-op__gi" style={{fontSize:'0.65rem',color:'var(--color-danger)'}}>→ {subName}</span>
                            </div>
                          ) : (
                            <span className="dash-machine-op__empty">No entry</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart + Operators */}
      <div className="dash-row">
        <div className="card dash-chart-card">
          <div className="dash-card-header">
            <h3><Calendar size={16} /> 7-Day Production & Income</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradGI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="Production" stroke="#6366f1" strokeWidth={2} fill="url(#gradProd)" name="Prod (K)" />
              <Area type="monotone" dataKey="Gen Income" stroke="#10b981" strokeWidth={2} fill="url(#gradGI)" name="Gen Income" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card dash-side-card">
          <div className="dash-card-header">
            <h3>Machines</h3>
            <Link to="/production" className="dash-link">View all <ArrowRight size={14} /></Link>
          </div>
          <div className="dash-op-list">
            {machineGroups.length === 0 ? <p className="dash-empty">No machines.</p> : machineGroups.map(([machine, ops]) => (
              <div key={machine} className="dash-machine-mini">
                <div className="dash-machine-mini__header">
                  <span className="badge badge--accent">{machine}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{ops.length} operator{ops.length > 1 ? 's' : ''}</span>
                </div>
                {ops.map(op => (
                  <div key={op.id} className="dash-op-row">
                    <div className="dash-op-info">
                      <div>
                        <p className="dash-op-name">{op.name}</p>
                        <p className="dash-op-meta">{op.head}H</p>
                      </div>
                    </div>
                    <div className="dash-op-prod">
                      {getTodayOp(op.id) ? <>
                        <span className="dash-op-prod__val">{getTodayOp(op.id).prod.toLocaleString()}</span>
                        <span className="dash-op-prod__gi">{fmtRS(getTodayOp(op.id).gi)}</span>
                      </> : <span className="dash-op-prod__empty">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Articles */}
      <div className="card">
        <div className="dash-card-header">
          <h3><FileText size={16} /> This Week's Articles</h3>
          <Link to="/income" className="dash-link">View all <ArrowRight size={14} /></Link>
        </div>
        {weekArticles.length === 0 ? (
          <p className="dash-empty">No articles this week.</p>
        ) : (
          <div className="dash-articles-grid">
            {weekArticles.slice(0, 6).map(a => {
              const total = a.components.reduce((s, c) => s + (c.total || 0), 0);
              const isNew = (new Date() - new Date(a.date)) < 86400000;
              return (
                <div key={a.id} className="dash-article-card">
                  {isNew && <span className="dash-article-new">NEW</span>}
                  <div className="dash-article-card__top">
                    <span className="badge badge--party">{getPartyName(a.partyId)}</span>
                    <span className="badge badge--accent">{a.machineHead}H</span>
                  </div>
                  <h4 className="dash-article-card__name">{a.articleName}</h4>
                  <div className="dash-article-card__stats">
                    <div className="dash-article-stat">
                      <span className="dash-article-stat__label">Components</span>
                      <span className="dash-article-stat__value">{a.components.length}</span>
                    </div>
                    <div className="dash-article-stat">
                      <span className="dash-article-stat__label">Grand Total</span>
                      <span className="dash-article-stat__value dash-article-stat__value--accent">{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="dash-article-card__date">{formatDate(a.date)}</div>
                  <span className={`badge badge--${a.status === 'done' ? 'success' : 'warning'}`} style={{ marginTop: 6 }}>{a.status === 'done' ? 'Delivered' : 'Pending'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Production Breakdown - grouped by machine */}
      <div className="card">
        <div className="dash-card-header">
          <h3><Factory size={16} /> Daily Production (7 Days)</h3>
          <Link to="/production" className="dash-link">View all <ArrowRight size={14} /></Link>
        </div>
        <div className="dash-daily-list">
          {dailyProdData.slice().reverse().map((dayData, idx) => {
            // Group this day's opData by machine
            const dayMachines = {};
            dayData.opData.forEach(({ op, prod, gi }) => {
              if (!dayMachines[op.machine]) dayMachines[op.machine] = { ops: [], totalProd: 0, totalGI: 0 };
              dayMachines[op.machine].ops.push({ op, prod, gi });
              dayMachines[op.machine].totalProd += prod;
              dayMachines[op.machine].totalGI += gi;
            });
            return (
              <div key={idx} className={`dash-daily-row ${dateToKey(dayData.date) === todayStr ? 'dash-daily-row--today' : ''}`}>
                <div className="dash-daily-date">
                  <span className="dash-daily-date__day">{dayData.dayName}</span>
                  <span className="dash-daily-date__num">{dayData.dateLabel}</span>
                </div>
                <div className="dash-daily-machines">
                  {Object.keys(dayMachines).length === 0 ? (
                    <span className="dash-daily-empty">No entries</span>
                  ) : Object.entries(dayMachines).sort((a,b) => a[0].localeCompare(b[0])).map(([machine, data]) => (
                    <div key={machine} className="dash-daily-machine-chip">
                      <span className="dash-daily-machine-chip__badge">{machine}</span>
                      <div className="dash-daily-machine-chip__ops">
                        {data.ops.map(({ op, prod, gi }) => (
                          <span key={op.id} className="dash-daily-machine-chip__op">
                            {op.name}: <strong>{(prod / 1000).toFixed(0)}K</strong> <em>{fmtRS(gi)}</em>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dash-daily-totals">
                  <span className="dash-daily-totals__prod">{dayData.totalProd.toLocaleString()}</span>
                  <span className="dash-daily-totals__gi">{fmtRS(dayData.totalGI)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
