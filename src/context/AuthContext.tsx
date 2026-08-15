import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { DEFAULT_USER } from '../data/defaultData';
import { StorageService } from '../services/storage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('mywang_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanUser = username.trim().toLowerCase();
    const gasConfig = StorageService.getGoogleSheetsConfig();

    try {
      // Call secure backend route - passwords are never evaluated or revealed in client JS bundle
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: password,
          webAppUrl: gasConfig.webAppUrl || undefined
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success' && result.user) {
        const loggedUser: User = result.user;
        setUser(loggedUser);
        localStorage.setItem('mywang_user', JSON.stringify(loggedUser));
        StorageService.addLog('LOGIN', `Pengguna ${loggedUser.username} log masuk ke sistem MyWang`, loggedUser.username);
        return { success: true };
      } else {
        return {
          success: false,
          message: result.message || 'Nama pengguna atau kata laluan tidak tepat.'
        };
      }
    } catch (err: any) {
      console.error('Authentication request error:', err);
      return {
        success: false,
        message: 'Ralat sambungan pelayan semasa log masuk.'
      };
    }
  };

  const logout = () => {
    if (user) {
      StorageService.addLog('LOGOUT', `Pengguna ${user.username} log keluar`, user.username);
    }
    setUser(null);
    localStorage.removeItem('mywang_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

