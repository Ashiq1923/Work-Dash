import { createContext, useContext, useState, useEffect } from 'react';
import { STORAGE_KEYS, generateId } from '../utils/constants';
import { loadFromStorage, saveToStorage } from '../utils/storageUtils';

const AuthContext = createContext();

const DEFAULT_ADMIN = {
  id: 'admin-001',
  name: 'Admin',
  email: 'Workdash@gmail.com',
  password: 'Workdash123',
  type: 'admin',
};

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin can select which user's data to view/work on
  const [viewingUserId, setViewingUserId] = useState(null);

  useEffect(() => {
    const savedUsers = loadFromStorage(STORAGE_KEYS.USERS, [DEFAULT_ADMIN]);
    const hasAdmin = savedUsers.some(u => u.email === DEFAULT_ADMIN.email);
    if (!hasAdmin) savedUsers.unshift(DEFAULT_ADMIN);
    setUsers(savedUsers);

    const savedCurrent = loadFromStorage(STORAGE_KEYS.CURRENT_USER, null);
    if (savedCurrent) {
      const found = savedUsers.find(u => u.id === savedCurrent.id);
      if (found) setCurrentUser(found);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (users.length > 0) saveToStorage(STORAGE_KEYS.USERS, users);
  }, [users]);

  useEffect(() => {
    if (currentUser) saveToStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
    else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }, [currentUser]);

  const login = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, message: 'Invalid email or password' };
    setCurrentUser(user);
    setViewingUserId(null); // reset on login
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setViewingUserId(null);
  };

  const registerUser = (userData) => {
    if (currentUser?.type !== 'admin') return { success: false, message: 'Only admin can register users' };
    const exists = users.some(u => u.email === userData.email);
    if (exists) return { success: false, message: 'Email already registered' };
    const newUser = {
      id: generateId(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      type: userData.type || 'user',
    };
    setUsers(prev => [...prev, newUser]);
    return { success: true, user: newUser };
  };

  const deleteUser = (id) => {
    if (currentUser?.type !== 'admin') return { success: false, message: 'Only admin can delete users' };
    if (id === 'admin-001') return { success: false, message: 'Cannot delete default admin' };
    if (id === currentUser.id) return { success: false, message: 'Cannot delete yourself' };
    setUsers(prev => prev.filter(u => u.id !== id));
    if (viewingUserId === id) setViewingUserId(null);
    return { success: true };
  };

  const updateProfile = (data) => {
    if (!currentUser) return;
    const updated = { ...currentUser, name: data.name, email: data.email };
    if (data.password) updated.password = data.password;
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
    setCurrentUser(updated);
  };

  const isAdmin = currentUser?.type === 'admin';

  // The userId whose data we're currently viewing (for auth)
  const activeUserId = isAdmin ? viewingUserId : currentUser?.id;

  // activeDataKey = user NAME (unique), used for all data operations
  // type is only for login/auth, name is the real data key
  // Admin MUST select a user first (viewingUserId), otherwise null
  // Regular user: always their own name
  const activeDataKey = isAdmin
    ? (viewingUserId ? (users.find(u => u.id === viewingUserId)?.name || null) : null)
    : (currentUser?.name || null);
  const activeUserName = activeDataKey;

  return (
    <AuthContext.Provider value={{
      currentUser, users, loading,
      login, logout, registerUser, deleteUser, updateProfile,
      isAdmin, isLoggedIn: !!currentUser,
      viewingUserId, setViewingUserId, activeUserId, activeDataKey, activeUserName,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
