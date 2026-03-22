import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { profile, users, logout, isAdmin, viewingUserId, setViewingUserId } = useAuth();

  // Non-admin users (for admin dropdown)
  const selectableUsers = users.filter(u => u.type !== 'admin');

  return (
    <header className="header">
      <button className="header__icon-btn" onClick={onMenuClick} title="Toggle sidebar">
        <Menu size={20} />
      </button>

      {/* Admin user selector */}
      {isAdmin && selectableUsers.length > 0 && (
        <div className="header__user-select">
          <select
            className="header__user-dropdown"
            value={viewingUserId || ''}
            onChange={e => setViewingUserId(e.target.value || null)}
          >
            <option value="">-- Select User --</option>
            {selectableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="header__spacer" />
      <div className="header__actions">
        <button className="header__icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <span className="header__user-name">{profile?.name}</span>
        <span className={`badge ${profile?.type === 'admin' ? 'badge--accent' : 'badge--default'}`} style={{ fontSize: '0.65rem' }}>
          {profile?.type}
        </span>
        <button className="header__icon-btn header__icon-btn--logout" onClick={logout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
