import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDateMalay } from '../utils/formatters';
import { StorageService } from '../services/storage';
import { GoogleSheetsConfig } from '../types';
import { 
  Wallet, 
  RefreshCw, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  Settings, 
  History, 
  Sparkles, 
  CheckCircle2, 
  CloudOff,
  Scan,
  ArrowLeftRight,
  Plus
} from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSyncModal: () => void;
  onOpenAuditLogs: () => void;
  onOpenReceiptScanner: () => void;
  onOpenTransferModal: () => void;
  onOpenAddAccountModal: () => void;
  onOpenAddTransactionModal: () => void;
  onOpenSecretLoans: () => void;
  onManualSync: () => Promise<void>;
  isSyncing: boolean;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenSyncModal,
  onOpenAuditLogs,
  onOpenReceiptScanner,
  onOpenTransferModal,
  onOpenAddAccountModal,
  onOpenAddTransactionModal,
  onOpenSecretLoans,
  onManualSync,
  isSyncing,
  unreadNotificationsCount = 0,
  onOpenNotifications
}) => {
  const { user, logout } = useAuth();
  const [gasConfig, setGasConfig] = useState<GoogleSheetsConfig>(StorageService.getGoogleSheetsConfig());
  const todayMalay = formatDateMalay(new Date());

  useEffect(() => {
    const updateConfig = () => {
      setGasConfig(StorageService.getGoogleSheetsConfig());
    };
    window.addEventListener('storage', updateConfig);
    return () => window.removeEventListener('storage', updateConfig);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-blue-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  MyWang
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                  MYR
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic hidden sm:block">
                One Dashboard. Every Ringgit.
              </p>
            </div>
          </div>

          {/* User Info & Date in Center (Desktop) */}
          <div className="hidden md:flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <span>Selamat Kembali, {user?.full_name?.split(' ')[0] || user?.username || 'Pengguna'}</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              📅 {todayMalay}
            </span>
          </div>

          {/* Action Tools & Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* Quick AI Receipt Scan Button */}
            <button
              onClick={onOpenReceiptScanner}
              id="btn_header_scan_receipt"
              title="Imbas Resit Pintar AI"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imbas Resit AI</span>
            </button>

            {/* Secret Vault Button (Passcode Protected) */}
            <button
              onClick={onOpenSecretLoans}
              id="btn_header_secret_vault"
              title="Secret Vault: Pinjaman & Pembiayaan Rahsia (Kena Passcode)"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-950 hover:bg-slate-800 text-amber-300 dark:text-amber-400 text-xs font-bold border border-amber-500/40 shadow-sm shadow-amber-500/10 transition-all active:scale-95 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>🔒 Rahsia (Loan)</span>
            </button>

            {/* Google Sheets Sync Status Button */}
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              id="btn_header_sync"
              title={gasConfig.webAppUrl ? `Disambung ke Google Sheets (Terakhir: ${gasConfig.lastSynced || 'Baru'})` : 'Klik untuk tetapkan Google Sheets'}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 cursor-pointer ${
                gasConfig.webAppUrl
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/80'
                  : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
              <span className="hidden sm:inline">
                {isSyncing ? 'Menyegerak...' : gasConfig.webAppUrl ? 'Segerak Sheets' : 'Sambung Sheets'}
              </span>
              {gasConfig.webAppUrl && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            {/* Google Sheets Settings */}
            <button
              onClick={onOpenSyncModal}
              id="btn_header_sheets_config"
              title="Tetapan Google Sheets & Apps Script"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Audit Logs */}
            <button
              onClick={onOpenAuditLogs}
              id="btn_header_audit_logs"
              title="Jejak Audit Aktiviti"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              id="btn_header_notifications"
              title="Pemberitahuan & Amaran"
              className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={onToggleDarkMode}
              id="btn_header_dark_toggle"
              title={darkMode ? 'Tukar ke Mod Cerah' : 'Tukar ke Mod Gelap'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              id="btn_header_logout"
              title="Log Keluar"
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
