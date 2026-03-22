import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUserId, setViewingUserId] = useState(null);

  // Load session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
        loadProfiles();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
        loadProfiles();
      } else {
        setCurrentUser(null);
        setProfile(null);
        setViewingUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setProfiles(data);
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    setViewingUserId(null);
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setProfile(null);
    setViewingUserId(null);
    setProfiles([]);
  };

  const registerUser = async (userData) => {
    // Create user via admin API (auto-confirms, no email verification)
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name, type: userData.type || 'user' },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err.message || err.msg || 'Failed to create user' };
    }
    const user = await res.json();
    await loadProfiles();
    return { success: true, user };
  };

  const deleteUser = async (id) => {
    if (id === currentUser?.id) return { success: false, message: 'Cannot delete yourself' };
    // Delete from Supabase Auth via admin API (also cascades to profiles)
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err.message || err.msg || 'Failed to delete user' };
    }
    await loadProfiles();
    if (viewingUserId === id) setViewingUserId(null);
    return { success: true };
  };

  const updateProfile = async (data) => {
    if (!currentUser) return;
    const { error } = await supabase.from('profiles').update({
      name: data.name,
      email: data.email,
    }).eq('id', currentUser.id);
    if (!error) {
      await loadProfile(currentUser.id);
      await loadProfiles();
    }
  };

  const changePassword = async (userId, newPassword) => {
    if (userId === currentUser?.id) {
      // Change own password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, message: error.message };
      return { success: true };
    }
    // Admin changing another user's password — use admin API
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY || session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err.message || err.msg || 'Failed to change password' };
    }
    return { success: true };
  };

  const isAdmin = profile?.type === 'admin';
  const isLoggedIn = !!currentUser && !!profile;

  // activeUserId = the UUID we're working with
  const activeUserId = isAdmin ? viewingUserId : currentUser?.id;
  // activeDataKey = same as activeUserId (UUID) for all data operations
  const activeDataKey = activeUserId || null;
  const activeUserName = isAdmin && viewingUserId
    ? profiles.find(u => u.id === viewingUserId)?.name || null
    : profile?.name || null;

  // Users list for admin dropdown (exclude admin)
  const users = profiles;

  return (
    <AuthContext.Provider value={{
      currentUser, profile, users, loading,
      login, logout, registerUser, deleteUser, updateProfile, changePassword,
      isAdmin, isLoggedIn,
      viewingUserId, setViewingUserId, activeUserId, activeDataKey, activeUserName,
      loadProfiles,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
