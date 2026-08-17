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
   * Normalize & Clean Accounts (No unwanted ghost injections)
   */
  static normalizeAccounts(accounts: Account[]): Account[] {
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return [...INITIAL_ACCOUNTS];
    }
    
    // 0. Clean & Merge duplicates
    let parsed: Account[] = [];
    const seenMap = new Map<string, Account>();

    accounts.forEach((acc) => {
      if (!acc || typeof acc !== 'object') return;
      let a = { ...acc };
      const rawBank = (a.bank || '').trim();
      const rawName = (a.account_name || '').trim();
      const rawNotes = (a.notes || '').trim();
      a.balance = Math.round((Number(a.balance) || 0) * 100) / 100;

      // Fix legacy ACC_002 / CIMB Credit card
      if (a.id === 'ACC_002' || (rawName.toLowerCase().includes('cimb') && rawNotes.toLowerCase().includes('credit card'))) {
        a.bank = 'CIMB';
        a.type = 'credit_card';
        a.credit_limit = a.credit_limit || 5000;
        if (!a.account_name.toLowerCase().includes('credit') && !a.account_name.toLowerCase().includes('petronas')) {
          a.account_name = 'CIMB Petronas Visa Islamic Credit Card';
        }
      }

      // Fix Maybank Petronas Credit Card
      if (rawName.toLowerCase().includes('maybank') && rawName.toLowerCase().includes('petronas')) {
        a.bank = 'Maybank';
        a.type = 'credit_card';
        a.credit_limit = a.credit_limit || 8000;
      }

      // Fix RHB Credit Card
      if (rawName.toLowerCase().includes('rhb') && (rawName.toLowerCase().includes('credit') || rawName.toLowerCase().includes('cashback'))) {
        a.bank = 'RHB Bank';
        a.type = 'credit_card';
        a.credit_limit = a.credit_limit || 6000;
      }

      // Deduplicate key
      let dedupeKey = a.id;
      if (a.id === 'ACC_001' && accounts.some((x) => x.id === 'acc_mb_sav')) {
        dedupeKey = 'acc_mb_sav';
      }
      if (a.id === 'ACC_002' && accounts.some((x) => x.id === 'acc_cimb_cc')) {
        dedupeKey = 'acc_cimb_cc';
      }
      if (a.id === 'acc_tng_ewallet' && accounts.some((x) => x.id === 'acc_tng_wallet')) {
        dedupeKey = 'acc_tng_wallet';
      }

      const existing = seenMap.get(dedupeKey);
      if (existing) {
        // Merge: keep non-zero balance and preserve user notes
        seenMap.set(dedupeKey, {
          ...existing,
          ...a,
          id: dedupeKey,
          balance: (a.balance !== 0 || existing.balance === 0) ? a.balance : existing.balance,
          credit_limit: a.credit_limit || existing.credit_limit,
          notes: a.notes || existing.notes,
        });
      } else {
        seenMap.set(dedupeKey, { ...a, id: dedupeKey });
      }
    });

    parsed = Array.from(seenMap.values());

    // 1. Remove phantom 0.00 duplicates created by preset injection if user has their real account
    // Example: User has "Maybank" (Akaun Gaji, 328.39) AND preset added "Savings Account" (0.00)
    const hasCustomMaybankSavings = parsed.some(
      (a) => a.bank.toLowerCase().includes('maybank') && a.type === 'bank' && a.id !== 'acc_mb_sav' && (a.balance !== 0 || a.account_name.toLowerCase().includes('gaji'))
    );
    if (hasCustomMaybankSavings) {
      parsed = parsed.filter((a) => !(a.id === 'acc_mb_sav' && a.balance === 0 && a.account_name === 'Savings Account'));
    }

    // Example: User has "Maybank Petronas Ikhwan Islamic..." (-563.73) AND preset added "Credit Card Ikhwan Islamic" (0.00)
    const hasCustomMaybankCC = parsed.some(
      (a) => a.bank.toLowerCase().includes('maybank') && a.type === 'credit_card' && a.id !== 'acc_mb_cc' && (a.balance !== 0 || a.account_name.toLowerCase().includes('petronas'))
    );
    if (hasCustomMaybankCC) {
      parsed = parsed.filter((a) => !(a.id === 'acc_mb_cc' && a.balance === 0 && a.account_name === 'Credit Card Ikhwan Islamic'));
    }

    // Example: User has TNG eWallet AND preset added unwanted 0.00 TNG GO+
    const tngAccounts = parsed.filter((a) => (a.bank || '').toLowerCase().includes('touch') || (a.bank || '').toLowerCase().includes('tng') || (a.id || '').includes('tng'));
    if (tngAccounts.length > 1) {
      const realTng = tngAccounts.find((a) => a.balance !== 0 || (a.notes && a.notes.includes('Tol')));
      const dummyGoPlus = tngAccounts.find((a) => a.id === 'acc_tng_goplus' && a.balance === 0);
      if (realTng && dummyGoPlus && realTng.id !== dummyGoPlus.id) {
        // If dummy GO+ was auto added with 0 balance, only keep if user actually has transactions for it
        const txs = this.getTransactions();
        const hasTx = txs.some((t) => t.account_id === dummyGoPlus.id);
        if (!hasTx) {
          parsed = parsed.filter((a) => a.id !== dummyGoPlus.id);
        }
      }
    }

    return parsed;
  }

  static getAccounts(): Account[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) {
      this.saveAccounts(INITIAL_ACCOUNTS);
      return INITIAL_ACCOUNTS;
    }
    try {
      const parsed: Account[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = this.normalizeAccounts(parsed);
        this.saveAccounts(normalized);
        return normalized;
      }
      return INITIAL_ACCOUNTS;
    } catch {
      return INITIAL_ACCOUNTS;
    }
  }

  static saveAccounts(accounts: Account[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      // Auto persist immediately to backend server
      this.saveToBackendServer({ accounts }).catch(() => {});
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
      this.saveToBackendServer({ loans }).catch(() => {});
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
      this.saveToBackendServer({ transactions }).catch(() => {});
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
      this.saveToBackendServer({ incomeTypes, expenseTypes }).catch(() => {});
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
      const isDebtType = acc.type === 'credit_card' || acc.type === 'paylater';

      if (isDebtType) {
        // For credit cards and paylaters, the balance (whether stored positive or negative) is credit/debt used
        const debtAmt = Math.abs(bal);
        creditUsed += debtAmt;
        netWorth -= debtAmt;
      } else {
        // Standard asset accounts (bank, ewallet, cash, investment, gold)
        if (bal >= 0) {
          totalMoney += bal;
          if (acc.type === 'bank' || acc.type === 'ewallet' || acc.type === 'cash') {
            cashAvailable += bal;
          }
          netWorth += bal;
        } else {
          // Negative balance in a normal bank account is an overdraft / liability
          const overdraftDebt = Math.abs(bal);
          creditUsed += overdraftDebt;
          netWorth -= overdraftDebt;
        }
      }
    });

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    transactions.forEach((tx) => {
      const cleanDate = this.parseCleanDate(tx.date || tx.created_at);
      if (cleanDate && cleanDate.startsWith(currentMonthPrefix)) {
        if (tx.type === 'income') incomeThisMonth += Number(tx.amount) || 0;
        else if (tx.type === 'expense') expenseThisMonth += Number(tx.amount) || 0;
      }
    });

    return {
      totalMoney: Math.round(totalMoney * 100) / 100,
      cashAvailable: Math.round(cashAvailable * 100) / 100,
      creditUsed: Math.round(creditUsed * 100) / 100,
      incomeThisMonth: Math.round(incomeThisMonth * 100) / 100,
      expenseThisMonth: Math.round(expenseThisMonth * 100) / 100,
      netWorth: Math.round(netWorth * 100) / 100,
    };
  }

  /**
   * Deduplication & Smart Merge for Transactions
   */
  static mergeAndDeduplicateTransactions(localList: Transaction[], incomingList: Transaction[]): Transaction[] {
    const byIdMap = new Map<string, Transaction>();

    // 1. Index local transactions
    localList.forEach((tx) => {
      if (tx && tx.id) {
        byIdMap.set(tx.id, tx);
      }
    });

    // 2. Merge incoming transactions
    incomingList.forEach((tx, idx) => {
      if (!tx) return;
      const targetId = tx.id || `tx_in_${Date.now()}_${idx}`;
      if (byIdMap.has(targetId)) {
        const existing = byIdMap.get(targetId)!;
        byIdMap.set(targetId, { ...existing, ...tx, id: targetId });
      } else {
        byIdMap.set(targetId, { ...tx, id: targetId });
      }
    });

    return Array.from(byIdMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
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
          data.accounts = this.normalizeAccounts(data.accounts);
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
      if (s.includes('go+') || s.includes('goplus')) return 'acc_tng_goplus';
      if (s.includes('touch') || s.includes('tng')) return 'acc_tng_wallet';
      if (s.includes('maybank') || s.includes('mae')) return 'acc_mb_sav';
      if (s.includes('rhb')) return 'acc_rhb_sav';
      if (s.includes('atome')) return 'acc_atome_pl';
      if (s.includes('tunai') || s.includes('cash')) return 'acc_cash_fizikal';
      if (s.includes('gx')) return 'acc_gx_sav';
      if (s.includes('aeon')) return 'acc_aeon_sav';
      if (s.includes('cimb')) return 'acc_cimb_cc';
      if (s.includes('asb') || s.includes('bumiputera')) return 'acc_asnb_asb';
      if (s.includes('asn') || s.includes('nasional')) return 'acc_asnb_asn';
      if (s.includes('ssp')) return 'acc_bsn_ssp_40';
      if (s.includes('bsn')) return 'acc_bsn_sav';
      if (s.includes('shopee')) return 'acc_shopeepay';
      if (s.includes('setel')) return 'acc_setel';
      if (s.includes('boost')) return 'acc_boost';
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
   * Normalize raw accounts from SakuTrack or MyWang AppsScript
   */
  static normalizeRawAccounts(rawList: any[]): Account[] {
    if (!Array.isArray(rawList) || rawList.length === 0) return [];

    const getMeta = (bank: string, name: string, typeStr: string) => {
      const combined = `${bank} ${name} ${typeStr}`.toLowerCase();
      if (combined.includes('maybank') || combined.includes('mae') || combined.includes('ikhwan')) {
        return { bank: 'Maybank', color: 'from-amber-500 to-yellow-600', icon: combined.includes('wallet') || combined.includes('mae') ? 'Smartphone' : combined.includes('credit') || combined.includes('card') ? 'CreditCard' : 'Landmark' };
      }
      if (combined.includes('cimb')) {
        return { bank: 'CIMB', color: 'from-red-600 to-rose-800', icon: combined.includes('credit') || combined.includes('petronas') ? 'CreditCard' : 'Landmark' };
      }
      if (combined.includes('rhb')) {
        return { bank: 'RHB Bank', color: 'from-blue-600 to-cyan-700', icon: combined.includes('credit') ? 'CreditCard' : 'Landmark' };
      }
      if (combined.includes('touch') || combined.includes('tng')) {
        return { bank: "Touch 'n Go eWallet", color: 'from-blue-500 to-sky-600', icon: 'Smartphone' };
      }
      if (combined.includes('boost')) {
        return { bank: 'Boost', color: 'from-red-500 to-orange-600', icon: 'Smartphone' };
      }
      if (combined.includes('setel') || combined.includes('petronas')) {
        return { bank: 'Setel by Petronas', color: 'from-emerald-500 to-teal-700', icon: 'Fuel' };
      }
      if (combined.includes('shopee') || combined.includes('spaylater')) {
        return { bank: 'Shopee', color: 'from-orange-500 to-amber-600', icon: 'ShoppingBag' };
      }
      if (combined.includes('atome')) {
        return { bank: 'Atome', color: 'from-lime-500 to-yellow-600', icon: 'Clock' };
      }
      if (combined.includes('aeon') || combined.includes('savings pot') || combined.includes('tabung keluarga') || combined.includes('savings account-i')) {
        return { bank: 'AEON BANK', color: 'from-fuchsia-600 to-pink-700', icon: combined.includes('pot') ? 'PiggyBank' : 'Landmark' };
      }
      if (combined.includes('gx') || combined.includes('gxbank')) {
        return { bank: 'GXBANK', color: 'from-violet-600 to-purple-800', icon: 'Landmark' };
      }
      if (combined.includes('tunai') || combined.includes('cash') || combined.includes('dompet')) {
        return { bank: 'Tunai (Cash)', color: 'from-emerald-500 to-teal-700', icon: 'Coins' };
      }
      if (combined.includes('public')) {
        return { bank: 'Public Bank', color: 'from-red-700 to-amber-700', icon: 'Landmark' };
      }
      if (combined.includes('hong leong') || combined.includes('hlb')) {
        return { bank: 'Hong Leong Bank', color: 'from-red-600 to-rose-700', icon: 'Landmark' };
      }
      if (combined.includes('bank islam')) {
        return { bank: 'Bank Islam', color: 'from-red-700 to-rose-950', icon: 'Landmark' };
      }
      if (combined.includes('bsn') || combined.includes('ssp')) {
        return { bank: 'BSN', color: 'from-teal-600 to-cyan-800', icon: 'PiggyBank' };
      }
      if (combined.includes('asnb') || combined.includes('asb')) {
        return { bank: 'ASNB', color: 'from-blue-700 to-indigo-900', icon: 'TrendingUp' };
      }
      if (combined.includes('miga') || combined.includes('emas') || combined.includes('gold')) {
        return { bank: 'Maybank Islamic (MIGA)', color: 'from-amber-600 to-yellow-700', icon: 'Coins' };
      }
      return { bank: bank || 'Akaun Simpanan', color: 'from-slate-600 to-gray-800', icon: 'Wallet' };
    };

    const normalizeType = (rawType: string, name: string, bank: string): Account['type'] => {
      const combined = `${rawType} ${name} ${bank}`.toLowerCase();
      if (combined.includes('credit') || combined.includes('kad kredit') || combined.includes('visa') || combined.includes('mastercard') || combined.includes('ikhwan') || combined.includes('card')) return 'credit_card';
      if (combined.includes('paylater') || combined.includes('bnpl') || combined.includes('atome') || combined.includes('spaylater')) return 'paylater';
      if (combined.includes('ewallet') || combined.includes('wallet') || combined.includes('tng') || combined.includes('mae') || combined.includes('boost') || combined.includes('setel') || combined.includes('shopeepay')) return 'ewallet';
      if (combined.includes('cash') || combined.includes('tunai') || combined.includes('dompet')) return 'cash';
      if (combined.includes('investment') || combined.includes('pelaburan') || combined.includes('asnb') || combined.includes('ssp') || combined.includes('emas') || combined.includes('miga')) return 'investment';
      return 'bank';
    };

    return rawList.map((acc: any, idx: number) => {
      const id = String(acc.AccountID || acc.id || acc.account_id || `acc_${idx + 1}`);
      const rawName = String(acc.AccountName || acc.account_name || acc.name || acc.Bank || acc.bank || `Akaun ${idx + 1}`).trim();
      const rawType = String(acc.AccountType || acc.type || 'Bank');
      const rawBank = String(acc.Bank || acc.bank || '').trim();
      const accType = normalizeType(rawType, rawName, rawBank);
      const meta = getMeta(rawBank, rawName, rawType);
      
      let finalBank = rawBank;
      if (!finalBank || finalBank === rawName || finalBank.toLowerCase().includes('akaun') || finalBank.toLowerCase().includes('simpanan') || finalBank.toLowerCase().includes('savings pot') || finalBank.toLowerCase().includes('tabung keluarga')) {
        finalBank = meta.bank;
      }
      if (rawName.toLowerCase().includes('savings pot') || rawName.toLowerCase().includes('tabung keluarga') || rawName.toLowerCase().includes('savings account-i')) {
        finalBank = 'AEON BANK';
      }

      const balanceVal = acc.InitialBalance !== undefined ? acc.InitialBalance : acc.balance !== undefined ? acc.balance : acc.Balance;
      const parsedBalance = parseFloat(balanceVal) || 0;
      const creditLimit = parseFloat(acc.CreditLimit || acc.credit_limit) || undefined;

      return {
        id,
        bank: finalBank,
        account_name: rawName,
        type: accType,
        balance: parsedBalance,
        credit_limit: creditLimit,
        color: acc.color || meta.color,
        icon: acc.icon || meta.icon,
        notes: acc.Notes || acc.notes || '',
        updated_at: acc.CreatedAt || acc.updated_at || new Date().toISOString().split('T')[0],
      };
    });
  }

  /**
   * Recalculates live balances for all accounts.
   * If accounts come with their live updated balance directly from user edits or sheet,
   * we ensure we do not double-apply transaction histories onto already-reconciled balances.
   */
  static computeLiveAccountBalances(accountsList: Account[], transactionsList: Transaction[]): Account[] {
    if (!Array.isArray(accountsList) || accountsList.length === 0) return [];
    
    // If accounts already contain current balances saved explicitly, keep them intact
    return accountsList.map((acc) => ({
      ...acc,
      balance: Math.round((Number(acc.balance) || 0) * 100) / 100,
    }));
  }

  /**
   * Universal Sync with Google Apps Script Web App
   * Menyokong kedua-dua format: SakuTrack backend & MyWang AppsScript backend
   */
  static async syncWithGAS(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; message?: string }> {
    const config: any = this.getGoogleSheetsConfig();
    const user = this.getUser();
    const activeUsername = user?.username || 'user';
    const gasUrl = config.webAppUrl || config.gas_web_app_url || config.google_sheets_url || '';

    if (!gasUrl) {
      return { success: true, message: 'Data disimpan di peranti (Mod Tempatan).' };
    }

    try {
      // Helper 1: Serverless Proxy Fetch (Bypasses all CORS on Vercel & Node.js backend)
      const fetchViaProxy = async (act: string, bodyObj: any = {}) => {
        try {
          const res = await fetch('/api/gas-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webAppUrl: gasUrl,
              action: act,
              username: activeUsername,
              data: bodyObj,
            }),
          });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return await res.json();
            }
          }
        } catch {}
        return null;
      };

      // Helper 2: Direct client-side fetch fallback
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

      // Smart executor: Try proxy first (no CORS issues), fallback to direct
      const executeGasCall = async (act: string, bodyObj: any = {}) => {
        const proxyRes = await fetchViaProxy(act, bodyObj);
        if (proxyRes && (proxyRes.status === 'success' || proxyRes.data || proxyRes.transactions || proxyRes.accounts)) {
          return proxyRes;
        }
        return await fetchDirect(act, bodyObj);
      };

      // If testConnection or ping
      if (action === 'testConnection' || action === 'ping') {
        let testRes: any = null;
        try {
          testRes = await executeGasCall('ping', {});
        } catch {}
        if (!testRes || testRes.status === 'error') {
          try {
            testRes = await executeGasCall('get_transactions', { username: activeUsername });
          } catch {}
        }
        if (!testRes || testRes.status === 'error') {
          try {
            testRes = await executeGasCall('getDashboard', { token: activeUsername });
          } catch {}
        }
        if (testRes && (testRes.status === 'success' || testRes.transactions || testRes.data)) {
          config.isConnected = true;
          config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
          this.saveGoogleSheetsConfig(config);
          return { success: true, message: 'Sambungan ke Google Apps Script & Sheets berjaya!' };
        }
        return { success: false, message: testRes?.message || 'Gagal menyambung ke Google Apps Script URL. Sila pastikan Web App dideploy dengan Access: Anyone & Execute as: Me.' };
      }

      // If initial fetch / getInitialData / syncDashboard
      if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions' || action === 'get_accounts') {
        let gasTxs: any[] = [];
        let gasAccs: any[] = [];

        // 1. Fetch transactions (support SakuTrack and MyWang endpoints)
        try {
          const resTx = await executeGasCall('get_transactions', { username: activeUsername });
          if (resTx && resTx.status === 'success' && Array.isArray(resTx.transactions)) {
            gasTxs = resTx.transactions;
          }
          if (resTx && Array.isArray(resTx.accounts) && resTx.accounts.length > 0) {
            gasAccs = resTx.accounts;
          }
        } catch {}

        if (gasTxs.length === 0) {
          try {
            const resDash = await executeGasCall('getDashboard', { token: activeUsername });
            if (resDash && (resDash.status === 'success' || resDash.data)) {
              gasTxs = resDash.data?.recentTransactions || resDash.data?.transactions || (Array.isArray(resDash.data) ? resDash.data : []) || [];
              if (resDash.data?.accounts || resDash.accounts) {
                gasAccs = resDash.data?.accounts || resDash.accounts || [];
              }
            }
          } catch {}
        }

        // 2. Fetch accounts (support SakuTrack 'get_accounts' and MyWang 'getAccounts')
        if (gasAccs.length === 0) {
          try {
            const resAcc1 = await executeGasCall('get_accounts', { username: activeUsername });
            if (resAcc1 && resAcc1.status === 'success' && Array.isArray(resAcc1.accounts)) {
              gasAccs = resAcc1.accounts;
            } else if (resAcc1 && Array.isArray(resAcc1.data)) {
              gasAccs = resAcc1.data;
            }
          } catch {}
        }

        if (gasAccs.length === 0) {
          try {
            const resAcc2 = await executeGasCall('getAccounts', {});
            if (resAcc2 && (resAcc2.status === 'success' || Array.isArray(resAcc2.data))) {
              gasAccs = resAcc2.data || resAcc2.accounts || [];
            }
          } catch {}
        }

        // Normalize transactions and accounts
        const normalizedTxs = this.normalizeRawTransactions(gasTxs);
        let normalizedAccs: Account[] = [];

        if (Array.isArray(gasAccs) && gasAccs.length > 0) {
          const rawParsedAccs = this.normalizeRawAccounts(gasAccs);
          // Merge with current local accounts so user's existing balances (e.g. MIGA, ASNB, etc.) are never wiped
          const existingAccs = this.getAccounts();
          const mergedMap = new Map<string, Account>();
          existingAccs.forEach((a) => mergedMap.set(a.id, a));
          rawParsedAccs.forEach((incoming) => {
            const current = mergedMap.get(incoming.id);
            if (current) {
              mergedMap.set(incoming.id, {
                ...current,
                ...incoming,
                // If incoming from GAS has 0 balance but current has real non-zero balance, preserve current
                balance: (incoming.balance !== 0 || current.balance === 0) ? incoming.balance : current.balance,
                weight_grams: incoming.weight_grams || current.weight_grams,
                avg_price_per_gram: incoming.avg_price_per_gram || current.avg_price_per_gram,
                total_invested: incoming.total_invested || current.total_invested,
              });
            } else {
              mergedMap.set(incoming.id, incoming);
            }
          });
          normalizedAccs = this.normalizeAccounts(Array.from(mergedMap.values()));
          this.saveAccounts(normalizedAccs);
        } else {
          normalizedAccs = this.getAccounts();
        }

        if (normalizedTxs.length > 0) {
          this.saveTransactions(normalizedTxs);
        }

        config.isConnected = true;
        config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
        this.saveGoogleSheetsConfig(config);

        return {
          success: true,
          data: {
            transactions: normalizedTxs,
            accounts: normalizedAccs,
          },
          message: `Diselaraskan ${normalizedAccs.length} akaun & ${normalizedTxs.length} transaksi dari Google Sheets!`,
        };
      }

      // Handle updateAccount / saveAccount / edit_account / addAccount
      if (action === 'updateAccount' || action === 'saveAccount' || action === 'edit_account' || action === 'addAccount' || action === 'add_account') {
        const sakuAccPayload = {
          AccountID: payload.AccountID || payload.id || payload.account_id || `ACC_${Date.now()}`,
          id: payload.AccountID || payload.id || payload.account_id || `ACC_${Date.now()}`,
          account_id: payload.AccountID || payload.id || payload.account_id || `ACC_${Date.now()}`,
          AccountName: payload.AccountName || payload.account_name || payload.bank || 'Akaun',
          account_name: payload.AccountName || payload.account_name || payload.bank || 'Akaun',
          bank: payload.bank || payload.Bank || payload.account_name || 'Akaun',
          AccountType: payload.AccountType || payload.type || 'Bank',
          type: payload.AccountType || payload.type || 'Bank',
          InitialBalance: payload.InitialBalance !== undefined ? payload.InitialBalance : (payload.balance !== undefined ? payload.balance : 0),
          balance: payload.InitialBalance !== undefined ? payload.InitialBalance : (payload.balance !== undefined ? payload.balance : 0),
          AccountNumber: payload.AccountNumber || payload.account_number || '',
          account_number: payload.AccountNumber || payload.account_number || '',
          Notes: payload.Notes || payload.notes || '',
          notes: payload.Notes || payload.notes || '',
          Username: payload.Username || payload.username || activeUsername || 'user',
          username: payload.Username || payload.username || activeUsername || 'user',
        };

        let gasResult: any = null;
        try {
          gasResult = await executeGasCall('save_account', sakuAccPayload);
        } catch {}

        if (!gasResult || gasResult.status !== 'success') {
          try {
            gasResult = await executeGasCall('saveAccount', sakuAccPayload);
          } catch {}
        }

        if (!gasResult || gasResult.status !== 'success') {
          try {
            gasResult = await executeGasCall('edit_account', sakuAccPayload);
          } catch {}
        }

        if (!gasResult || gasResult.status !== 'success') {
          try {
            gasResult = await executeGasCall('add_account', sakuAccPayload);
          } catch {}
        }

        config.isConnected = true;
        config.lastSynced = new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
        this.saveGoogleSheetsConfig(config);

        return { 
          success: true, 
          data: gasResult?.data || sakuAccPayload, 
          message: gasResult?.message || `Akaun ${sakuAccPayload.AccountName} berjaya disimpan ke Google Sheets!` 
        };
      }

      // Handle deleteAccount / delete_account
      if (action === 'deleteAccount' || action === 'delete_account') {
        const accId = payload.AccountID || payload.id || payload.account_id;
        let delRes: any = null;
        try {
          delRes = await executeGasCall('delete_account', { AccountID: accId, id: accId });
        } catch {}
        if (!delRes || delRes.status !== 'success') {
          try {
            delRes = await executeGasCall('deleteAccount', { AccountID: accId, id: accId });
          } catch {}
        }
        return { success: true, message: delRes?.message || 'Akaun berjaya dipadam dari Google Sheets.' };
      }

      // Handle addTransaction / add_transaction
      if (action === 'addTransaction' || action === 'add_transaction') {
        const sakuPayload = {
          TxID: payload.TxID || payload.id || `Tx_${Date.now()}`,
          id: payload.TxID || payload.id || `Tx_${Date.now()}`,
          Date: payload.Date || payload.date || new Date().toISOString().split('T')[0],
          date: payload.Date || payload.date || new Date().toISOString().split('T')[0],
          Type: payload.Type || payload.type || 'expense',
          type: payload.Type || payload.type || 'expense',
          Category: payload.Category || payload.category || 'Lain-lain',
          category: payload.Category || payload.category || 'Lain-lain',
          Amount: parseFloat(payload.Amount !== undefined ? payload.Amount : payload.amount) || 0,
          amount: parseFloat(payload.Amount !== undefined ? payload.Amount : payload.amount) || 0,
          Discount: parseFloat(payload.Discount !== undefined ? payload.Discount : payload.discount) || 0,
          discount: parseFloat(payload.Discount !== undefined ? payload.Discount : payload.discount) || 0,
          Method: payload.Method || payload.payment_method || payload.method || 'Online Transfer',
          payment_method: payload.Method || payload.payment_method || payload.method || 'Online Transfer',
          Source: payload.Source || payload.source || payload.account_name || payload.bank || 'Maybank',
          source: payload.Source || payload.source || payload.account_name || payload.bank || 'Maybank',
          Note: payload.Note || payload.note || '',
          note: payload.Note || payload.note || '',
          ReceiptURL: payload.ReceiptURL || payload.receipt_url || payload.receipt || '',
          receipt_url: payload.ReceiptURL || payload.receipt_url || payload.receipt || '',
          Username: payload.Username || payload.username || activeUsername || 'user',
          username: payload.Username || payload.username || activeUsername || 'user',
        };

        let txRes: any = null;
        try {
          txRes = await executeGasCall('add_transaction', sakuPayload);
        } catch {}
        if (!txRes || txRes.status !== 'success') {
          try {
            txRes = await executeGasCall('addTransaction', sakuPayload);
          } catch {}
        }
        return { success: true, message: txRes?.message || 'Transaksi direkod ke Google Sheets.' };
      }

      // Handle recordTransfer / transferMoney / transfer
      if (action === 'recordTransfer' || action === 'transferMoney' || action === 'transfer' || action === 'transfer_money') {
        const transferPayload = {
          from_account_id: payload.from_account_id || payload.from_account || payload.from,
          to_account_id: payload.to_account_id || payload.to_account || payload.to,
          from_account_name: payload.from_account_name || payload.from_bank,
          to_account_name: payload.to_account_name || payload.to_bank,
          from: payload.from_account_id || payload.from_account || payload.from,
          to: payload.to_account_id || payload.to_account || payload.to,
          amount: parseFloat(payload.amount) || 0,
          date: payload.date || new Date().toISOString().split('T')[0],
          note: payload.note || 'Pindahan Antara Akaun',
          Username: payload.username || activeUsername || 'user',
          username: payload.username || activeUsername || 'user',
        };

        let transferRes: any = null;
        try {
          transferRes = await executeGasCall('transferMoney', transferPayload);
        } catch {}
        if (!transferRes || transferRes.status !== 'success') {
          try {
            transferRes = await executeGasCall('transfer_money', transferPayload);
          } catch {}
        }
        if (!transferRes || transferRes.status !== 'success') {
          try {
            transferRes = await executeGasCall('recordTransfer', transferPayload);
          } catch {}
        }
        return { success: true, data: transferRes?.data, message: transferRes?.message || 'Pindahan berjaya diselaraskan ke Google Sheets!' };
      }

      // Generic pass-through
      await executeGasCall(action, payload);
      return { success: true, message: 'Diselaraskan ke Google Sheets.' };
    } catch (err: any) {
      console.warn('Sync with Google Sheets failed, saved locally:', err);
      return { success: true, message: 'Disimpan di peranti (Mod Tempatan).' };
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
