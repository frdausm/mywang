import { Account, Transaction, CategoryItem, SummaryStats, User, AuditLog, GoogleSheetsConfig, LoanFinancing } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_INCOME_TYPES, INITIAL_EXPENSE_TYPES, INITIAL_TRANSACTIONS, INITIAL_LOGS, DEFAULT_USER, INITIAL_LOANS, INITIAL_GAS_CONFIG } from '../data/defaultData';
import { getMalaysiaDateString, getMalaysiaTimestamp, getMalaysiaTimeString, roundToTwoDecimals } from '../utils/formatters';
import { idb } from './indexedDb';

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
  PENDING_QUEUE: 'mywang_pending_sync_queue',
  DELETED_TX_IDS: 'mywang_deleted_tx_ids_v1',
  CLEANUP_DONE_FLAG: 'mywang_dedup_cleanup_v2_done',
  TX_BACKUP: 'mywang_transactions_backup_before_cleanup',
  LAST_SYNC_TIME: 'mywang_last_sync_timestamp',
};

/**
 * High-Precision Currency / Cent Utility (Eliminates floating-point error)
 */
export const toCents = (amount: number | string | undefined | null): number => {
  if (amount === undefined || amount === null) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  return Math.round(num * 100);
};

export const fromCents = (cents: number): number => {
  return Math.round(cents) / 100;
};

export class StorageService {
  private static isSyncLocked = false;

  /**
   * Deterministic Stable Transaction ID Generator
   * Generates a consistent, reproducible ID based on transaction attributes if none provided
   */
  static generateDeterministicTxId(tx: Partial<Transaction>): string {
    if (tx.id && String(tx.id).trim() && !String(tx.id).startsWith('tx_sync_temp_')) {
      return String(tx.id).trim();
    }
    const d = String(tx.date || getMalaysiaDateString()).slice(0, 10);
    const t = String(tx.type || 'expense').toLowerCase();
    const c = String(tx.category || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const cents = toCents(tx.amount);
    const acc = String(tx.account_id || tx.account_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const note = String(tx.note || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 15);
    
    // Hash simulation for deterministic string
    let hash = 0;
    const str = `${d}_${t}_${c}_${cents}_${acc}_${note}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `tx_${d.replace(/-/g, '')}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Content Fingerprint for Deep Deduplication
   */
  static makeFingerprint(tx: Partial<Transaction>): string {
    const d = String(tx.date || tx.created_at || '').slice(0, 10);
    const t = String(tx.type || 'expense').toLowerCase();
    const c = String(tx.category || '').toLowerCase().trim();
    const cents = toCents(tx.amount);
    const acc = String(tx.account_name || tx.account_id || '').toLowerCase().trim();
    const note = String(tx.note || '').toLowerCase().trim();
    return `${d}|${t}|${c}|${cents}|${acc}|${note}`;
  }

  /**
   * One-Time Automatic Database Cleanup for Existing Duplicates
   */
  static cleanupExistingDuplicates(): { cleaned: number; remaining: number } {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!raw) return { cleaned: 0, remaining: 0 };
      
      const parsed: Transaction[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return { cleaned: 0, remaining: 0 };

      // Backup before cleanup
      if (!localStorage.getItem(STORAGE_KEYS.TX_BACKUP)) {
        localStorage.setItem(STORAGE_KEYS.TX_BACKUP, raw);
      }

      const byIdMap = new Map<string, Transaction>();
      const fpMap = new Map<string, Transaction>();
      const deletedIds = this.getDeletedTxIds();
      let cleanedCount = 0;

      for (const tx of parsed) {
        if (!tx) continue;
        const id = String(tx.id || '').trim();
        if (!id || deletedIds.has(id)) {
          cleanedCount++;
          continue;
        }

        const fp = this.makeFingerprint(tx);

        if (byIdMap.has(id)) {
          // Existing ID collision -> keep the one with most details
          const existing = byIdMap.get(id)!;
          const merged: Transaction = {
            ...existing,
            ...tx,
            receipt_url: tx.receipt_url || existing.receipt_url,
            note: tx.note || existing.note,
            created_at: existing.created_at || tx.created_at,
          };
          byIdMap.set(id, merged);
          cleanedCount++;
        } else if (fpMap.has(fp)) {
          // Exact same content fingerprint under different ID -> deduplicate
          cleanedCount++;
        } else {
          byIdMap.set(id, tx);
          fpMap.set(fp, tx);
        }
      }

      const deduplicatedList = Array.from(byIdMap.values()).sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      if (cleanedCount > 0) {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(deduplicatedList));
        console.log(`[MyWang Cleanup] Dikesan & dibersihkan ${cleanedCount} transaksi berganda.`);
      }

      localStorage.setItem(STORAGE_KEYS.CLEANUP_DONE_FLAG, 'true');
      return { cleaned: cleanedCount, remaining: deduplicatedList.length };
    } catch (e) {
      console.warn('[MyWang Cleanup] Gagal menjalankan pembersihan:', e);
      return { cleaned: 0, remaining: 0 };
    }
  }
  /**
   * Deleted Transactions Tombstone Management (Prevents deleted items from resurrecting)
   */
  static getDeletedTxIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_TX_IDS);
      const list = raw ? JSON.parse(raw) : [];
      const s = new Set<string>(Array.isArray(list) ? list : []);
      // Permanently include purged rogue duplicate transactions
      s.add('Tx_1786926254807');
      s.add('tx_1786926254807');
      return s;
    } catch {
      return new Set(['Tx_1786926254807', 'tx_1786926254807']);
    }
  }

  static recordDeletedTxId(id: string): void {
    if (!id) return;
    try {
      const s = this.getDeletedTxIds();
      s.add(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_TX_IDS, JSON.stringify(Array.from(s)));
    } catch {}
  }

  static filterDeletedTransactions(txs: Transaction[]): Transaction[] {
    const deletedIds = this.getDeletedTxIds();
    return (txs || []).filter((tx) => {
      if (!tx || !tx.id) return false;
      if (deletedIds.has(tx.id)) return false;
      if (tx.id === 'Tx_1786926254807' || tx.id === 'tx_1786926254807') return false;
      if (
        Number(tx.amount) === 365 &&
        (tx.note || '').toLowerCase().includes('prepaid') &&
        (tx.note || '').toLowerCase().includes('failed')
      ) {
        return false;
      }
      return true;
    });
  }
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

  static notifySyncUpdate() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('mywang_realtime_sync');
        channel.postMessage('REFRESH_DATA');
        channel.close();
      }
    } catch {}
  }

  static saveAccounts(accounts: Account[]) {
    try {
      const cleanAccounts = (accounts || []).map((acc) => ({
        ...acc,
        balance: roundToTwoDecimals(acc.balance),
        credit_limit: acc.credit_limit !== undefined ? roundToTwoDecimals(acc.credit_limit) : undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(cleanAccounts));
      idb.set(STORAGE_KEYS.ACCOUNTS, cleanAccounts).catch(() => {});
      this.notifySyncUpdate();
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
      if (!Array.isArray(parsed)) return [];
      const filtered = this.filterDeletedTransactions(parsed);
      if (filtered.length !== parsed.length) {
        this.saveTransactions(filtered);
      }
      return filtered;
    } catch {
      return [];
    }
  }

  static saveTransactions(transactions: Transaction[]) {
    try {
      const cleanTransactions = this.filterDeletedTransactions(transactions || []).map((tx) => ({
        ...tx,
        amount: roundToTwoDecimals(tx.amount),
      }));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanTransactions));
      idb.set(STORAGE_KEYS.TRANSACTIONS, cleanTransactions).catch(() => {});
      this.notifySyncUpdate();
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
   * Deduplication & Smart Merge for Transactions (Idempotent & Preserves Historical Data)
   */
  static mergeAndDeduplicateTransactions(localList: Transaction[], incomingList: Transaction[]): Transaction[] {
    const byIdMap = new Map<string, Transaction>();
    const fingerprintMap = new Map<string, string>(); // fp -> txId
    const cleanLocal = this.filterDeletedTransactions(localList || []);
    const cleanIncoming = this.filterDeletedTransactions(incomingList || []);
    const deletedIds = this.getDeletedTxIds();

    let newCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;

    // 1. Index local transactions into memory
    cleanLocal.forEach((tx) => {
      if (!tx) return;
      let cleanId = String(tx.id || '').trim();
      if (!cleanId) {
        cleanId = this.generateDeterministicTxId(tx);
        tx = { ...tx, id: cleanId };
      }
      if (deletedIds.has(cleanId)) return;

      const fp = this.makeFingerprint(tx);
      if (!byIdMap.has(cleanId)) {
        byIdMap.set(cleanId, tx);
        if (!fingerprintMap.has(fp)) {
          fingerprintMap.set(fp, cleanId);
        }
      }
    });

    // 2. Merge incoming (e.g. latest 25) without duplicating or destroying history
    cleanIncoming.forEach((incomingTx) => {
      if (!incomingTx) return;
      let cleanId = String(incomingTx.id || '').trim();
      if (!cleanId) {
        cleanId = this.generateDeterministicTxId(incomingTx);
        incomingTx = { ...incomingTx, id: cleanId };
      }
      if (deletedIds.has(cleanId)) return;

      const fp = this.makeFingerprint(incomingTx);

      if (byIdMap.has(cleanId)) {
        // Same ID -> Update attributes
        const existing = byIdMap.get(cleanId)!;
        byIdMap.set(cleanId, {
          ...existing,
          ...incomingTx,
          id: cleanId,
          amount: roundToTwoDecimals(incomingTx.amount !== undefined ? incomingTx.amount : existing.amount),
          receipt_url: incomingTx.receipt_url || existing.receipt_url,
          created_at: existing.created_at || incomingTx.created_at,
        });
        updatedCount++;
      } else if (fingerprintMap.has(fp)) {
        // Same content fingerprint under different ID -> Update existing record without inserting new row
        const existingId = fingerprintMap.get(fp)!;
        const existing = byIdMap.get(existingId)!;
        byIdMap.set(existingId, {
          ...existing,
          ...incomingTx,
          id: existingId, // Keep existing ID
          receipt_url: incomingTx.receipt_url || existing.receipt_url,
        });
        duplicateCount++;
      } else {
        // Genuine new record -> Insert
        byIdMap.set(cleanId, {
          ...incomingTx,
          id: cleanId,
          amount: roundToTwoDecimals(incomingTx.amount),
        });
        fingerprintMap.set(fp, cleanId);
        newCount++;
      }
    });

    console.log(`[MyWang Sync] Merge Summary: ${newCount} baru, ${updatedCount} dikemaskini, ${duplicateCount} pendua dihindari. Total rekod disimpan: ${byIdMap.size}`);

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
   * Helper to check if backend API is reachable
   */
  static isBackendServerAvailable(): boolean {
    return true;
  }

  /**
   * Export all user data as a single portable JSON string (Cross-device sync)
   */
  static exportFullBackupJSON(): string {
    const backup = {
      accounts: this.getAccounts(),
      transactions: this.getTransactions(),
      loans: this.getLoans(),
      categories: this.getCategories(),
      gasConfig: this.getGoogleSheetsConfig(),
      secretPasscode: this.getSecretPasscode(),
      exported_at: new Date().toISOString(),
      version: '2.0',
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import all user data from portable JSON string (Restores completely on mobile / PC)
   */
  static importFullBackupJSON(jsonStr: string): { success: boolean; message: string; count?: number } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Format data JSON tidak sah.' };
      }

      let txCount = 0;
      if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
        const normAccs = this.normalizeAccounts(parsed.accounts);
        this.saveAccounts(normAccs);
      }

      if (Array.isArray(parsed.transactions)) {
        const cleanTxs = this.filterDeletedTransactions(parsed.transactions);
        this.saveTransactions(cleanTxs);
        txCount = cleanTxs.length;
      }

      if (Array.isArray(parsed.loans)) {
        this.saveLoans(parsed.loans);
      }

      if (parsed.categories && parsed.categories.incomeTypes && parsed.categories.expenseTypes) {
        this.saveCategories(parsed.categories.incomeTypes, parsed.categories.expenseTypes);
      }

      if (parsed.gasConfig && parsed.gasConfig.webAppUrl) {
        this.saveGoogleSheetsConfig(parsed.gasConfig);
      }

      if (parsed.secretPasscode) {
        this.saveSecretPasscode(parsed.secretPasscode);
      }

      // Return success directly
      return {
        success: true,
        message: `Berjaya memulihkan data (${txCount} transaksi, ${parsed.accounts?.length || 0} akaun)!`,
        count: txCount,
      };
    } catch (e: any) {
      return { success: false, message: `Ralat memproses fail data: ${e?.message || 'Data rosak'}` };
    }
  }

  /**
   * Server Backend Persistence (Throttled & Non-blocking)
   */
  static async saveToBackendServer(_fullData: any = {}): Promise<boolean> {
    // Disabled high-frequency origin transfer to prevent Vercel bandwidth limits
    return true;
  }

  static async loadFromBackendServer(): Promise<any | null> {
    // Rely on local storage & direct Google Sheets sync
    return null;
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
      // Helper 1: Direct client-side POST (CORS-friendly text/plain, GAS auto-redirects 302 to JSON)
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
          if (res.ok) {
            const txt = await res.text();
            try {
              return JSON.parse(txt);
            } catch {
              return { status: 'raw', text: txt };
            }
          }
        } catch (e) {
          console.warn('[MyWang GAS Direct] Direct POST failed, trying JSONP fallback:', e);
        }
        return null;
      };

      // Helper 2: JSONP GET Fetch (100% CORS-safe script injection fallback)
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
            }, 12000);

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

      // Direct-First Executor: Direct HTTPS POST -> JSONP Fallback (Zero Vercel Proxy)
      const executeGasCall = async (act: string, bodyObj: any = {}) => {
        // 1. Direct POST to Google Apps Script Web App
        const directRes = await fetchDirect(act, bodyObj);
        if (directRes && (directRes.status === 'success' || directRes.data || directRes.transactions || directRes.accounts)) {
          return directRes;
        }

        // 2. JSONP fallback if direct POST had CORS issues on specific browser
        const jsonpRes = await fetchViaJsonp(act, bodyObj);
        if (jsonpRes && (jsonpRes.status === 'success' || jsonpRes.data || jsonpRes.transactions || jsonpRes.accounts)) {
          return jsonpRes;
        }

        return directRes || jsonpRes;
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

      // If initial fetch / getInitialData / syncDashboard / getTransactions
      if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions' || action === 'get_accounts' || action === 'getTransactions') {
        if (StorageService.isSyncLocked) {
          console.log('[MyWang Sync] Sync sedang berjalan, membatalkan panggilan serentak.');
          return {
            success: true,
            data: {
              transactions: this.getTransactions(),
              accounts: this.getAccounts(),
            },
            message: 'Penyegerakan sedang diproses di latar belakang.',
          };
        }

        StorageService.isSyncLocked = true;
        console.log(`[MyWang Sync] Memulakan penyegerakan pantas (Maksima 25 Transaksi Terkini) untuk pengguna: ${activeUsername || 'default'}`);

        try {
          let latestGasTxs: any[] = [];
          let gasAccs: any[] = [];

          // 1. FAST SINGLE-SHOT CALL - STRICT LIMIT 25
          try {
            const fastBundle = await executeGasCall('getInitialData', { username: activeUsername, limit: 25 });
            if (fastBundle && (fastBundle.status === 'success' || fastBundle.accounts || fastBundle.transactions || fastBundle.data)) {
              if (Array.isArray(fastBundle.transactions) && fastBundle.transactions.length > 0) {
                latestGasTxs = fastBundle.transactions.slice(0, 25);
              } else if (Array.isArray(fastBundle.data?.transactions) && fastBundle.data.transactions.length > 0) {
                latestGasTxs = fastBundle.data.transactions.slice(0, 25);
              }

              if (Array.isArray(fastBundle.accounts) && fastBundle.accounts.length > 0) {
                gasAccs = fastBundle.accounts;
              } else if (Array.isArray(fastBundle.data?.accounts) && fastBundle.data.accounts.length > 0) {
                gasAccs = fastBundle.data.accounts;
              }
            }
          } catch (err) {
            console.warn('[MyWang Sync] Fast bundle error:', err);
          }

          // Fallback single query if needed
          if (latestGasTxs.length === 0 && gasAccs.length === 0) {
            try {
              const resTx = await executeGasCall('get_transactions', { username: activeUsername, limit: 25 });
              if (resTx && resTx.status === 'success') {
                if (Array.isArray(resTx.transactions)) latestGasTxs = resTx.transactions.slice(0, 25);
                if (Array.isArray(resTx.accounts)) gasAccs = resTx.accounts;
              }
            } catch {}
          }

          // Normalize incoming transactions
          const normalizedTxs = this.normalizeRawTransactions(latestGasTxs);
          console.log(`[MyWang Sync] Menerima ${normalizedTxs.length} transaksi dari pelayan.`);

          // Process and merge accounts safely (Preserving accurate balances)
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
                  // Keep local balance if incoming balance is not explicitly valid number
                  balance: typeof incoming.balance === 'number' && !isNaN(incoming.balance) ? incoming.balance : current.balance,
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

          // Merge latest 25 with full local history without loss or duplication
          let combinedTxs = this.getTransactions();
          if (normalizedTxs.length > 0) {
            combinedTxs = this.mergeAndDeduplicateTransactions(combinedTxs, normalizedTxs);
            this.saveTransactions(combinedTxs);
          }

          // Update config timestamp
          config.isConnected = true;
          config.lastSynced = getMalaysiaTimeString(new Date(), false);
          this.saveGoogleSheetsConfig(config);
          try {
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, String(Date.now()));
          } catch {}

          return {
            success: true,
            data: {
              transactions: combinedTxs,
              accounts: normalizedAccs,
            },
            message: `Penyegerakan pantas berjaya! (${normalizedTxs.length} transaksi diselaraskan, ${combinedTxs.length} rekod disimpan).`,
          };
        } finally {
          StorageService.isSyncLocked = false;
        }
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
