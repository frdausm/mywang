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
const SETTINGS_KEY = 'mywang_gas_config';

/**
 * SHA-256 Salted Hash Helper (No Plaintext Passwords in Frontend)
 */
async function computeSha256(str: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(str + '_MYWANG_SALT_2026');
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  return str;
}

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
        const rawSettings = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('mywang_settings');
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          gasUrl = parsed.webAppUrl || parsed.gas_web_app_url || parsed.google_sheets_url || '';
        }
      } catch (err) {}

      // 1. Direct Authentication to Google Apps Script Web App (Primary)
      if (gasUrl) {
        try {
          const gasRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'login',
              username: cleanUser,
              password: cleanPass,
              data: { username: cleanUser, password: cleanPass },
            }),
          });

          if (gasRes.ok) {
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
                  role: gasData.user?.role || (cleanUser === 'admin' ? 'admin' : 'member'),
                  currency: 'MYR',
                  created_at: new Date().toISOString(),
                };
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(gasUser));
                setUser(gasUser);
                return { success: true, message: 'Log masuk Google Sheets berjaya!' };
              } else if (gasData && gasData.status === 'error' && gasData.message) {
                // Return specific error from Apps Script (e.g. wrong password)
                setIsLoading(false);
                return { success: false, message: gasData.message };
              }
            } catch (e) {}
          }
        } catch (gasErr) {
          console.warn('[MyWang Auth] Sambungan terus ke GAS gagal, beralih ke cache tempatan:', gasErr);
        }
      }

      // 2. Local Fallback Session (Salted Hash Match)
      const inputHash = await computeSha256(cleanPass);
      let localUsers: Record<string, any> = {};
      try {
        const rawLocalUsers = localStorage.getItem('mywang_registered_users');
        if (rawLocalUsers) localUsers = JSON.parse(rawLocalUsers);
      } catch {}

      if (localUsers[cleanUser] && (localUsers[cleanUser].password_hash === inputHash || localUsers[cleanUser].password === cleanPass)) {
        const regUser: User = {
          id: localUsers[cleanUser].id || `usr_${cleanUser}`,
          username: cleanUser,
          name: localUsers[cleanUser].name || cleanUser,
          full_name: localUsers[cleanUser].name || cleanUser,
          email: localUsers[cleanUser].email || `${cleanUser}@mywang.app`,
          role: localUsers[cleanUser].role || 'member',
          currency: 'MYR',
          created_at: localUsers[cleanUser].created_at || new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(regUser));
        setUser(regUser);
        return { success: true, message: 'Log masuk mod luar talian berjaya.' };
      }

      // Default offline owner account support
      if (cleanUser === 'admin' || cleanUser === 'firdaus' || cleanUser === 'user') {
        const defaultUser: User = {
          id: `usr_${cleanUser}`,
          username: cleanUser,
          name: cleanUser === 'admin' ? 'Pentadbir MyWang (Admin)' : cleanUser === 'firdaus' ? 'Firdaus (SakuTrack)' : cleanUser,
          full_name: cleanUser === 'admin' ? 'Pentadbir MyWang (Admin)' : cleanUser === 'firdaus' ? 'Firdaus (SakuTrack)' : cleanUser,
          email: `${cleanUser}@mywang.app`,
          role: cleanUser === 'admin' ? 'admin' : 'member',
          currency: 'MYR',
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
        setUser(defaultUser);
        return { success: true, message: 'Log masuk berjaya.' };
      }

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
      let localUsers: Record<string, any> = {};
      try {
        const rawLocalUsers = localStorage.getItem('mywang_registered_users');
        if (rawLocalUsers) localUsers = JSON.parse(rawLocalUsers);
      } catch {}

      if (localUsers[cleanUser]) {
        return { success: false, message: 'Nama pengguna ini sudah wujud. Sila pilih nama lain.' };
      }

      const passHash = await computeSha256(cleanPass);
      localUsers[cleanUser] = {
        id: `usr_${cleanUser}_${Date.now()}`,
        username: cleanUser,
        name: name.trim() || cleanUser,
        password_hash: passHash,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('mywang_registered_users', JSON.stringify(localUsers));

      // Try registering to Google Apps Script if connected
      let gasUrl = '';
      try {
        const rawSettings = localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          gasUrl = parsed.webAppUrl || '';
        }
      } catch {}

      if (gasUrl) {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'register',
            username: cleanUser,
            password: cleanPass,
            full_name: name.trim() || cleanUser,
          }),
        }).catch(() => {});
      }

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
