import React, { useState, useEffect } from 'react';
import { Account } from '../types';
import { getMalaysiaDateString, roundToTwoDecimals } from '../utils/formatters';
import { X, Check, Landmark, CreditCard, Smartphone, DollarSign, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EditAccountModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onSave: (updatedAccount: Account) => Promise<void>;
  onDelete?: (accountId: string) => Promise<void>;
}

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  account,
  onClose,
  onSave,
  onDelete,
}) => {
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [weightGrams, setWeightGrams] = useState<string>('');
  const [avgPricePerGram, setAvgPricePerGram] = useState<string>('');
  const [totalInvested, setTotalInvested] = useState<string>('');
  const [fundName, setFundName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setAccountName(account.account_name || '');
      setBalance(account.balance.toString());
      setNotes(account.notes || '');
      setWeightGrams(account.weight_grams ? account.weight_grams.toString() : '');
      setAvgPricePerGram(account.avg_price_per_gram ? account.avg_price_per_gram.toString() : '');
      setTotalInvested(account.total_invested ? account.total_invested.toString() : '');
      setFundName(account.fund_name || '');
      setAccountNumber(account.account_number || '');
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const numBalance = roundToTwoDecimals(balance);
    const updated: Account = {
      ...account,
      account_name: accountName.trim() || account.bank,
      balance: numBalance,
      notes: notes.trim(),
      weight_grams: weightGrams ? parseFloat(weightGrams) : undefined,
      avg_price_per_gram: avgPricePerGram ? parseFloat(avgPricePerGram) : undefined,
      total_invested: totalInvested ? parseFloat(totalInvested) : undefined,
      fund_name: fundName.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      updated_at: getMalaysiaDateString(),
    };

    await onSave(updated);
    setIsSaving(false);
    onClose();
  };

  const isLiability = account.type === 'credit_card' || account.type === 'paylater';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                {account.bank}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Kemaskini Baki Akaun
              </h2>
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Akaun
              </label>
              <input
                type="text"
                id="edit_acc_name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                placeholder="cth: Savings Account / MAE"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Baki Semasa (RM) {isLiability && <span className="text-rose-500 font-normal">(- untuk baki hutang semasa)</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  RM
                </div>
                <input
                  type="number"
                  step="0.01"
                  id="edit_acc_balance"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Perubahan baki akan terus mengira semula Total Money & Cash Available.
              </p>
            </div>

            {account.type === 'gold' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Berat Emas (Gram)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    placeholder="0.088"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Harga Purata (RM/g)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={avgPricePerGram}
                    onChange={(e) => setAvgPricePerGram(e.target.value)}
                    placeholder="604.79"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {(account.fund_name || account.account_number || account.bank === 'ASNB') && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <div>
                  <label className="block text-[11px] font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Nama Dana / Tabung
                  </label>
                  <input
                    type="text"
                    value={fundName}
                    onChange={(e) => setFundName(e.target.value)}
                    placeholder="Amanah Saham Bumiputera"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    No. Akaun Ahli
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="000007814094"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan / Kegunaan
              </label>
              <textarea
                rows={2}
                id="edit_acc_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="cth: Simpanan perbelanjaan dapur mingguan"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Adakah anda pasti ingin memadamkan akaun ${account.account_name}?`)) {
                      await onDelete(account.id);
                      onClose();
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  Padam Akaun
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  id="btn_save_account"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan & Auto-Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
