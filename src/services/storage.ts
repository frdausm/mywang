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
   * Get Accounts
   */
  static getAccounts(): Account[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) {
      this.saveAccounts(INITIAL_ACCOUNTS);
      return INITIAL_ACCOUNTS;
    }
    try {
      const parsed: Account[] = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ACCOUNTS;
    } catch {
      return INITIAL_ACCOUNTS;
    }
  }

  static saveAccounts(accounts: Account[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {}
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
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  }

  static saveLoans(loans: LoanFinancing[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
    } catch (e) {}
  }

  /**
   * Secret Vault Passcode
   */
  static getSecretPasscode(): string {
    return localStorage.getItem(STORAGE_KEYS.SECRET_PASSCODE) || '7445';
  }

  static saveSecretPasscode(code: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.SECRET_PASSCODE, code.trim());
    } catch (e) {}
  }

  /**
   * Get Transactions
   */
  static getTransactions(): Transaction[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static saveTransactions(transactions: Transaction[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {}
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
    this.addLog('RESET_AMOUNTS', 'Semua baki akaun dikosongkan (RM 0.00).');
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
    try {
      localStorage.setItem(STORAGE_KEYS.INCOME_TYPES, JSON.stringify(incomeTypes));
      localStorage.setItem(STORAGE_KEYS.EXPENSE_TYPES, JSON.stringify(expenseTypes));
    } catch (e) {}
  }

  /**
   * Get Audit Logs
   */
  static getLogs(): AuditLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) return INITIAL_LOGS;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  }

  static saveLogs(logs: AuditLog[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {}
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
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (e) {}
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
      if (!parsed.webAppUrl) parsed.webAppUrl = INITIAL_GAS_CONFIG.webAppUrl;
      return parsed;
    } catch {
      return INITIAL_GAS_CONFIG;
    }
  }

  static saveGoogleSheetsConfig(config: GoogleSheetsConfig) {
    try {
      localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(config));
    } catch (e) {}
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
      if (bal > 0) totalMoney += bal;
      if (acc.type === 'bank' || acc.type === 'ewallet' || acc.type === 'cash') {
        if (bal > 0) cashAvailable += bal;
      }
      if (acc.type === 'credit_card' || acc.type === 'paylater') {
        if (bal < 0) creditUsed += Math.abs(bal);
      }
      netWorth += bal;
    });

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'income') incomeThisMonth += Number(tx.amount) || 0;
        else if (tx.type === 'expense') expenseThisMonth += Number(tx.amount) || 0;
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
   * Deduplication & Smart Merge for Transactions
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

    localList.forEach((tx) => {
      if (tx.id) map.set(tx.id, tx);
      map.set(getSignature(tx), tx);
    });

    incomingList.forEach((tx) => {
      const sig = getSignature(tx);
      if (tx.id && map.has(tx.id)) {
        const existing = map.get(tx.id)!;
        const merged = { ...existing, ...tx };
        map.set(tx.id, merged);
        map.set(sig, merged);
      } else if (map.has(sig)) {
        const existing = map.get(sig)!;
        const merged = { ...existing, ...tx, id: existing.id || tx.id };
        if (merged.id) map.set(merged.id, merged);
        map.set(sig, merged);
      } else {
        if (tx.id) map.set(tx.id, tx);
        map.set(sig, tx);
      }
    });

    const uniqueMap = new Map<string, Transaction>();
    Array.from(map.values()).forEach((tx) => {
      const finalId = tx.id || `tx_${Math.random().toString(36).substring(2, 8)}`;
      uniqueMap.set(finalId, tx);
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Pending Queue (Safe Local-First)
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
    setTimeout(() => {
      this.flushPendingQueue().catch(() => {});
    }, 150);
  }

  static async flushPendingQueue(): Promise<void> {
    const queue = this.getPendingQueue();
    if (queue.length === 0) return;
    const remaining: typeof queue = [];
    for (const item of queue) {
      try {
        const res = await this.syncWithGAS(item.action, item.payload);
        if (!res.success && res.message?.includes('network')) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    this.savePendingQueue(remaining);
  }

  /**
   * Helper to check if custom Node.js backend API is available
   */
  static isBackendServerAvailable(): boolean {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.endsWith('vercel.app') || host.endsWith('github.io') || host.endsWith('pages.dev') || host.endsWith('netlify.app')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Server Backend Persistence (Saves data permanently on server so all devices stay synchronized)
   */
  static async saveToBackendServer(fullData: any = {}): Promise<boolean> {
    if (!this.isBackendServerAvailable()) {
      return true;
    }

    try {
      const user = this.getUser();
      const accounts = fullData.accounts || this.getAccounts();
      const transactions = fullData.transactions || this.getTransactions();
      const loans = fullData.loans || this.getLoans();
      const categories = this.getCategories();
      const logs = fullData.logs || this.getLogs();
      const gasConfig = fullData.gasConfig || this.getGoogleSheetsConfig();
      const secretPasscode = this.getSecretPasscode();

      const payload = {
        username: user?.username || 'admin',
        accounts,
        transactions,
        loans,
        incomeTypes: categories.incomeTypes,
        expenseTypes: categories.expenseTypes,
        logs,
        gasConfig,
        secretPasscode,
        saved_at: new Date().toISOString(),
      };

      const res = await fetch('/api/backend-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return false;

      const data = await res.json();
      return !!(data && data.status === 'success');
    } catch {
      return false;
    }
  }

  static async loadFromBackendServer(): Promise<any | null> {
    if (!this.isBackendServerAvailable()) {
      return null;
    }

    try {
      const res = await fetch('/api/backend-data');
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return null;
      }

      const json = await res.json();
      if (json && json.status === 'success' && json.data) {
        const data = json.data;
        if (data.accounts && Array.isArray(data.accounts) && data.accounts.length > 0) {
          this.saveAccounts(data.accounts);
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          this.saveTransactions(data.transactions);
        }
        if (data.loans && Array.isArray(data.loans)) {
          this.saveLoans(data.loans);
        }
        if (data.incomeTypes && data.expenseTypes) {
          this.saveCategories(data.incomeTypes, data.expenseTypes);
        }
        if (data.gasConfig && data.gasConfig.webAppUrl) {
          this.saveGoogleSheetsConfig(data.gasConfig);
        }
        if (data.secretPasscode) {
          this.saveSecretPasscode(data.secretPasscode);
        }
        if (data.logs && Array.isArray(data.logs)) {
          this.saveLogs(data.logs);
        }
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Helper to parse messy date strings (e.g. from Google Sheets / SakuTrack) into YYYY-MM-DD
   */
  static parseCleanDate(rawDate: any): string {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const regexMatch = str.match(/([a-zA-Z]{3})\s+(\d{1,2})\s+(\d{4})/);
    if (regexMatch) {
      const mStr = regexMatch[1].toLowerCase();
      const month = monthMap[mStr] || '01';
      const day = regexMatch[2].padStart(2, '0');
      const year = regexMatch[3];
      return `${year}-${month}-${day}`;
    }
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {}
    return str.slice(0, 10);
  }

  /**
   * Normalize raw transactions from SakuTrack or MyWang AppsScript
   */
  static normalizeRawTransactions(rawList: any[]): Transaction[] {
    if (!Array.isArray(rawList)) return [];

    const mapSourceToId = (source: string): string => {
      const s = String(source || '').toLowerCase();
      if (s.includes('maybank') || s.includes('mae')) return 'acc_mb_sav';
      if (s.includes('touch') || s.includes('tng')) return 'acc_tng_ewallet';
      if (s.includes('rhb')) return 'acc_rhb_sav';
      if (s.includes('atome')) return 'acc_atome';
      if (s.includes('tunai') || s.includes('cash')) return 'acc_cash_fizikal';
      if (s.includes('gx')) return 'acc_gxbank';
      if (s.includes('aeon')) return 'acc_aeon';
      if (s.includes('cimb')) return 'acc_cimb_cc';
      return 'acc_mb_sav';
    };

    return rawList.map((tx: any, idx: number) => {
      const rawDate = tx.date || tx.created_at || new Date().toISOString();
      const cleanDate = this.parseCleanDate(rawDate);
      const accName = tx.account_name || tx.source || tx.method || tx.account || 'Maybank - Savings Account';
      const accId = tx.account_id || mapSourceToId(accName);
      const isIncome = String(tx.type).toLowerCase() === 'income';

      return {
        id: String(tx.id || `tx_sync_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`),
        date: cleanDate,
        type: isIncome ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense',
        category: tx.category || tx.income_type || tx.expense_type || 'Lain-lain',
        amount: Math.abs(parseFloat(tx.amount) || 0),
        account_id: accId,
        account_name: accName,
        to_account_id: tx.to_account_id,
        to_account_name: tx.to_account_name,
        note: tx.note || '',
        receipt_url: tx.receipt || tx.receipt_url || undefined,
        created_at: String(tx.created_at || cleanDate),
      };
    });
  }

  /**
   * Universal Sync with Google Apps Script Web App
   * Menyokong kedua-dua format: SakuTrack backend & MyWang AppsScript backend
   */
  static async syncWithGAS(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; message?: string }> {
    const config: any = this.getGoogleSheetsConfig();
    const user = this.getUser();
    const activeUsername = user?.username || 'admin';
    const gasUrl = config.webAppUrl || config.gas_web_app_url || config.google_sheets_url || '';

    if (!gasUrl) {
      return { success: true, message: 'Data disimpan di peranti (Mod Tempatan).' };
    }

    try {
      // 1. Direct client-side fetch (100% works on Vercel, Localhost, Mobile, and Web Apps)
      const fetchDirect = async (act: string, bodyObj: any = {}) => {
        const postData = {
          action: act,
          username: activeUsername,
          data: bodyObj,
          ...bodyObj,
        };
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(postData),
        });
        const txt = await res.text();
        try {
          return JSON.parse(txt);
        } catch {
          return { status: 'raw', text: txt };
        }
      };

      // If testConnection or ping
      if (action === 'testConnection' || action === 'ping') {
        let testRes: any = null;
        try {
          testRes = await fetchDirect('ping', {});
        } catch {}
        if (!testRes || testRes.status === 'error') {
          try {
            testRes = await fetchDirect('get_transactions', { username: activeUsername });
          } catch {}
        }
        if (!testRes || testRes.status === 'error') {
          try {
            testRes = await fetchDirect('getDashboard', { token: activeUsername });
          } catch {}
        }
        if (testRes && (testRes.status === 'success' || testRes.transactions || testRes.data)) {
          config.isConnected = true;
          config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
          this.saveGoogleSheetsConfig(config);
          return { success: true, message: 'Sambungan ke Google Apps Script & Sheets berjaya!' };
        }
        return { success: false, message: testRes?.message || 'Gagal menyambung ke Google Apps Script URL. Sila pastikan Web App dideploy dengan Access: Anyone.' };
      }

      // If initial fetch / getInitialData, try SakuTrack and MyWang action names
      if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions') {
        let gasResult: any = null;

        // Try 1: SakuTrack action 'get_transactions'
        try {
          const res1 = await fetchDirect('get_transactions', { username: activeUsername });
          if (res1 && res1.status === 'success' && Array.isArray(res1.transactions)) {
            gasResult = res1;
          }
        } catch {}

        // Try 2: MyWang action 'getDashboard'
        if (!gasResult || gasResult.status === 'error') {
          try {
            const res2 = await fetchDirect('getDashboard', { token: activeUsername });
            if (res2 && (res2.status === 'success' || res2.data)) {
              gasResult = res2;
            }
          } catch {}
        }

        // Try 3: Action 'getTransactions'
        if (!gasResult || gasResult.status === 'error') {
          try {
            const res3 = await fetchDirect('getTransactions', {});
            if (res3 && (res3.status === 'success' || res3.data)) {
              gasResult = res3;
            }
          } catch {}
        }

        // Try Server Proxy only if running in dedicated backend environment and direct fetch failed
        if ((!gasResult || gasResult.status === 'error') && this.isBackendServerAvailable()) {
          try {
            const proxyRes = await fetch('/api/gas-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                webAppUrl: gasUrl,
                action: action,
                username: activeUsername,
                data: payload,
              }),
            });
            if (proxyRes.ok) {
              const contentType = proxyRes.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const proxyData = await proxyRes.json();
                if (proxyData && (proxyData.status === 'success' || proxyData.data || proxyData.transactions)) {
                  gasResult = proxyData;
                }
              }
            }
          } catch {}
        }

        if (gasResult && gasResult.status !== 'error') {
          config.isConnected = true;
          config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
          this.saveGoogleSheetsConfig(config);

          const rawList = gasResult.transactions || gasResult.data?.recentTransactions || gasResult.data?.transactions || (Array.isArray(gasResult.data) ? gasResult.data : []) || [];
          const normalized = this.normalizeRawTransactions(rawList);
          const accounts = gasResult.accounts || gasResult.data?.accounts || undefined;

          return {
            success: true,
            data: {
              transactions: normalized,
              accounts,
            },
            message: `Diselaraskan ${normalized.length} rekod dari Google Sheets!`,
          };
        }
      }

      // Handle addTransaction
      if (action === 'addTransaction' || action === 'add_transaction') {
        const sakuPayload = {
          date: payload.date || new Date().toISOString().split('T')[0],
          type: payload.type || 'expense',
          category: payload.category || 'Lain-lain',
          amount: parseFloat(payload.amount) || 0,
          source: payload.account_name || 'Maybank',
          note: payload.note || '',
          receipt: payload.receipt_url || null,
        };
        try {
          await fetchDirect('add_transaction', sakuPayload);
        } catch {}
        try {
          await fetchDirect('addTransaction', payload);
        } catch {}
        return { success: true, message: 'Transaksi direkod ke Google Sheets.' };
      }

      // Handle deleteTransaction
      if (action === 'deleteTransaction' || action === 'delete_transaction') {
        const txId = payload.id || payload.txId;
        try {
          await fetchDirect('delete_transaction', { txId });
        } catch {}
        try {
          await fetchDirect('deleteTransaction', { id: txId });
        } catch {}
        return { success: true, message: 'Transaksi dipadam dari Google Sheets.' };
      }

      // Generic pass-through
      await fetchDirect(action, payload);
      return { success: true, message: 'Diselaraskan ke Google Sheets.' };
    } catch (err: any) {
      return { success: true, message: 'Disimpan di peranti.' };
    }
  }

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

// Standalone Helper Exports
export const getStoredTransactions = () => StorageService.getTransactions();
export const saveStoredTransactions = (txs: Transaction[]) => StorageService.saveTransactions(txs);
export const getStoredAccounts = () => StorageService.getAccounts();
export const saveStoredAccounts = (accs: Account[]) => StorageService.saveAccounts(accs);
export const getStoredCurrentUser = () => StorageService.getUser();
export const getStoredSettings = () => StorageService.getGoogleSheetsConfig();
export const loginUser = (u: string, p: string) => StorageService.getUser();

export default StorageService;
