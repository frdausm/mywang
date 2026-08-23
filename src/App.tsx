import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { AccountsGrid } from './components/AccountsGrid';
import { TransactionsModule } from './components/TransactionsModule';
import { IncomeModule } from './components/IncomeModule';
import { ExpenseModule } from './components/ExpenseModule';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { EditAccountModal } from './components/EditAccountModal';
import { AddAccountModal } from './components/AddAccountModal';
import { TransferModal } from './components/TransferModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { GoogleSheetsSettingsModal } from './components/GoogleSheetsSettingsModal';
import { AuditLogsModal } from './components/AuditLogsModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { SecretLoansModal } from './components/SecretLoansModal';
import { AccountDetailsModal } from './components/AccountDetailsModal';
import { MyWangAIModal } from './components/MyWangAIModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MonthlyClosingModal } from './components/MonthlyClosingModal';
import { FloatingActionButton } from './components/FloatingActionButton';
import { ToastContainer, ToastMessage } from './components/Toast';
import { StorageService } from './services/storage';
import { Account, Transaction, CategoryItem, AuditLog, TransactionType, LoanFinancing } from './types';
import { getMalaysiaDateString, getMalaysiaTimestamp, roundToTwoDecimals } from './utils/formatters';
import { matchAccount, matchAccountId } from './utils/accountMatcher';
import { 
  LayoutDashboard, 
  ReceiptText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  BarChart3, 
  RefreshCw,
  Sparkles,
  Database,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function DashboardApp() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Dark Mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('mywang_dark_mode');
    return saved !== null ? saved === 'true' : true; // default dark for premium feel
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'income' | 'expense' | 'analytics'>('dashboard');

  // Core Data
  const [accounts, setAccounts] = useState<Account[]>(() => StorageService.getAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(() => StorageService.getTransactions());
  const [incomeCategories, setIncomeCategories] = useState<CategoryItem[]>(() => StorageService.getCategories().incomeTypes);
  const [expenseCategories, setExpenseCategories] = useState<CategoryItem[]>(() => StorageService.getCategories().expenseTypes);
  const [logs, setLogs] = useState<AuditLog[]>(() => StorageService.getLogs());

  // Modals
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedDetailAccount, setSelectedDetailAccount] = useState<Account | null>(null);

  // Keep selected detail account dynamically synchronized with live accounts
  const activeDetailAccount = useMemo(() => {
    if (!selectedDetailAccount) return null;
    return accounts.find((a) => a.id === selectedDetailAccount.id) || selectedDetailAccount;
  }, [selectedDetailAccount, accounts]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferSourceAccount, setTransferSourceAccount] = useState<Account | null>(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [addTxDefaultType, setAddTxDefaultType] = useState<TransactionType>('expense');
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [receiptScannerMode, setReceiptScannerMode] = useState<'income' | 'expense'>('expense');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerType, setCategoryManagerType] = useState<'income' | 'expense'>('income');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSecretLoansOpen, setIsSecretLoansOpen] = useState(false);
  const [isMyWangAIOpen, setIsMyWangAIOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isMonthlyClosingOpen, setIsMonthlyClosingOpen] = useState(false);

  // Keyboard shortcut for Cmd/Ctrl + K (Global Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync & Feedback
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply dark mode class to html document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mywang_dark_mode', darkMode.toString());
  }, [darkMode]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const newToast: ToastMessage = {
      id: 'toast_' + Date.now() + Math.random(),
      type,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Compute Summary Statistics
  const stats = useMemo(() => {
    return StorageService.computeSummaryStats(accounts, transactions);
  }, [accounts, transactions]);

  // Reload local storage whenever auth state or user changes
  useEffect(() => {
    if (isAuthenticated) {
      const storedAccs = StorageService.getAccounts();
      const storedTxs = StorageService.getTransactions();
      const computedAccs = StorageService.computeLiveAccountBalances(storedAccs, storedTxs);
      setAccounts(computedAccs);
      setTransactions(storedTxs);
    }
  }, [isAuthenticated, user?.username]);

  // Initial Sync Check & Real-Time Background Synchronization
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Google Sheets sync if URL configured
    const config = StorageService.getGoogleSheetsConfig();
    if (config.webAppUrl && config.autoSync) {
      handleManualSync(false);
    }

    // 2. Periodic sync (every 60 seconds) & window focus sync
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const curConfig = StorageService.getGoogleSheetsConfig();
        if (curConfig.webAppUrl && curConfig.autoSync) {
          handleManualSync(false);
        }
        // Flush any pending queue
        StorageService.flushPendingQueue().catch(() => {});
      }
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const curConfig = StorageService.getGoogleSheetsConfig();
        if (curConfig.webAppUrl && curConfig.autoSync) {
          handleManualSync(false);
        }
        StorageService.flushPendingQueue().catch(() => {});
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleVisibility);
    };
  }, [isAuthenticated]);

  // Sync trigger with Deduplication & Real-Time Balances
  const handleManualSync = async (showToast = true) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const gasRes = await StorageService.syncWithGAS('getInitialData');
      
      if (gasRes.success && gasRes.data) {
        let mergedTransactions = transactions;

        if (gasRes.data.transactions && Array.isArray(gasRes.data.transactions)) {
          // Smart Merge to prevent collisions/duplicates (Mencegah data bertindan)
          mergedTransactions = StorageService.mergeAndDeduplicateTransactions(transactions, gasRes.data.transactions);
          setTransactions(mergedTransactions);
          StorageService.saveTransactions(mergedTransactions);
        }

        let syncedAccounts = gasRes.data.accounts && Array.isArray(gasRes.data.accounts) && gasRes.data.accounts.length > 0
          ? gasRes.data.accounts
          : accounts;

        syncedAccounts = StorageService.computeLiveAccountBalances(syncedAccounts, mergedTransactions);
        setAccounts(syncedAccounts);
        StorageService.saveAccounts(syncedAccounts);

        if (showToast) addToast('success', gasRes.message || 'Penyegerakan Google Sheets berjaya!');
      } else {
        if (showToast) {
          if (gasRes.message?.includes('belum ditetapkan')) {
            addToast('info', 'Sila masukkan URL Google Apps Script dalam Tetapan.');
            setIsSyncModalOpen(true);
          } else {
            addToast('info', gasRes.message || 'Data disimpan secara selamat di peranti.');
          }
        }
      }

      // Flush any queued offline actions
      await StorageService.flushPendingQueue();
    } catch (err: any) {
      console.warn('Sync handler error:', err);
      if (showToast) {
        addToast('error', 'Gagal menyegerak: ' + (err.message || 'Ralat sambungan.'));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Save / Update Account (From Pencil Edit)
  const handleSaveAccount = async (updated: Account) => {
    const newAccounts = accounts.map((a) => (a.id === updated.id ? updated : a));
    setAccounts(newAccounts);
    StorageService.saveAccounts(newAccounts);
    
    const newLogs = StorageService.addLog('EDIT_ACCOUNT', `Baki akaun ${updated.account_name} dikemaskini kepada RM ${updated.balance.toFixed(2)}`, user?.username);
    setLogs(newLogs);

    // Synchronous real-time update to Google Sheets
    const syncRes = await StorageService.syncWithGAS('saveAccount', updated);
    if (syncRes.success) {
      addToast('success', syncRes.message || `Baki ${updated.account_name} berjaya disimpan ke Google Sheets.`);
    } else {
      addToast('info', `Baki ${updated.account_name} disimpan di peranti.`);
    }
  };

  // 2. Add New Account
  const handleAddAccount = async (newAcc: Account) => {
    const newAccounts = [...accounts, newAcc];
    setAccounts(newAccounts);
    StorageService.saveAccounts(newAccounts);

    const newLogs = StorageService.addLog('ADD_ACCOUNT', `Akaun baru ditambah: ${newAcc.bank} - ${newAcc.account_name}`, user?.username);
    setLogs(newLogs);

    // Synchronous real-time update to Google Sheets
    const syncRes = await StorageService.syncWithGAS('addAccount', newAcc);
    if (syncRes.success) {
      addToast('success', syncRes.message || `Akaun ${newAcc.account_name} berjaya ditambah ke Google Sheets.`);
    } else {
      addToast('info', `Akaun ${newAcc.account_name} disimpan di peranti.`);
    }
  };

  // 3. Delete Account
  const handleDeleteAccount = async (accId: string) => {
    const target = accounts.find(a => a.id === accId);
    const newAccounts = accounts.filter((a) => a.id !== accId);
    setAccounts(newAccounts);
    StorageService.saveAccounts(newAccounts);

    if (target) {
      const newLogs = StorageService.addLog('DELETE_ACCOUNT', `Akaun dipadam: ${target.account_name}`, user?.username);
      setLogs(newLogs);
    }

    const syncRes = await StorageService.syncWithGAS('deleteAccount', { id: accId, AccountID: accId });
    if (syncRes.success) {
      addToast('info', syncRes.message || 'Akaun berjaya dipadam dari Google Sheets.');
    } else {
      addToast('info', 'Akaun dipadam dari peranti.');
    }
  };

  // 4. Dual-Entry Transfer
  const handleTransfer = async (transferData: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    date: string;
    note: string;
  }) => {
    const fromAcc = accounts.find((a) => a.id === transferData.from_account_id);
    const toAcc = accounts.find((a) => a.id === transferData.to_account_id);

    if (!fromAcc || !toAcc) return;

    const transferAmt = Number(transferData.amount) || 0;

    // Update account balances
    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === fromAcc.id) {
        const newBal = Math.round((acc.balance - transferAmt) * 100) / 100;
        return { ...acc, balance: newBal, updated_at: transferData.date };
      }
      if (acc.id === toAcc.id) {
        const newBal = Math.round((acc.balance + transferAmt) * 100) / 100;
        return { ...acc, balance: newBal, updated_at: transferData.date };
      }
      return acc;
    });

    setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);

    // Record Dual-Entry Transfer Transaction
    const newTx: Transaction = {
      id: 'tf_' + Date.now(),
      date: transferData.date,
      account_id: fromAcc.id,
      account_name: `${fromAcc.bank} - ${fromAcc.account_name}`,
      to_account_id: toAcc.id,
      to_account_name: `${toAcc.bank} - ${toAcc.account_name}`,
      type: 'transfer',
      category: 'Pindahan Dana',
      amount: transferAmt,
      note: transferData.note,
      created_at: new Date().toISOString(),
    };

    const updatedTxList = [newTx, ...transactions];
    setTransactions(updatedTxList);
    StorageService.saveTransactions(updatedTxList);

    const newLogs = StorageService.addLog('TRANSFER', `Pindahan RM ${transferAmt.toFixed(2)} dari ${fromAcc.account_name} ke ${toAcc.account_name}`, user?.username);
    setLogs(newLogs);

    addToast('success', `Pindahan RM ${transferAmt.toFixed(2)} berjaya!`);
    
    const fullTransferPayload = {
      ...transferData,
      amount: transferAmt,
      from_account_name: `${fromAcc.bank} - ${fromAcc.account_name}`,
      to_account_name: `${toAcc.bank} - ${toAcc.account_name}`,
      from_bank: fromAcc.bank,
      to_bank: toAcc.bank,
      username: user?.username || 'user',
    };
    StorageService.enqueueSync('recordTransfer', fullTransferPayload);
  };

  // 5. Add Transaction (Income, Expense, Adjustment, or Scanned Receipt)
  const handleAddTransaction = async (txData: Omit<Transaction, 'id' | 'created_at'>) => {
    const targetAcc = matchAccount(txData.account_id, txData.account_name, accounts, txData.note) || accounts.find((a) => a.id === txData.account_id);
    let updatedAccounts = accounts;
    const txAmount = Number(txData.amount) || 0;
    
    // Auto update account balance
    if (targetAcc) {
      let newBalance = targetAcc.balance;
      if (txData.type === 'income') {
        newBalance = Math.round((newBalance + txAmount) * 100) / 100;
      } else if (txData.type === 'expense') {
        newBalance = Math.round((newBalance - txAmount) * 100) / 100;
      }

      updatedAccounts = accounts.map((a) =>
        a.id === targetAcc.id ? { ...a, balance: newBalance, updated_at: txData.date } : a
      );
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    const newTx: Transaction = {
      ...txData,
      account_id: targetAcc ? targetAcc.id : txData.account_id,
      account_name: targetAcc ? `${targetAcc.bank} - ${targetAcc.account_name}` : txData.account_name,
      amount: txAmount,
      id: 'tx_' + Date.now(),
      created_at: new Date().toISOString(),
    };

    // Merge and save locally first (Instant UI feedback, no hang)
    const updatedList = [newTx, ...transactions];
    setTransactions(updatedList);
    StorageService.saveTransactions(updatedList);

    const newLogs = StorageService.addLog('TRANSACTION', `Transaksi direkod: ${txData.type.toUpperCase()} RM ${txAmount.toFixed(2)} (${txData.category})`, user?.username);
    setLogs(newLogs);

    addToast('success', `Transaksi ${txData.category} RM ${txAmount.toFixed(2)} disimpan.`);

    // Enqueue to GAS
    StorageService.enqueueSync('addTransaction', newTx);
  };

  // 5b. Record Loan Payment from Secret Loans Modal
  const handleRecordLoanPayment = async (loan: LoanFinancing, fromAccountId: string) => {
    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    let updatedAccounts = accounts;
    const installmentAmt = Number(loan.monthly_installment) || 0;
    if (fromAcc) {
      const newBalance = Math.round((fromAcc.balance - installmentAmt) * 100) / 100;
      updatedAccounts = accounts.map((a) =>
        a.id === fromAcc.id ? { ...a, balance: newBalance, updated_at: getMalaysiaDateString() } : a
      );
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    const newTx: Transaction = {
      id: 'tx_loan_' + Date.now(),
      account_id: fromAccountId,
      account_name: fromAcc ? `${fromAcc.bank} - ${fromAcc.account_name}` : 'Akaun Pembayaran',
      type: 'expense',
      category: loan.type === 'hire_purchase' ? 'Ansuran Kereta' : 'Ansuran Pinjaman',
      amount: installmentAmt,
      date: getMalaysiaDateString(),
      note: `Bayaran ansuran bulanan untuk ${loan.name} (${loan.provider})`,
      created_at: new Date().toISOString(),
    };

    const updatedList = [newTx, ...transactions];
    setTransactions(updatedList);
    StorageService.saveTransactions(updatedList);

    const newLogs = StorageService.addLog('LOAN_PAYMENT', `Bayaran pinjaman direkod: RM ${installmentAmt.toFixed(2)} untuk ${loan.name}`, user?.username);
    setLogs(newLogs);
    addToast('success', `Bayaran ansuran ${loan.name} RM ${installmentAmt.toFixed(2)} berjaya direkod!`);
    StorageService.enqueueSync('addTransaction', newTx);
  };

  // 5c. Reorder Accounts (Drag and drop or Shift columns)
  const handleReorderAccounts = (reorderedList: Account[]) => {
    setAccounts(reorderedList);
    StorageService.saveAccounts(reorderedList);
  };

  // 6. Update / Edit Transaction (From Pencil Edit)
  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    let updatedAccounts = [...accounts];
    const newAmt = Number(updatedTx.amount) || 0;
    const oldAmt = oldTx ? Number(oldTx.amount) || 0 : 0;
    
    // Adjust account balance for differences
    if (oldTx) {
      const oldSrc = matchAccount(oldTx.account_id, oldTx.account_name, accounts, oldTx.note);
      const oldDst = oldTx.to_account_id ? matchAccount(oldTx.to_account_id, oldTx.to_account_name, accounts, oldTx.note) : undefined;
      const newSrc = matchAccount(updatedTx.account_id, updatedTx.account_name, accounts, updatedTx.note);
      const newDst = updatedTx.to_account_id ? matchAccount(updatedTx.to_account_id, updatedTx.to_account_name, accounts, updatedTx.note) : undefined;

      // Revert old impact
      if (oldTx.type === 'income' && oldSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === oldSrc.id ? { ...a, balance: Math.round((a.balance - oldAmt) * 100) / 100 } : a
        );
      } else if (oldTx.type === 'expense' && oldSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === oldSrc.id ? { ...a, balance: Math.round((a.balance + oldAmt) * 100) / 100 } : a
        );
      } else if (oldTx.type === 'transfer') {
        if (oldSrc) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === oldSrc.id ? { ...a, balance: Math.round((a.balance + oldAmt) * 100) / 100 } : a
          );
        }
        if (oldDst) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === oldDst.id ? { ...a, balance: Math.round((a.balance - oldAmt) * 100) / 100 } : a
          );
        }
      }

      // Apply new impact
      if (updatedTx.type === 'income' && newSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === newSrc.id ? { ...a, balance: Math.round((a.balance + newAmt) * 100) / 100, updated_at: updatedTx.date } : a
        );
      } else if (updatedTx.type === 'expense' && newSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === newSrc.id ? { ...a, balance: Math.round((a.balance - newAmt) * 100) / 100, updated_at: updatedTx.date } : a
        );
      } else if (updatedTx.type === 'transfer') {
        if (newSrc) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === newSrc.id ? { ...a, balance: Math.round((a.balance - newAmt) * 100) / 100, updated_at: updatedTx.date } : a
          );
        }
        if (newDst) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === newDst.id ? { ...a, balance: Math.round((a.balance + newAmt) * 100) / 100, updated_at: updatedTx.date } : a
          );
        }
      }

      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    const cleanUpdatedTx: Transaction = { ...updatedTx, amount: newAmt };
    const updatedList = transactions.map((t) => (t.id === cleanUpdatedTx.id ? cleanUpdatedTx : t));
    setTransactions(updatedList);
    StorageService.saveTransactions(updatedList);

    const newLogs = StorageService.addLog('UPDATE_TRANSACTION', `Transaksi dikemaskini: ${cleanUpdatedTx.category} RM ${newAmt.toFixed(2)}`, user?.username);
    setLogs(newLogs);

    addToast('success', `Transaksi ${cleanUpdatedTx.category} berjaya dikemaskini.`);
    StorageService.enqueueSync('updateTransaction', cleanUpdatedTx);
  };

  // 7. Delete Transaction (Tong Sampah)
  const handleDeleteTransaction = async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    let updatedAccounts = [...accounts];
    if (target) {
      const tgtAmt = Number(target.amount) || 0;
      const targetSrc = matchAccount(target.account_id, target.account_name, accounts, target.note);
      const targetDst = target.to_account_id ? matchAccount(target.to_account_id, target.to_account_name, accounts, target.note) : undefined;

      // Revert account balance automatically
      if (target.type === 'income' && targetSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === targetSrc.id ? { ...a, balance: Math.round((a.balance - tgtAmt) * 100) / 100 } : a
        );
      } else if (target.type === 'expense' && targetSrc) {
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === targetSrc.id ? { ...a, balance: Math.round((a.balance + tgtAmt) * 100) / 100 } : a
        );
      } else if (target.type === 'transfer') {
        if (targetSrc) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === targetSrc.id ? { ...a, balance: Math.round((a.balance + tgtAmt) * 100) / 100 } : a
          );
        }
        if (targetDst) {
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === targetDst.id ? { ...a, balance: Math.round((a.balance - tgtAmt) * 100) / 100 } : a
          );
        }
      }
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    StorageService.recordDeletedTxId(id);
    const updated = StorageService.filterDeletedTransactions(transactions.filter((t) => t.id !== id));
    setTransactions(updated);
    StorageService.saveTransactions(updated);

    if (target) {
      const newLogs = StorageService.addLog('DELETE_TRANSACTION', `Transaksi dipadam: ${target.category} RM ${(Number(target.amount) || 0).toFixed(2)}`, user?.username);
      setLogs(newLogs);
    }
    addToast('info', 'Transaksi berjaya dipadam.');
    StorageService.enqueueSync('deleteTransaction', { id, transaction_id: id });
    StorageService.syncWithGAS('deleteTransaction', { id, transaction_id: id }).catch(() => {});
  };

  // 8. Save Categories (Income / Expense)
  const handleSaveCategory = async (cat: CategoryItem) => {
    if (cat.type === 'income') {
      const exists = incomeCategories.some((c) => c.id === cat.id);
      const updated = exists ? incomeCategories.map((c) => (c.id === cat.id ? cat : c)) : [...incomeCategories, cat];
      setIncomeCategories(updated);
      StorageService.saveCategories(updated, expenseCategories);
    } else {
      const exists = expenseCategories.some((c) => c.id === cat.id);
      const updated = exists ? expenseCategories.map((c) => (c.id === cat.id ? cat : c)) : [...expenseCategories, cat];
      setExpenseCategories(updated);
      StorageService.saveCategories(incomeCategories, updated);
    }
    addToast('success', `Kategori "${cat.name}" disimpan.`);
    StorageService.syncWithGAS('saveCategory', cat).catch(console.error);
  };

  const handleDeleteCategory = async (catId: string, type: 'income' | 'expense') => {
    if (type === 'income') {
      const updated = incomeCategories.filter((c) => c.id !== catId);
      setIncomeCategories(updated);
      StorageService.saveCategories(updated, expenseCategories);
    } else {
      const updated = expenseCategories.filter((c) => c.id !== catId);
      setExpenseCategories(updated);
      StorageService.saveCategories(incomeCategories, updated);
    }
    addToast('info', 'Kategori dipadam.');
    StorageService.syncWithGAS('deleteCategory', { id: catId, type }).catch(console.error);
  };

  // 9. Reset All Amounts to RM 0.00 & Wipe Dummy Records
  const handleResetAllAmounts = () => {
    const { accounts: zeroedAccs, transactions: zeroedTxs } = StorageService.resetAllAmountsToZero();
    setAccounts(zeroedAccs);
    setTransactions(zeroedTxs);
    const updatedLogs = StorageService.getLogs();
    setLogs(updatedLogs);
    addToast('success', 'Semua baki akaun telah ditetapkan kepada RM 0.00 & rekod transaksi dummy telah dibuang.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Memuatkan MyWang...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col justify-between">
      
      {/* Toast Messages */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div>
        {/* Global Navigation Header */}
        <Header
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
          onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
          onOpenTransferModal={() => {
            setTransferSourceAccount(null);
            setIsTransferOpen(true);
          }}
          onOpenAddAccountModal={() => setIsAddAccountOpen(true)}
          onOpenAddTransactionModal={() => {
            setAddTxDefaultType('expense');
            setIsAddTxOpen(true);
          }}
          onOpenSecretLoans={() => setIsSecretLoansOpen(true)}
          onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
          onOpenMyWangAI={() => setIsMyWangAIOpen(true)}
          onOpenMonthlyClosing={() => setIsMonthlyClosingOpen(true)}
          onManualSync={() => handleManualSync(true)}
          isSyncing={isSyncing}
          unreadNotificationsCount={1}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Top Summary Statistics Cards */}
          <SummaryCards stats={stats} />

          {/* Module Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              {[
                { id: 'dashboard', label: 'Akaun & Gambaran', icon: LayoutDashboard },
                { id: 'transactions', label: 'Lejar Transaksi', icon: ReceiptText, count: transactions.length },
                { id: 'income', label: 'Duit Masuk', icon: ArrowDownLeft },
                { id: 'expense', label: 'Duit Keluar', icon: ArrowUpRight },
                { id: 'analytics', label: 'Carta & Analisis', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-850'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secret Vault Entry Button */}
            <div className="flex items-center pl-2">
              <button
                onClick={() => setIsSecretLoansOpen(true)}
                id="btn_tab_secret_vault"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-950 hover:bg-slate-850 text-amber-300 dark:text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10 hover:shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>🔒 Secret Vault (Loan)</span>
              </button>
            </div>
          </div>

          {/* Tab Views */}
          <div className="mt-4">
            {activeTab === 'dashboard' && (
              <AccountsGrid
                accounts={accounts}
                transactions={transactions}
                onSelectAccount={(acc) => setSelectedDetailAccount(acc)}
                onEditAccount={(acc) => setEditingAccount(acc)}
                onQuickTransfer={(acc) => {
                  setTransferSourceAccount(acc);
                  setIsTransferOpen(true);
                }}
                onAddAccount={() => setIsAddAccountOpen(true)}
                onRefreshData={() => handleManualSync(true)}
                onReorderAccounts={handleReorderAccounts}
                isSyncing={isSyncing}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsModule
                transactions={transactions}
                accounts={accounts}
                stats={stats}
                onAddTransaction={() => {
                  setAddTxDefaultType('expense');
                  setIsAddTxOpen(true);
                }}
                onEditTransaction={(tx) => setEditingTransaction(tx)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'income' && (
              <IncomeModule
                transactions={transactions}
                accounts={accounts}
                incomeCategories={incomeCategories}
                onAddIncome={() => {
                  setAddTxDefaultType('income');
                  setIsAddTxOpen(true);
                }}
                onOpenReceiptScanner={() => {
                  setReceiptScannerMode('income');
                  setIsReceiptScannerOpen(true);
                }}
                onOpenCategoryManager={() => {
                  setCategoryManagerType('income');
                  setIsCategoryManagerOpen(true);
                }}
                onEditTransaction={(tx) => setEditingTransaction(tx)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'expense' && (
              <ExpenseModule
                transactions={transactions}
                accounts={accounts}
                expenseCategories={expenseCategories}
                onAddExpense={() => {
                  setAddTxDefaultType('expense');
                  setIsAddTxOpen(true);
                }}
                onOpenReceiptScanner={() => {
                  setReceiptScannerMode('expense');
                  setIsReceiptScannerOpen(true);
                }}
                onOpenCategoryManager={() => {
                  setCategoryManagerType('expense');
                  setIsCategoryManagerOpen(true);
                }}
                onEditTransaction={(tx) => setEditingTransaction(tx)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsCharts
                accounts={accounts}
                transactions={transactions}
                darkMode={darkMode}
              />
            )}
          </div>

        </main>
      </div>

      {/* Modern Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
            <span>MyWang</span>
            <span>•</span>
            <span className="font-normal italic">One Dashboard. Every Ringgit.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              Google Sheets Live Sync
            </span>
            <span>•</span>
            <span>Versi 1.0.0 Production</span>
          </div>
        </div>
      </footer>

      {/* Floating Action Button Speed-Dial */}
      <FloatingActionButton
        onAddTransaction={() => {
          setAddTxDefaultType('expense');
          setIsAddTxOpen(true);
        }}
        onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
        onOpenTransferModal={() => {
          setTransferSourceAccount(null);
          setIsTransferOpen(true);
        }}
        onOpenAddAccountModal={() => setIsAddAccountOpen(true)}
      />

      {/* Global Modals */}

      {/* 1. Edit Account Pencil Popup */}
      <EditAccountModal
        isOpen={!!editingAccount}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={handleSaveAccount}
        onDelete={handleDeleteAccount}
      />

      {/* 2. Add New Account Popup */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onAdd={handleAddAccount}
      />

      {/* 3. Dual-Entry Transfer Popup */}
      <TransferModal
        isOpen={isTransferOpen}
        accounts={accounts}
        initialSourceAccount={transferSourceAccount}
        onClose={() => setIsTransferOpen(false)}
        onTransfer={handleTransfer}
      />

      {/* 4. Add Transaction Popup */}
      <AddTransactionModal
        isOpen={isAddTxOpen}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        defaultType={addTxDefaultType}
        onClose={() => setIsAddTxOpen(false)}
        onAddTransaction={handleAddTransaction}
      />

      {/* 4b. Edit Transaction Popup (Pencil) */}
      <EditTransactionModal
        isOpen={!!editingTransaction}
        transaction={editingTransaction}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onClose={() => setEditingTransaction(null)}
        onSave={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* 5. AI Smart Receipt OCR Scanner (Income / Expense) */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        accounts={accounts}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        initialMode={receiptScannerMode}
        onClose={() => setIsReceiptScannerOpen(false)}
        onSaveScannedTransaction={handleAddTransaction}
      />

      {/* 6. Category Manager Popup */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        type={categoryManagerType}
        categories={categoryManagerType === 'income' ? incomeCategories : expenseCategories}
        onClose={() => setIsCategoryManagerOpen(false)}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* 7. Google Sheets Settings & Template Download */}
      <GoogleSheetsSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => handleManualSync(false)}
        onResetAllAmounts={handleResetAllAmounts}
        onDataRestored={() => {
          const freshAccs = StorageService.getAccounts();
          const freshTxs = StorageService.getTransactions();
          const computed = StorageService.computeLiveAccountBalances(freshAccs, freshTxs);
          setTransactions(freshTxs);
          setAccounts(computed);
          const cats = StorageService.getCategories();
          setIncomeCategories(cats.incomeTypes);
          setExpenseCategories(cats.expenseTypes);
          addToast('success', 'Data berjaya disegerakkan dan dikira semula!');
        }}
      />

      {/* 8. Audit Logs Activity */}
      <AuditLogsModal
        isOpen={isAuditLogsOpen}
        logs={logs}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      {/* 9. Notification Center */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        stats={stats}
        onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* 10. Secret Loans & Financing Vault Modal */}
      <SecretLoansModal
        isOpen={isSecretLoansOpen}
        onClose={() => setIsSecretLoansOpen(false)}
        accounts={accounts}
        onRecordPayment={handleRecordLoanPayment}
      />

      {/* 11. Account Details 4-Tab Dashboard (Overview, History, Trend, Statement) */}
      <AccountDetailsModal
        isOpen={!!activeDetailAccount}
        account={activeDetailAccount}
        transactions={transactions}
        accounts={accounts}
        onClose={() => setSelectedDetailAccount(null)}
        onEditAccount={(acc) => {
          setSelectedDetailAccount(null);
          setEditingAccount(acc);
        }}
        onQuickTransfer={(acc) => {
          setSelectedDetailAccount(null);
          setTransferSourceAccount(acc);
          setIsTransferOpen(true);
        }}
        onEditTransaction={(tx) => setEditingTransaction(tx)}
        onDeleteTransaction={(id) => handleDeleteTransaction(id)}
      />

      {/* 12. MyWang AI Financial Advisor Chat Modal */}
      <MyWangAIModal
        isOpen={isMyWangAIOpen}
        onClose={() => setIsMyWangAIOpen(false)}
        accounts={accounts}
        transactions={transactions}
        stats={stats}
        user={user}
      />

      {/* 13. Global Search & Command Palette Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        accounts={accounts}
        transactions={transactions}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSelectAccount={(acc) => {
          setIsGlobalSearchOpen(false);
          setSelectedDetailAccount(acc);
        }}
        onSelectTransaction={(tx) => {
          setIsGlobalSearchOpen(false);
          setEditingTransaction(tx);
        }}
      />

      {/* 14. Monthly Closing & Reconciliation Modal */}
      <MonthlyClosingModal
        isOpen={isMonthlyClosingOpen}
        onClose={() => setIsMonthlyClosingOpen(false)}
        accounts={accounts}
        transactions={transactions}
        user={user}
        onMonthClosed={(rec) => {
          addToast('success', `Bulan ${rec.month_name} berjaya ditutup & disahihkan.`);
        }}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}
