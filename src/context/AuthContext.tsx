import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { StorageService } from '../services/storage';

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
    const cleanUser = u.trim().toLowerCase();
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

      // 1. Cuba Pengesahan melalui Pelayan Backend API (/api/auth/login) jika pelayan aktif
      let backendAuthSuccess = false;
      let authenticatedUser: User | null = null;

      if (StorageService.isBackendServerAvailable()) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: cleanUser,
              password: cleanPass,
              webAppUrl: gasUrl,
            }),
          });

          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (res.ok && data && data.status === 'success') {
              backendAuthSuccess = true;
              authenticatedUser = {
                id: data.user?.id || `usr_${cleanUser}`,
                username: data.user?.username || cleanUser,
                name: data.user?.full_name || data.user?.name || cleanUser,
                full_name: data.user?.full_name || data.user?.name || cleanUser,
                email: data.user?.email || `${cleanUser}@mywang.app`,
                role: data.user?.role || (cleanUser === 'admin' ? 'admin' : 'member'),
                currency: data.user?.currency || 'MYR',
                created_at: data.user?.created_at || new Date().toISOString(),
              };
            } else if (res.status === 401 || (data && data.status === 'error')) {
              // Strictly rejected by backend
              setIsLoading(false);
              return {
                success: false,
                message: data.message || 'Nama pengguna atau kata laluan tidak sah.',
              };
            }
          }
        } catch (backendErr) {
          // Backend API login unavailable
        }
      }

      if (backendAuthSuccess && authenticatedUser) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);
        return { success: true, message: 'Log masuk berjaya.' };
      }

      // 2. Cuba Pengesahan Terus ke Google Apps Script (jika ada GAS Web App URL)
      if (gasUrl) {
        try {
          const gasRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'loginUser',
              username: cleanUser,
              password: cleanPass,
              data: { username: cleanUser, password: cleanPass },
            }),
          });
          const gasText = await gasRes.text();
          try {
            const gasData = JSON.parse(gasText);
            if (gasData && gasData.status === 'success') {
              const gasUser: User = {
                id: gasData.user?.id || `usr_${cleanUser}`,
                username: cleanUser,
                name: gasData.user?.full_name || gasData.user?.name || cleanUser,
                full_name: gasData.user?.full_name || gasData.user?.name || cleanUser,
                email: gasData.user?.email || `${cleanUser}@mywang.app`,
                role: cleanUser === 'admin' ? 'admin' : 'member',
                currency: 'MYR',
                created_at: new Date().toISOString(),
              };
              localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(gasUser));
              setUser(gasUser);
              return { success: true, message: 'Log masuk Google Sheets berjaya!' };
            }
          } catch (e) {}
        } catch (gasErr) {
          console.warn('GAS Direct login failed:', gasErr);
        }
      }

      // 3. Pengesahan Kredensial Piawai Selamat (Strict Allowed Credentials Only)
      const allowedCredentials: Record<string, string[]> = {
        admin: ['admin123', '123456'],
        firdaus: ['firdaus123', '123456', 'admin123', 'admin'],
        fifi: ['123456'],
        user: ['123456', 'user123'],
      };

      // Semak pengguna tempatan yang didaftarkan
      let localUsers: Record<string, any> = {};
      try {
        const rawLocalUsers = localStorage.getItem('mywang_registered_users');
        if (rawLocalUsers) localUsers = JSON.parse(rawLocalUsers);
      } catch {}

      if (allowedCredentials[cleanUser] && allowedCredentials[cleanUser].includes(cleanPass)) {
        const validUser: User = {
          id: `usr_${cleanUser}`,
          username: cleanUser,
          name: cleanUser === 'admin' ? 'Pentadbir MyWang (Admin)' : cleanUser === 'firdaus' ? 'Firdaus (SakuTrack)' : cleanUser,
          full_name: cleanUser === 'admin' ? 'Pentadbir MyWang (Admin)' : cleanUser === 'firdaus' ? 'Firdaus (SakuTrack)' : cleanUser,
          email: `${cleanUser}@mywang.app`,
          role: cleanUser === 'admin' ? 'admin' : 'member',
          currency: 'MYR',
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(validUser));
        setUser(validUser);
        return { success: true, message: 'Log masuk berjaya.' };
      }

      if (localUsers[cleanUser] && localUsers[cleanUser].password === cleanPass) {
        const regUser: User = {
          id: localUsers[cleanUser].id || `usr_${cleanUser}`,
          username: cleanUser,
          name: localUsers[cleanUser].name || cleanUser,
          full_name: localUsers[cleanUser].name || cleanUser,
          email: localUsers[cleanUser].email || `${cleanUser}@mywang.app`,
          role: 'member',
          currency: 'MYR',
          created_at: localUsers[cleanUser].created_at || new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(regUser));
        setUser(regUser);
        return { success: true, message: 'Log masuk berjaya.' };
      }

      // STRICTLY REJECT ALL OTHER COMBINATIONS
      return {
        success: false,
        message: 'Nama pengguna atau kata laluan tidak sah. Sila semak semula kredensial anda.',
      };
    } catch (e: any) {
      console.error('Login error:', e);
      return { success: false, message: 'Ralat sambungan semasa log masuk.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string, name: string) => {
    setIsLoading(true);
    const cleanUser = u.trim().toLowerCase();
    const cleanPass = p.trim();

    if (!cleanUser || !cleanPass) {
      setIsLoading(false);
      return { success: false, message: 'Sila lengkapkan nama pengguna dan kata laluan.' };
    }

    try {
      // Simpan pengguna secara tempatan untuk fallback
      let localUsers: Record<string, any> = {};
      try {
        const rawLocalUsers = localStorage.getItem('mywang_registered_users');
        if (rawLocalUsers) localUsers = JSON.parse(rawLocalUsers);
      } catch {}

      if (localUsers[cleanUser] || cleanUser === 'admin') {
        return { success: false, message: 'Nama pengguna ini sudah wujud. Sila pilih nama lain.' };
      }

      localUsers[cleanUser] = {
        id: `usr_${cleanUser}_${Date.now()}`,
        username: cleanUser,
        name: name.trim() || cleanUser,
        password: cleanPass,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mywang_registered_users', JSON.stringify(localUsers));

      // Hantar juga ke pelayan backend
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          name: name.trim() || cleanUser,
        }),
      }).catch(() => {});

      return { success: true, message: 'Pendaftaran akaun berjaya! Anda kini boleh log masuk.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat semasa mendaftar akaun.' };
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
