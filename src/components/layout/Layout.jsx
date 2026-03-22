import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Layout.css';

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={`layout ${collapsed && !isMobile ? 'layout--collapsed' : ''}`}>
      {isMobile && mobileOpen && (
        <div className="layout__overlay" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        collapsed={collapsed && !isMobile}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onClose={() => setMobileOpen(false)}
        onToggle={() => setCollapsed(c => !c)}
      />

      <div className="layout__body">
        <Header
          onMenuClick={() => isMobile ? setMobileOpen(o => !o) : setCollapsed(c => !c)}
        />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>

      {isMobile && <MobileNav />}
    </div>
  );
}
