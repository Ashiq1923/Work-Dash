import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Factory, DollarSign, Users, BarChart3 } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import './MobileNav.css';

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.PRODUCTION, icon: Factory, label: 'Production' },
  { to: ROUTES.INCOME, icon: DollarSign, label: 'Income' },
  { to: ROUTES.SALARY, icon: Users, label: 'Salary' },
  { to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' },
];

export function MobileNav() {
  return (
    <nav className="mobile-nav">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `mobile-nav__item ${isActive ? 'mobile-nav__item--active' : ''}`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
