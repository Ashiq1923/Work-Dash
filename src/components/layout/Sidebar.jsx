import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Factory, FileText, Users, BarChart3, Settings, X, ChevronLeft, Wallet, Scissors, BookOpen, ClipboardList } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.PRODUCTION, icon: Factory, label: 'Production' },
  { to: ROUTES.INCOME, icon: FileText, label: 'Articles' },
  { to: ROUTES.SALARY, icon: Users, label: 'Salary' },
  { to: ROUTES.GEXP, icon: Wallet, label: 'G-Exp' },
  { to: ROUTES.THREAD, icon: Scissors, label: 'Thread' },
  { to: ROUTES.LEDGER, icon: BookOpen, label: 'Ledger' },
  { to: ROUTES.SALARY_SHEET, icon: ClipboardList, label: 'Salary Sheet' },
  { to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
];

export function Sidebar({ collapsed, mobileOpen, isMobile, onClose, onToggle }) {
  const visibleItems = NAV_ITEMS;

  return (
    <aside
      className={[
        'sidebar',
        collapsed ? 'sidebar--collapsed' : '',
        isMobile ? (mobileOpen ? 'sidebar--mobile-open' : 'sidebar--mobile-hidden') : '',
      ].join(' ')}
    >
      <div className="sidebar__header">
        {!collapsed && <span className="sidebar__logo">WorkDash</span>}
        {isMobile ? (
          <button className="sidebar__btn" onClick={onClose}><X size={20} /></button>
        ) : (
          <button className="sidebar__btn" onClick={onToggle}>
            <ChevronLeft
              size={18}
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
            />
          </button>
        )}
      </div>

      <nav className="sidebar__nav">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
            onClick={isMobile ? onClose : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className="sidebar__icon" />
            {!collapsed && <span className="sidebar__label">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
