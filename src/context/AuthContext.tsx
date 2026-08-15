import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<{ success: boolean; message: string }>;
  register: (u: string, p: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const CURRENT_USER_KEY = 'mywang_current_user';
const SETTINGS_KEY = 'mywang_settings';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Gagal memuatkan sesi pengguna:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (u: string, p: string) => {
    setIsLoading(true);
    const cleanUser = u.trim();
    const cleanPass = p.trim();

    if (!cleanUser || !cleanPass) {
      setIsLoading(false);
      return { success: false, message: 'Sila masukkan nama pengguna dan kata laluan.' };
    }

    try {
      // Dapatkan URL Google Apps Script jika ada disimpan
      let gasUrl = '';
      try {
        const rawSettings = localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          gasUrl = parsed.gas_web_app_url || parsed.google_sheets_url || parsed.sakutrack_sheets_url || parsed.webAppUrl || '';
        }
      } catch (err) {}

      // 1. Pengesahan Utama melalui Pelayan Backend API (Hashed & Dilindungi)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          webAppUrl: gasUrl,
        }),
      });

      const data = await res.json();

      if (res.ok && data && data.status === 'success') {
        const authenticatedUser: User = {
          id: data.user?.id || `usr_${cleanUser}`,
          username: data.user?.username || cleanUser,
          name: data.user?.full_name || data.user?.name || cleanUser,
          full_name: data.user?.full_name || data.user?.name || cleanUser,
          email: data.user?.email || `${cleanUser}@mywang.app`,
          role: data.user?.role || (cleanUser.toLowerCase() === 'admin' ? 'admin' : 'member'),
          currency: data.user?.currency || 'MYR',
          created_at: data.user?.created_at || new Date().toISOString(),
        };

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);
        return { success: true, message: 'Log masuk berjaya.' };
      } else {
        return { 
          success: false, 
          message: data.message || 'Nama pengguna atau kata laluan tidak sah.' 
        };
      }
    } catch (e: any) {
      console.error('Login error:', e);
      return { success: false, message: 'Ralat sambungan pelayan semasa log masuk.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string, name: string) => {
    setIsLoading(true);
    const cleanUser = u.trim();
    const cleanPass = p.trim();

    if (!cleanUser || !cleanPass) {
      setIsLoading(false);
      return { success: false, message: 'Sila lengkapkan nama pengguna dan kata laluan.' };
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          name: name.trim() || cleanUser,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        return { success: true, message: data.message || 'Pendaftaran berjaya! Sila log masuk.' };
      } else {
        return { success: false, message: data.message || 'Gagal mendaftar akaun.' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat sambungan pendaftaran.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthProvider;
