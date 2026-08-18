import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency, formatDateMalay } from '../utils/formatters';
import {
  X,
  Search,
  Receipt,
  Landmark,
  CreditCard,
  Smartphone,
  Coins,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
  Calendar,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  onSelectAccount: (account: Account) => void;
  onSelectTransaction: (transaction: Transaction) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions,
  onSelectAccount,
  onSelectTransaction,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // Trigger open via custom event or let parent handle
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Matched accounts
  const matchedAccounts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return accounts.filter(
      (a) =>
        a.account_name.toLowerCase().includes(q) ||
        a.bank.toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q) ||
        (a.account_number || '').includes(q)
    );
  }, [accounts, query]);

  // Matched transactions
  const matchedTransactions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return transactions.filter(
      (t) =>
        (t.note || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.account_name || '').toLowerCase().includes(q) ||
        (t.to_account_name || '').toLowerCase().includes(q) ||
        (t.date || '').includes(q) ||
        t.amount.toString().includes(q)
    ).slice(0, 30);
  }, [transactions, query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 pt-16 sm:pt-20 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Search Input Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/80 dark:bg-slate-850">
            <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari transaksi, akaun, peniaga, kategori, atau jumlah (cth: 'Shopee', 'Maybank', 'Makan', '50')..."
              className="w-full bg-transparent text-sm sm:text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Results List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-5">
            {!query.trim() ? (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Taip apa sahaja untuk mencari dalam MyWang
                </p>
                <p className="text-[11px] text-slate-400">
                  Mencari serentak merentasi transaksi, akaun bank, kategori belanja, dan resit.
                </p>
              </div>
            ) : matchedAccounts.length === 0 && matchedTransactions.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Tiada hasil dijumpai untuk "{query}"
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cuba kata kunci lain seperti nama akaun, nama kedai, atau nombor jumlah.
                </p>
              </div>
            ) : (
              <>
                {/* Matched Accounts */}
                {matchedAccounts.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-1">
                      Akaun & Dompet ({matchedAccounts.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchedAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          onClick={() => {
                            onSelectAccount(acc);
                            onClose();
                          }}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform">
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                {acc.account_name}
                              </span>
                              <span className="text-[10px] text-slate-400">{acc.bank}</span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {formatCurrency(acc.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Transactions */}
                {matchedTransactions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-1">
                      Transaksi ({matchedTransactions.length})
                    </span>
                    <div className="space-y-1.5">
                      {matchedTransactions.map((tx) => {
                        const isIncome = tx.type === 'income' || tx.type === 'refund';
                        const isTransfer = tx.type === 'transfer';
                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              onSelectTransaction(tx);
                              onClose();
                            }}
                            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                                  isTransfer
                                    ? 'bg-blue-600'
                                    : isIncome
                                    ? 'bg-emerald-600'
                                    : 'bg-rose-500'
                                }`}
                              >
                                {isTransfer ? (
                                  <ArrowLeftRight className="w-4 h-4" />
                                ) : isIncome ? (
                                  <ArrowDownLeft className="w-4 h-4" />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {tx.category}
                                  </span>
                                  <span className="text-[10px] text-slate-400">• {tx.date}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                                  {tx.note || tx.account_name}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`text-xs font-black block ${
                                  isIncome
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isTransfer
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isIncome ? `+RM ${Number(tx.amount).toFixed(2)}` : `-RM ${Number(tx.amount).toFixed(2)}`}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{tx.type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with tips */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-[11px] text-slate-400 flex items-center justify-between px-5">
            <span>
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> untuk tutup
            </span>
            <span>Jumpa {matchedAccounts.length + matchedTransactions.length} hasil</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
