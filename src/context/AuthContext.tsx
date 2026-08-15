import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { 
  getStoredCurrentUser, 
  loginUser as loginStorage, 
  logoutUser as logoutStorage,
  registerUser as registerStorage 
} from '../services/storage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<{ success: boolean; message: string }>;
  register: (u: string, p: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const currentUser = getStoredCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const login = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      const res = await loginStorage(u, p);
      if (res.success && res.user) {
        setUser(res.user);
      }
      return { success: res.success, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat log masuk' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await registerStorage(u, p, name);
      if (res.success && res.user) {
        setUser(res.user);
      }
      return { success: res.success, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message || 'Ralat pendaftaran' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutStorage();
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
