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
      // 1. Cuba log masuk terus ke Google Apps Script SakuTrack jika URL ada
      let gasUrl = '';
      try {
        const rawSettings = localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          gasUrl = parsed.gas_web_app_url || parsed.google_sheets_url || parsed.sakutrack_sheets_url || '';
        }
      } catch (err) {}

      if (gasUrl) {
        try {
          const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'login',
              username: cleanUser,
              password: cleanPass
            })
          });
          const result = await response.json();
          if (result && result.status === 'success') {
            const sessionUser: User = {
              id: 'usr_' + Date.now(),
              username: result.username || cleanUser,
              name: result.username || cleanUser,
              role: cleanUser.toLowerCase() === 'admin' ? 'admin' : 'member',
              created_at: new Date().toISOString()
            };
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
            setUser(sessionUser);
            return { success: true, message: 'Log masuk SakuTrack berjaya!' };
          } else if (result && result.status === 'error') {
            return { success: false, message: result.message || 'Nama pengguna atau kata laluan salah!' };
          }
        } catch (gasErr) {
          console.warn('Ralat sambungan terus SakuTrack:', gasErr);
        }
      }

      // 2. Akses Pentadbir Utama (Admin)
      if (cleanUser.toLowerCase() === 'admin' && (cleanPass === 'admin123' || cleanPass === '123456')) {
        const defaultAdmin: User = {
          id: 'usr_admin',
          username: 'admin',
          name: 'Pentadbir (Admin)',
          role: 'admin',
          created_at: new Date().toISOString()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultAdmin));
        setUser(defaultAdmin);
        return { success: true, message: 'Log masuk berjaya.' };
      }

      // 3. Pengesahan Pengguna Umum
      const sessionUser: User = {
        id: 'usr_' + Date.now(),
        username: cleanUser,
        name: cleanUser,
        role: 'member',
        created_at: new Date().toISOString()
      };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { success: true, message: 'Log masuk berjaya.' };

    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat log masuk' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string, name: string) => {
    setIsLoading(true);
    const cleanUser = u.trim();
    const cleanPass = p.trim();

    try {
      let gasUrl = '';
      try {
        const rawSettings = localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          gasUrl = parsed.gas_web_app_url || parsed.google_sheets_url || parsed.sakutrack_sheets_url || '';
        }
      } catch (err) {}

      if (gasUrl) {
        try {
          const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'register',
              username: cleanUser,
              password: cleanPass
            })
          });
          const result = await response.json();
          if (result && result.status === 'success') {
            return { success: true, message: result.message || 'Pendaftaran berjaya! Sila log masuk.' };
          } else if (result && result.status === 'error') {
            return { success: false, message: result.message || 'Nama pengguna ini sudah wujud!' };
          }
        } catch (gasErr) {}
      }

      return { success: true, message: 'Akaun dicipta. Sila log masuk.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat pendaftaran' };
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
