import React, { useState, useEffect } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency, getMalaysiaDateString } from '../utils/formatters';
import { X, ArrowLeftRight, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TransferModalProps {
  isOpen: boolean;
  accounts: Account[];
  initialSourceAccount?: Account | null;
  onClose: () => void;
  onTransfer: (transferData: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    date: string;
    note: string;
  }) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  accounts,
  initialSourceAccount,
  onClose,
  onTransfer,
}) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getMalaysiaDateString());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(getMalaysiaDateString());
    }
  }, [isOpen]);

  useEffect(() => {
    if (accounts.length > 0) {
      const defaultFrom = initialSourceAccount ? initialSourceAccount.id : accounts[0].id;
      setFromAccountId(defaultFrom);

      // Find first different account for destination
      const otherAcc = accounts.find((a) => a.id !== defaultFrom);
      if (otherAcc) {
        setToAccountId(otherAcc.id);
      }
    }
  }, [accounts, initialSourceAccount, isOpen]);

  if (!isOpen) return null;

  const fromAcc = accounts.find((a) => a.id === fromAccountId);
  const toAcc = accounts.find((a) => a.id === toAccountId);
  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fromAccountId || !toAccountId) {
      setError('Sila pilih akaun sumber dan akaun destinasi.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setError('Akaun sumber dan penerima tidak boleh sama.');
      return;
    }

    if (numAmount <= 0) {
      setError('Jumlah pindahan mestilah melebihi RM 0.00.');
      return;
    }

    setIsSubmitting(true);
    await onTransfer({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: numAmount,
      date,
      note: note.trim() || `Pindahan dari ${fromAcc?.account_name} ke ${toAcc?.account_name}`,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pindahan Dana (Transfer)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dual-entry auto balance: Total Money kekal tidak berubah.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Source & Destination Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              
              {/* From Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Dari Akaun (Sumber)
                </label>
                <select
                  id="select_transfer_from"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank} - {acc.account_name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* To Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ke Akaun (Penerima)
                </label>
                <select
                  id="select_transfer_to"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank} - {acc.account_name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jumlah Pindahan (RM)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  RM
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  id="input_transfer_amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Dual-Entry Preview */}
            {fromAcc && toAcc && numAmount > 0 && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs">
                <div className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pratonton Baki Selepas Pindahan:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-100 dark:border-blue-900">
                    <p className="text-[10px] text-slate-400">{fromAcc.bank} ({fromAcc.account_name})</p>
                    <p className="font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(fromAcc.balance - numAmount)}
                    </p>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-100 dark:border-blue-900">
                    <p className="text-[10px] text-slate-400">{toAcc.bank} ({toAcc.account_name})</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(toAcc.balance + numAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tarikh Pindahan
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nota / Tujuan Pindahan
              </label>
              <input
                type="text"
                id="input_transfer_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="cth: Topup TNG untuk tol & reload MAE"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                id="btn_submit_transfer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Lakukan Pindahan</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
