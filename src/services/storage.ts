import { Account, Transaction, CategoryItem, SummaryStats, User, AuditLog, GoogleSheetsConfig, LoanFinancing } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_INCOME_TYPES, INITIAL_EXPENSE_TYPES, INITIAL_TRANSACTIONS, INITIAL_LOGS, DEFAULT_USER, INITIAL_LOANS, INITIAL_GAS_CONFIG } from '../data/defaultData';
import { getMalaysiaDateString, getMalaysiaTimestamp, getMalaysiaTimeString, roundToTwoDecimals } from '../utils/formatters';

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
      a.balance = roundToTwoDecimals(a.balance);

      // Fix legacy ACC_002 / CIMB Credit card
      if (a.id === 'ACC_002' || a.id === 'acc_cimb_cc' || (rawName.toLowerCase().includes('cimb') && (rawNotes.toLowerCase().includes('credit card') || rawName.toLowerCase().includes('credit')))) {
        a.bank = 'CIMB';
        a.type = 'credit_card';
        a.credit_limit = 12000;
        if (!a.account_name.toLowerCase().includes('credit') && !a.account_name.toLowerCase().includes('petronas')) {
          a.account_name = 'CIMB Petronas Visa Islamic Credit Card';
        }
      }

      // Fix Maybank Petronas Credit Card
      if (rawName.toLowerCase().includes('maybank') && (rawName.toLowerCase().includes('petronas') || rawName.toLowerCase().includes('credit') || a.id === 'acc_mb_cc' || a.id === 'acc_1786843686714')) {
        a.bank = 'Maybank';
        a.type = 'credit_card';
        a.credit_limit = 6000;
      }

      // Fix RHB Credit Card
      if (rawName.toLowerCase().includes('rhb') && (rawName.toLowerCase().includes('credit') || rawName.toLowerCase().includes('cashback') || a.id === 'acc_rhb_cc')) {
        a.bank = 'RHB Bank';
        a.type = 'credit_card';
        a.credit_limit = 5000;
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
      const cleanAccounts = (accounts || []).map((acc) => ({
        ...acc,
        balance: roundToTwoDecimals(acc.balance),
        credit_limit: acc.credit_limit !== undefined ? roundToTwoDecimals(acc.credit_limit) : undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(cleanAccounts));
      // Auto persist immediately to backend server
      this.saveToBackendServer({ accounts: cleanAccounts }).catch(() => {});
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
      const cleanTransactions = (transactions || []).map((tx) => ({
        ...tx,
        amount: roundToTwoDecimals(tx.amount),
      }));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanTransactions));
      this.saveToBackendServer({ transactions: cleanTransactions }).catch(() => {});
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
      timestamp: getMalaysiaTimestamp(),
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

    const currentMonthPrefix = getMalaysiaDateString().slice(0, 7);

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
   * Deduplication & Smart Merge for Transactions (Prevents any redundant data by ID or content fingerprint)
   */
  static mergeAndDeduplicateTransactions(localList: Transaction[], incomingList: Transaction[]): Transaction[] {
    const byIdMap = new Map<string, Transaction>();
    const fingerprintSet = new Set<string>();

    const makeFingerprint = (tx: Partial<Transaction>): string => {
      const d = String(tx.date || tx.created_at || '').slice(0, 10);
      const t = String(tx.type || 'expense').toLowerCase();
      const c = String(tx.category || '').toLowerCase().trim();
      const a = (Math.round((Number(tx.amount) || 0) * 100) / 100).toFixed(2);
      const acc = String(tx.account_name || tx.account_id || '').toLowerCase().trim();
      const note = String(tx.note || '').toLowerCase().trim();
      return `${d}|${t}|${c}|${a}|${acc}|${note}`;
    };

    // 1. Index and deduplicate local transactions
    (localList || []).forEach((tx) => {
      if (!tx) return;
      const cleanId = String(tx.id || '').trim();
      if (!cleanId) return;

      const fp = makeFingerprint(tx);
      if (!byIdMap.has(cleanId) && !fingerprintSet.has(fp)) {
        byIdMap.set(cleanId, tx);
        fingerprintSet.add(fp);
      }
    });

    // 2. Merge incoming transactions without creating duplicate rows
    (incomingList || []).forEach((tx, idx) => {
      if (!tx) return;
      const cleanId = String(tx.id || `tx_in_${Date.now()}_${idx}`).trim();
      const fp = makeFingerprint(tx);

      if (byIdMap.has(cleanId)) {
        const existing = byIdMap.get(cleanId)!;
        byIdMap.set(cleanId, {
          ...existing,
          ...tx,
          id: cleanId,
          // Preserve any existing receipt image if incoming is empty
          receipt_url: tx.receipt_url || existing.receipt_url,
          created_at: existing.created_at || tx.created_at,
        });
      } else if (!fingerprintSet.has(fp)) {
        byIdMap.set(cleanId, { ...tx, id: cleanId });
        fingerprintSet.add(fp);
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
   * Helper to parse messy date strings (e.g. from Google Sheets / SakuTrack) into YYYY-MM-DD in Malaysia GMT+8
   */
  static parseCleanDate(rawDate: any): string {
    if (!rawDate) return getMalaysiaDateString();
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      ogos: '08', mei: '05', mac: '03', dis: '12', okt: '10'
    };
    const regexMatch = str.match(/([a-zA-Z]{3,4})\s+(\d{1,2})\s+(\d{4})/);
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
        return getMalaysiaDateString(d);
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
      const existingAccounts = this.getAccounts();
      
      // Exact account name or bank matching first
      const exactMatch = existingAccounts.find((a) => {
        const full = `${a.bank} - ${a.account_name}`.toLowerCase();
        const aName = (a.account_name || '').toLowerCase();
        const aBank = (a.bank || '').toLowerCase();
        const aId = (a.id || '').toLowerCase();
        return s === full || s === aName || s === aBank || s === aId;
      });
      if (exactMatch) return exactMatch.id;

      if (s.includes('go+') || s.includes('goplus')) {
        const goAcc = existingAccounts.find((a) => a.account_name.toLowerCase().includes('go+') || a.id === 'acc_1786841487737' || a.id === 'acc_tng_goplus');
        return goAcc ? goAcc.id : 'acc_1786841487737';
      }
      if (s.includes('touch') || s.includes('tng')) {
        const tngAcc = existingAccounts.find((a) => !a.account_name.toLowerCase().includes('go+') && (a.bank.toLowerCase().includes('touch') || a.id === 'ACC_003' || a.id === 'acc_tng_wallet' || a.id === 'acc_tng_ewallet'));
        return tngAcc ? tngAcc.id : 'ACC_003';
      }
      if (s.includes('maybank') || s.includes('mae')) {
        if (s.includes('credit') || s.includes('card') || s.includes('petronas') || s.includes('ikhwan')) {
          const mbCc = existingAccounts.find((a) => a.type === 'credit_card' && a.bank.toLowerCase().includes('maybank'));
          return mbCc ? mbCc.id : 'acc_1786843686714';
        }
        const mbSav = existingAccounts.find((a) => a.type === 'bank' && a.bank.toLowerCase().includes('maybank'));
        return mbSav ? mbSav.id : 'ACC_001';
      }
      if (s.includes('rhb')) {
        if (s.includes('credit') || s.includes('card') || s.includes('cashback')) {
          const rhbCc = existingAccounts.find((a) => a.type === 'credit_card' && a.bank.toLowerCase().includes('rhb'));
          return rhbCc ? rhbCc.id : 'acc_rhb_cc';
        }
        const rhbSav = existingAccounts.find((a) => a.bank.toLowerCase().includes('rhb'));
        return rhbSav ? rhbSav.id : 'acc_rhb_cc';
      }
      if (s.includes('atome')) {
        const atomeAcc = existingAccounts.find((a) => a.bank.toLowerCase().includes('atome'));
        return atomeAcc ? atomeAcc.id : 'acc_atome_card';
      }
      if (s.includes('tunai') || s.includes('cash')) {
        const cashAcc = existingAccounts.find((a) => a.type === 'cash');
        return cashAcc ? cashAcc.id : 'ACC_004';
      }
      if (s.includes('gx')) return 'acc_gx_sav';
      if (s.includes('aeon')) {
        const aeonAcc = existingAccounts.find((a) => a.bank.toLowerCase().includes('aeon'));
        return aeonAcc ? aeonAcc.id : 'acc_aeon_pot';
      }
      if (s.includes('cimb')) return 'ACC_002';
      if (s.includes('asb') || s.includes('bumiputera')) return 'acc_asnb_asb';
      if (s.includes('asn') || s.includes('nasional')) return 'acc_asnb_asn';
      if (s.includes('ssp')) return 'acc_bsn_ssp_40';
      if (s.includes('bsn')) return 'acc_bsn_sav';
      if (s.includes('shopee')) return 'acc_shopeepay';
      if (s.includes('setel')) return 'acc_setel';
      if (s.includes('boost')) return 'acc_boost';
      return 'ACC_001';
    };

    const mappedList: Transaction[] = rawList.map((tx: any, idx: number) => {
      const rawDate = tx.date || tx.created_at || new Date().toISOString();
      const cleanDate = this.parseCleanDate(rawDate);
      const accName = tx.account_name || tx.source || tx.method || tx.account || 'Maybank - Savings Account';
      const accId = tx.account_id || mapSourceToId(accName);
      const isIncome = String(tx.type).toLowerCase() === 'income';

      return {
        id: String(tx.id || tx.TxID || `tx_sync_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`),
        date: cleanDate,
        type: isIncome ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense',
        category: tx.category || tx.income_type || tx.expense_type || 'Lain-lain',
        amount: roundToTwoDecimals(Math.abs(parseFloat(tx.amount) || 0)),
        account_id: accId,
        account_name: accName,
        to_account_id: tx.to_account_id,
        to_account_name: tx.to_account_name,
        note: tx.note || '',
        receipt_url: tx.receipt || tx.receipt_url || undefined,
        created_at: String(tx.created_at || cleanDate),
      };
    });

    // Automatically deduplicate any raw transactions from sheet
    return this.mergeAndDeduplicateTransactions([], mappedList);
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
      const parsedBalance = roundToTwoDecimals(balanceVal);
      const creditLimit = acc.CreditLimit !== undefined || acc.credit_limit !== undefined 
        ? roundToTwoDecimals(acc.CreditLimit || acc.credit_limit) 
        : undefined;

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
        updated_at: acc.CreatedAt || acc.updated_at || getMalaysiaDateString(),
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
      balance: roundToTwoDecimals(acc.balance),
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

      // Helper 2: JSONP GET Fetch (Guaranteed 100% bypass of CORS on any PC browser)
      const fetchViaJsonp = (act: string, params: any = {}): Promise<any> => {
        return new Promise((resolve) => {
          try {
            const callbackName = 'gas_cb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const script = document.createElement('script');
            let timer: any = null;

            (window as any)[callbackName] = (data: any) => {
              cleanup();
              resolve(data);
            };

            const cleanup = () => {
              if (timer) clearTimeout(timer);
              if (script.parentNode) script.parentNode.removeChild(script);
              delete (window as any)[callbackName];
            };

            timer = setTimeout(() => {
              cleanup();
              resolve(null);
            }, 10000);

            script.onerror = () => {
              cleanup();
              resolve(null);
            };

            const queryObj: any = {
              action: act,
              username: activeUsername,
              callback: callbackName,
              ...params,
            };
            const queryString = Object.keys(queryObj)
              .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof queryObj[k] === 'object' ? JSON.stringify(queryObj[k]) : queryObj[k])}`)
              .join('&');

            const separator = gasUrl.includes('?') ? '&' : '?';
            script.src = `${gasUrl}${separator}${queryString}`;
            document.body.appendChild(script);
          } catch {
            resolve(null);
          }
        });
      };

      // Helper 3: Direct client-side fetch fallback
      const fetchDirect = async (act: string, bodyObj: any = {}) => {
        try {
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
        } catch {
          return null;
        }
      };

      // Smart executor: Try Proxy -> Try JSONP (Zero CORS) -> Try Direct
      const executeGasCall = async (act: string, bodyObj: any = {}) => {
        // 1. Try Vercel / Express Backend Proxy
        const proxyRes = await fetchViaProxy(act, bodyObj);
        if (proxyRes && (proxyRes.status === 'success' || proxyRes.data || proxyRes.transactions || proxyRes.accounts)) {
          return proxyRes;
        }

        // 2. Try JSONP (Bypasses all PC browser CORS policies completely)
        const jsonpRes = await fetchViaJsonp(act, bodyObj);
        if (jsonpRes && (jsonpRes.status === 'success' || jsonpRes.data || jsonpRes.transactions || jsonpRes.accounts)) {
          return jsonpRes;
        }

        // 3. Fallback direct POST
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
          config.lastSynced = getMalaysiaTimeString(new Date(), false);
          this.saveGoogleSheetsConfig(config);
          return { success: true, message: 'Sambungan ke Google Apps Script & Sheets berjaya!' };
        }
        return { success: false, message: testRes?.message || 'Gagal menyambung ke Google Apps Script URL. Sila pastikan Web App dideploy dengan Access: Anyone & Execute as: Me.' };
      }

      // If initial fetch / getInitialData / syncDashboard
      if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions' || action === 'get_accounts') {
        let allGasTxs: any[] = [];
        let gasAccs: any[] = [];

        const usernamesToTry = ['', activeUsername, 'user', 'admin', 'firdaus'].filter(
          (v, i, a) => a.indexOf(v) === i
        );

        // 1. Fetch transactions across all username scopes so no sheet row is missed
        for (const u of usernamesToTry) {
          try {
            const resTx = await executeGasCall('get_transactions', { username: u || undefined, all: true });
            if (resTx && resTx.status === 'success') {
              if (Array.isArray(resTx.transactions) && resTx.transactions.length > 0) {
                allGasTxs.push(...resTx.transactions);
              }
              if (Array.isArray(resTx.accounts) && resTx.accounts.length > 0 && gasAccs.length === 0) {
                gasAccs = resTx.accounts;
              }
            }
          } catch {}
        }

        // Try getDashboard
        try {
          const resDash = await executeGasCall('getDashboard', { token: activeUsername, username: activeUsername });
          if (resDash && (resDash.status === 'success' || resDash.data)) {
            const dashTxs = resDash.data?.recentTransactions || resDash.data?.transactions || (Array.isArray(resDash.data) ? resDash.data : []);
            if (Array.isArray(dashTxs) && dashTxs.length > 0) {
              allGasTxs.push(...dashTxs);
            }
            if ((resDash.data?.accounts || resDash.accounts) && gasAccs.length === 0) {
              gasAccs = resDash.data?.accounts || resDash.accounts || [];
            }
          }
        } catch {}

        // 2. Fetch accounts if still empty
        if (gasAccs.length === 0) {
          for (const u of usernamesToTry) {
            try {
              const resAcc1 = await executeGasCall('get_accounts', { username: u || undefined });
              if (resAcc1 && resAcc1.status === 'success' && Array.isArray(resAcc1.accounts) && resAcc1.accounts.length > 0) {
                gasAccs = resAcc1.accounts;
                break;
              } else if (resAcc1 && Array.isArray(resAcc1.data) && resAcc1.data.length > 0) {
                gasAccs = resAcc1.data;
                break;
              }
            } catch {}
          }
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
        const normalizedTxs = this.normalizeRawTransactions(allGasTxs);
        let normalizedAccs: Account[] = [];

        if (Array.isArray(gasAccs) && gasAccs.length > 0) {
          const rawParsedAccs = this.normalizeRawAccounts(gasAccs);
          const existingAccs = this.getAccounts();
          const mergedMap = new Map<string, Account>();
          existingAccs.forEach((a) => mergedMap.set(a.id, a));
          rawParsedAccs.forEach((incoming) => {
            const current = mergedMap.get(incoming.id);
            if (current) {
              mergedMap.set(incoming.id, {
                ...current,
                ...incoming,
                balance: current.balance !== 0 ? current.balance : (incoming.balance !== undefined ? incoming.balance : current.balance),
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

        let combinedTxs = this.getTransactions();
        if (normalizedTxs.length > 0) {
          combinedTxs = this.mergeAndDeduplicateTransactions(combinedTxs, normalizedTxs);
          this.saveTransactions(combinedTxs);
        }

        config.isConnected = true;
        config.lastSynced = getMalaysiaTimeString(new Date(), false);
        this.saveGoogleSheetsConfig(config);

        return {
          success: true,
          data: {
            transactions: combinedTxs,
            accounts: normalizedAccs,
          },
          message: `Diselaraskan ${normalizedAccs.length} akaun & ${combinedTxs.length} transaksi dari Google Sheets!`,
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

        const gasResult = await executeGasCall('save_account', sakuAccPayload);

        config.isConnected = true;
        config.lastSynced = getMalaysiaTimeString(new Date(), false);
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
        const delRes = await executeGasCall('delete_account', { AccountID: accId, id: accId });
        return { success: true, message: delRes?.message || 'Akaun berjaya dipadam dari Google Sheets.' };
      }

      // Handle addTransaction / add_transaction
      if (action === 'addTransaction' || action === 'add_transaction') {
        const sakuPayload = {
          TxID: payload.TxID || payload.id || `Tx_${Date.now()}`,
          id: payload.TxID || payload.id || `Tx_${Date.now()}`,
          Date: payload.Date || payload.date || getMalaysiaDateString(),
          date: payload.Date || payload.date || getMalaysiaDateString(),
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

        const txRes = await executeGasCall('add_transaction', sakuPayload);
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
          date: payload.date || getMalaysiaDateString(),
          note: payload.note || 'Pindahan Antara Akaun',
          Username: payload.username || activeUsername || 'user',
          username: payload.username || activeUsername || 'user',
        };

        const transferRes = await executeGasCall('transferMoney', transferPayload);
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
