import { useState, useRef, useEffect } from 'react';
import { Menu, Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { profile, logout } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);

  // Close popup on outside click
  useEffect(() => {
    if (!showPopup) return;
    const handleClick = (e) => { if (popupRef.current && !popupRef.current.contains(e.target)) setShowPopup(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPopup]);

  const initials = (profile?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="header">
      <button className="header__icon-btn" onClick={onMenuClick} title="Toggle sidebar">
        <Menu size={20} />
      </button>

      <div className="header__spacer" />
      <div className="header__actions">
        <button className="header__icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="header__profile-wrap" ref={popupRef}>
          <button className="header__avatar" onClick={() => setShowPopup(p => !p)} title={profile?.name}>
            {initials}
          </button>
          {showPopup && (
            <div className="header__popup">
              <div className="header__popup-info">
                <div className="header__popup-avatar">{initials}</div>
                <div>
                  <p className="header__popup-name">{profile?.name}</p>
                  <p className="header__popup-email">{profile?.email}</p>
                </div>
              </div>
              <div className="header__popup-divider" />
              <div className="header__popup-row">
                <span className={`badge ${profile?.type === 'admin' ? 'badge--accent' : 'badge--default'}`} style={{ fontSize: '0.65rem' }}>{profile?.type}</span>
              </div>
              <div className="header__popup-divider" />
              <button className="header__popup-btn" onClick={() => { setShowPopup(false); logout(); }}>
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
