import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { STORAGE_KEYS } from '../utils/constants';
import { Trash2, Plus, LogOut, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import './Settings.css';

function RegisterForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', type: 'user' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('All fields are required');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <Input label="Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" required />
      <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@email.com" required />
      <Input label="Password" type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Password" required />
      <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </Select>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Register User</Button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, users, logout, updateProfile, registerUser, deleteUser, isAdmin, isLoggedIn } = useAuth();
  const [showRegister, setShowRegister] = useState(false);


  const [profile, setProfile] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    password: '',
  });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!profile.name.trim() || !profile.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    updateProfile(profile);
    toast.success('Profile updated!');
    setProfile(p => ({ ...p, password: '' }));
  };

  const handleRegister = (data) => {
    const result = registerUser(data);
    if (result.success) {
      toast.success(`User "${data.name}" registered!`);
      setShowRegister(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleDeleteUser = (id) => {
    if (window.confirm('Delete this user?')) {
      const result = deleteUser(id);
      if (result.success) toast.success('User deleted');
      else toast.error(result.message);
    }
  };

  const handleClearData = () => {
    if (window.confirm('This will permanently delete ALL your data (production, articles, salary). Are you sure?')) {
      Object.values(STORAGE_KEYS).forEach(k => {
        if (k !== STORAGE_KEYS.USERS && k !== STORAGE_KEYS.CURRENT_USER) localStorage.removeItem(k);
      });
      toast.success('All data cleared. Refresh the page to start fresh.');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your preferences, profile & users</p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut size={16} /> Logout
        </Button>
      </div>

      <div className="settings-grid">
        {/* Current User Info */}
        <div className="card">
          <h3 className="settings-section-title">Current User</h3>
          <div className="settings-user-info">
            <div className={`settings-user-avatar ${isAdmin ? 'settings-user-avatar--admin' : ''}`}>
              {isAdmin ? <Shield size={22} /> : <User size={22} />}
            </div>
            <div>
              <p className="settings-user-name">{currentUser?.name}</p>
              <p className="settings-user-email">{currentUser?.email}</p>
              <span className={`badge ${isAdmin ? 'badge--accent' : 'badge--default'}`}>
                {currentUser?.type}
              </span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card">
          <h3 className="settings-section-title">Appearance</h3>
          <div className="settings-row">
            <div>
              <p className="settings-row__label">Theme</p>
              <p className="settings-row__desc">Toggle between light and dark mode</p>
            </div>
            <button
              className={`theme-toggle-switch ${theme === 'dark' ? 'theme-toggle-switch--on' : ''}`}
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className="theme-toggle-switch__thumb" />
            </button>
          </div>
          <p className="settings-hint">Current mode: <strong>{theme}</strong></p>
        </div>

        {/* Profile Edit */}
        <div className="card">
          <h3 className="settings-section-title">Edit Profile</h3>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Your Name"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Your name"
            />
            <Input
              label="Email"
              type="email"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              placeholder="your@email.com"
            />
            <Input
              label="New Password (leave blank to keep current)"
              type="text"
              value={profile.password}
              onChange={e => setProfile(p => ({ ...p, password: e.target.value }))}
              placeholder="New password"
            />
            <Button type="submit">Save Profile</Button>
          </form>
        </div>

        {/* User Management (Admin only) */}
        {isAdmin && (
          <div className="card">
            <div className="settings-section-header">
              <h3 className="settings-section-title" style={{ marginBottom: 0 }}>User Management</h3>
              <Button onClick={() => setShowRegister(true)} style={{ flexShrink: 0 }}>
                <Plus size={14} /> Register User
              </Button>
            </div>
            <div className="settings-users-list">
              {users.map(u => (
                <div key={u.id} className="settings-user-row">
                  <div className="settings-user-row__info">
                    <span className="settings-user-row__name">{u.name}</span>
                    <span className="settings-user-row__email">{u.email}</span>
                    <span className={`badge ${u.type === 'admin' ? 'badge--accent' : 'badge--default'}`}>{u.type}</span>
                  </div>
                  <div className="settings-user-row__actions">
                    {u.id === currentUser.id ? (
                      <span className="badge badge--success">You</span>
                    ) : (
                      <button
                        className="action-btn action-btn--danger"
                        onClick={() => handleDeleteUser(u.id)}
                        title={u.id === 'admin-001' ? 'Cannot delete default admin' : 'Delete user'}
                        disabled={u.id === 'admin-001'}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Management */}
        <div className="card">
          <h3 className="settings-section-title">Data Management</h3>
          <p className="settings-desc">
            All your data is stored locally in your browser's localStorage.
          </p>
          <div className="settings-danger-zone">
            <div>
              <p className="settings-row__label" style={{ color: 'var(--color-danger)' }}>Danger Zone</p>
              <p className="settings-row__desc">This action is irreversible. User accounts will be preserved.</p>
            </div>
            <Button variant="danger" onClick={handleClearData}>Clear All Data</Button>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h3 className="settings-section-title">About WorkDash</h3>
          <div className="settings-about">
            <p className="settings-about__name">WorkDash</p>
            <p className="settings-about__version">Version 1.0.0</p>
            <p className="settings-desc" style={{ marginTop: 8 }}>
              A business management dashboard for tracking production, articles, and salaries.
            </p>
          </div>
        </div>
      </div>

      {/* Register User Modal */}
      <Modal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        title="Register New User"
      >
        <RegisterForm
          onSave={handleRegister}
          onCancel={() => setShowRegister(false)}
        />
      </Modal>
    </div>
  );
}
