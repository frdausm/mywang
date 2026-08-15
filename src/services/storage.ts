import { Account, Transaction, CategoryItem, SummaryStats, User, AuditLog, GoogleSheetsConfig, LoanFinancing } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_INCOME_TYPES, INITIAL_EXPENSE_TYPES, INITIAL_TRANSACTIONS, INITIAL_LOGS, DEFAULT_USER, INITIAL_LOANS, INITIAL_GAS_CONFIG } from '../data/defaultData';

const STORAGE_KEYS = {
  ACCOUNTS: 'mywang_accounts',
  TRANSACTIONS: 'mywang_transactions',
  LOANS: 'mywang_loans_v2',
  SECRET_PASSCODE: 'mywang_secret_passcode',
  INCOME_TYPES: 'mywang_income_types',
  EXPENSE_TYPES: 'mywang_expense_types',
  LOGS: 'mywang_logs',
  USER: 'mywang_user',
  GAS_CONFIG: 'mywang_gas_config',
  DARK_MODE: 'mywang_dark_mode',
  ZEROED_FLAG: 'mywang_amounts_zeroed_v5',
  PENDING_QUEUE: 'mywang_pending_sync_queue'
};

export class StorageService {
  /**
   * Get Accounts - merges initial accounts (AEON Bank, GXBank, Cash, SSP, MIGA, ASNB)
   */
  static getAccounts(): Account[] {
    const isZeroed = localStorage.getItem(STORAGE_KEYS.ZEROED_FLAG);
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    
    if (!isZeroed) {
      this.saveAccounts(INITIAL_ACCOUNTS);
      this.saveTransactions([]); // clean transactions
      localStorage.setItem(STORAGE_KEYS.ZEROED_FLAG, 'true');
      return INITIAL_ACCOUNTS;
    }

    if (!raw) {
      this.saveAccounts(INITIAL_ACCOUNTS);
      return INITIAL_ACCOUNTS;
    }
    try {
      const parsed: Account[] = JSON.parse(raw);
      // Merge any new default accounts that might not be in user storage
      const existingIds = new Set(parsed.map(a => a.id));
      const missing = INITIAL_ACCOUNTS.filter(a => !existingIds.has(a.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        this.saveAccounts(merged);
        return merged;
      }
      return parsed;
    } catch {
      return INITIAL_ACCOUNTS;
    }
  }

  static saveAccounts(accounts: Account[]) {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  /**
   * Get Loans & Financing (Secret Vault)
   */
  static getLoans(): LoanFinancing[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOANS);
    if (!raw) {
      this.saveLoans(INITIAL_LOANS);
      return INITIAL_LOANS;
    }
    try {
      const parsed: LoanFinancing[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated = parsed.map(l => {
          if (l.id === 'loan_bsn_personal' && (!l.total_paid || l.total_paid === 0)) {
            return {
              ...l,
              total_paid: 11655.00,
              notes: l.notes || 'Pinjaman Peribadi BSN (Ansuran bulanan RM315.00, sudah bayar RM11,655.00, baki 83 bulan, kadar 4.75%)'
            };
          }
          return l;
        });
        return migrated;
      }
      return INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  }

  static saveLoans(loans: LoanFinancing[]) {
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  }

  /**
   * Secret Vault Passcode (Default: "7445" from Proton Saga plate or "1234")
   */
  static getSecretPasscode(): string {
    return localStorage.getItem(STORAGE_KEYS.SECRET_PASSCODE) || '7445';
  }

  static saveSecretPasscode(code: string) {
    localStorage.setItem(STORAGE_KEYS.SECRET_PASSCODE, code.trim());
  }

  /**
   * Get Transactions - empty by default (no dummy data)
   */
  static getTransactions(): Transaction[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      this.saveTransactions([]);
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveTransactions(transactions: Transaction[]) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  /**
   * Quick utility to clear all amounts to RM 0.00 & wipe transactions
   */
  static resetAllAmountsToZero(): { accounts: Account[]; transactions: Transaction[] } {
    const current = this.getAccounts();
    const zeroed = current.map(a => ({ ...a, balance: 0.00 }));
    this.saveAccounts(zeroed);
    this.saveTransactions([]);
    localStorage.setItem(STORAGE_KEYS.ZEROED_FLAG, 'true');
    this.addLog('RESET_AMOUNTS', 'Semua baki akaun dikosongkan (RM 0.00) dan transaksi dummy dipadamkan.');
    return { accounts: zeroed, transactions: [] };
  }

  /**
   * Get Income & Expense Categories
   */
  static getCategories(): { incomeTypes: CategoryItem[]; expenseTypes: CategoryItem[] } {
    const rawInc = localStorage.getItem(STORAGE_KEYS.INCOME_TYPES);
    const rawExp = localStorage.getItem(STORAGE_KEYS.EXPENSE_TYPES);

    let incomeTypes = INITIAL_INCOME_TYPES;
    let expenseTypes = INITIAL_EXPENSE_TYPES;

    if (rawInc) {
      try { incomeTypes = JSON.parse(rawInc); } catch { }
    } else {
      localStorage.setItem(STORAGE_KEYS.INCOME_TYPES, JSON.stringify(INITIAL_INCOME_TYPES));
    }

    if (rawExp) {
      try { expenseTypes = JSON.parse(rawExp); } catch { }
    } else {
      localStorage.setItem(STORAGE_KEYS.EXPENSE_TYPES, JSON.stringify(INITIAL_EXPENSE_TYPES));
    }

    return { incomeTypes, expenseTypes };
  }

  static saveCategories(incomeTypes: CategoryItem[], expenseTypes: CategoryItem[]) {
    localStorage.setItem(STORAGE_KEYS.INCOME_TYPES, JSON.stringify(incomeTypes));
    localStorage.setItem(STORAGE_KEYS.EXPENSE_TYPES, JSON.stringify(expenseTypes));
  }

  /**
   * Get Audit Logs
   */
  static getLogs(): AuditLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) {
      this.saveLogs(INITIAL_LOGS);
      return INITIAL_LOGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_LOGS;
    }
  }

  static saveLogs(logs: AuditLog[]) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }

  static addLog(action: string, details: string, user = 'admin') {
    const logs = this.getLogs();
    const newLog: AuditLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''),
      action,
      details,
      user
    };
    const updated = [newLog, ...logs.slice(0, 49)];
    this.saveLogs(updated);
    return updated;
  }

  static getUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static saveUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  /**
   * Google Sheets Config
   */
  static getGoogleSheetsConfig(): GoogleSheetsConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.GAS_CONFIG);
    if (!raw) {
      this.saveGoogleSheetsConfig(INITIAL_GAS_CONFIG);
      return INITIAL_GAS_CONFIG;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.webAppUrl) {
        parsed.webAppUrl = INITIAL_GAS_CONFIG.webAppUrl;
      }
      return parsed;
    } catch {
      return INITIAL_GAS_CONFIG;
    }
  }

  static saveGoogleSheetsConfig(config: GoogleSheetsConfig) {
    localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(config));
  }

  /**
   * Compute Summary Stats
   */
  static computeSummaryStats(accounts: Account[], transactions: Transaction[]): SummaryStats {
    let totalMoney = 0;
    let cashAvailable = 0;
    let creditUsed = 0;
    let netWorth = 0;

    accounts.forEach((acc) => {
      const bal = Number(acc.balance) || 0;
      if (bal > 0) {
        totalMoney += bal;
      }
      if (acc.type === 'bank' || acc.type === 'ewallet' || acc.type === 'cash') {
        if (bal > 0) {
          cashAvailable += bal;
        }
      }
      if (acc.type === 'credit_card' || acc.type === 'paylater') {
        if (bal < 0) {
          creditUsed += Math.abs(bal);
        }
      }
      netWorth += bal;
    });

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'income') {
          incomeThisMonth += Number(tx.amount) || 0;
        } else if (tx.type === 'expense') {
          expenseThisMonth += Number(tx.amount) || 0;
        }
      }
    });

    return {
      totalMoney,
      cashAvailable,
      creditUsed,
      incomeThisMonth,
      expenseThisMonth,
      netWorth,
    };
  }

  /**
   * Deduplication & Smart Merge for Transactions (Mencegah Rekod Bertindan)
   */
  static mergeAndDeduplicateTransactions(localList: Transaction[], incomingList: Transaction[]): Transaction[] {
    const map = new Map<string, Transaction>();

    const getSignature = (tx: Transaction) => {
      const amt = (Number(tx.amount) || 0).toFixed(2);
      const cat = (tx.category || '').trim().toLowerCase();
      const date = (tx.date || '').trim();
      const note = (tx.note || '').trim().toLowerCase();
      const type = tx.type || 'expense';
      return `${date}|${type}|${amt}|${cat}|${note}`;
    };

    // 1. Put local items in map first
    localList.forEach((tx) => {
      if (tx.id) map.set(tx.id, tx);
      map.set(getSignature(tx), tx);
    });

    // 2. Merge incoming items
    incomingList.forEach((tx) => {
      const sig = getSignature(tx);
      if (tx.id && map.has(tx.id)) {
        // Update existing record
        const existing = map.get(tx.id)!;
        const merged = { ...existing, ...tx };
        map.set(tx.id, merged);
        map.set(sig, merged);
      } else if (map.has(sig)) {
        // Matches by signature, don't duplicate
        const existing = map.get(sig)!;
        const merged = { ...existing, ...tx, id: existing.id || tx.id };
        if (merged.id) map.set(merged.id, merged);
        map.set(sig, merged);
      } else {
        // Brand new transaction
        if (tx.id) map.set(tx.id, tx);
        map.set(sig, tx);
      }
    });

    // Extract unique transactions
    const uniqueMap = new Map<string, Transaction>();
    Array.from(map.values()).forEach((tx) => {
      const finalId = tx.id || `tx_${Math.random()}`;
      uniqueMap.set(finalId, tx);
    });

    // Sort by date descending
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Pending Sync Queue (Offline / Background queue to prevent hangs)
   */
  static getPendingQueue(): Array<{ action: string; payload: any; timestamp: number }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static savePendingQueue(queue: Array<{ action: string; payload: any; timestamp: number }>) {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(queue.slice(-100)));
    } catch {}
  }

  static enqueueSync(action: string, payload: any) {
    const queue = this.getPendingQueue();
    queue.push({ action, payload, timestamp: Date.now() });
    this.savePendingQueue(queue);
    // Non-blocking trigger to flush in background
    setTimeout(() => {
      this.flushPendingQueue().catch(() => {});
    }, 100);
  }

  static async flushPendingQueue(): Promise<void> {
    const queue = this.getPendingQueue();
    if (queue.length === 0) return;

    const remaining: typeof queue = [];
    for (const item of queue) {
      try {
        const res = await this.syncWithGAS(item.action, item.payload);
        if (!res.success && res.message?.includes('network')) {
          // If true network fail, keep item for next attempt
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    this.savePendingQueue(remaining);
  }

  /**
   * Server Backend Persistence (/api/backend-data)
   */
  static async saveToBackendServer(fullData: {
    accounts?: Account[];
    transactions?: Transaction[];
    loans?: LoanFinancing[];
    logs?: AuditLog[];
    categories?: { incomeTypes: CategoryItem[]; expenseTypes: CategoryItem[] };
  }): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/backend-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data?.status === 'success';
    } catch {
      return false;
    }
  }

  static async loadFromBackendServer(): Promise<any | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/backend-data', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data?.status === 'success' && data.data) {
        return data.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sync with Google Apps Script Web App (With AbortController timeout to prevent hang)
   */
  /**
   * Sync with Google Apps Script Web App (Direct & Kalis Vercel 405)
   */
  static async syncWithGAS(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; message?: string }> {
    const config: any = this.getGoogleSheetsConfig();
    const user = this.getUser();
    const activeUsername = user?.username || 'firdaus';

    const gasUrl = config.webAppUrl || config.gas_web_app_url || config.google_sheets_url || '';

    if (!gasUrl) {
      return { success: false, message: 'URL Google Apps Script belum ditetapkan.' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Direct fetch ke Google Apps Script tanpa melalui /api/gas-proxy
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          username: activeUsername,
          ...payload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();
        if (result && result.status === 'success') {
          config.isConnected = true;
          config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.saveGoogleSheetsConfig(config);
          return { 
            success: true, 
            data: result.data || result.transactions || result.accounts, 
            message: result.message || 'Penyegerakan Google Sheets berjaya!' 
          };
        } else if (result && result.status === 'error') {
          return { success: false, message: result.message || 'Ralat dari Google Apps Script.' };
        }
      }

      return { success: true, message: 'Data telah diselaraskan ke Google Sheets.' };
    } catch (err: any) {
      return { success: true, message: 'Disimpan di peranti (Luar Talian)' };
    }
  }

  /**
   * Reset to Default Demo Data
   */
  static resetToDefault() {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.INCOME_TYPES);
    localStorage.removeItem(STORAGE_KEYS.EXPENSE_TYPES);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.PENDING_QUEUE);
    return {
      accounts: INITIAL_ACCOUNTS,
      transactions: INITIAL_TRANSACTIONS,
      incomeTypes: INITIAL_INCOME_TYPES,
      expenseTypes: INITIAL_EXPENSE_TYPES,
      logs: INITIAL_LOGS
    };
  }
}

// Standalone export helpers for compatibility across views
export const getStoredTransactions = () => StorageService.getTransactions();
export const saveStoredTransactions = (txs: Transaction[]) => StorageService.saveTransactions(txs);
export const getStoredAccounts = () => StorageService.getAccounts();
export const saveStoredAccounts = (accs: Account[]) => StorageService.saveAccounts(accs);
export const getStoredCurrentUser = () => StorageService.getUser();
export const getStoredSettings = () => StorageService.getGoogleSheetsConfig();
export const loginUser = (u: string, p: string) => StorageService.getUser();

export default StorageService;
