import React, { useState } from 'react';
import { Account, AccountType } from '../types';
import { X, Plus, Landmark, Smartphone, CreditCard, Clock, PiggyBank, Wallet, Sparkles, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newAccount: Account) => Promise<void>;
}

const POPULAR_INSTITUTIONS = [
  'Maybank',
  'RHB Bank',
  'CIMB',
  "Touch 'n Go",
  'Boost',
  'Setel by Petronas',
  'Shopee',
  'Atome',
  'BSN',
  'GXBANK',
  'AEON BANK',
  'ASNB',
  'Bank Islam',
  'Public Bank',
  'Hong Leong Bank',
  'AmBank',
  'Affin Bank',
  'Bank Muamalat',
  'Tabung Haji',
  'Dompet Tunai / Cash',
  'Lain-lain'
];

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [bank, setBank] = useState('Maybank');
  const [customBank, setCustomBank] = useState('');
  const [accountName, setAccountName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const institutionName = bank === 'Lain-lain' && customBank.trim() ? customBank.trim() : bank;
    const finalAccountName = accountName.trim() || `${institutionName} Akaun`;
    const numBalance = parseFloat(balance) || 0;

    const newAcc: Account = {
      id: 'acc_' + Date.now(),
      bank: institutionName,
      account_name: finalAccountName,
      type: type,
      balance: numBalance,
      notes: notes.trim(),
      updated_at: new Date().toISOString().split('T')[0],
    };

    await onAdd(newAcc);
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
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                + Tambah Akaun Baru
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar akaun bank, dompet digital, atau kad kredit anda.
              </p>
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
            
            {/* Institution / Bank */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Institusi / Bank / e-Wallet
              </label>
              <select
                id="select_add_bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {POPULAR_INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>

            {bank === 'Lain-lain' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Institusi Kustom
                </label>
                <input
                  type="text"
                  value={customBank}
                  onChange={(e) => setCustomBank(e.target.value)}
                  required
                  placeholder="cth: Koperasi / Crypto / Wallet Luar"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* Account Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jenis Akaun
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bank', label: 'Bank', icon: Landmark },
                  { id: 'ewallet', label: 'e-Wallet', icon: Smartphone },
                  { id: 'credit_card', label: 'Kad Kredit', icon: CreditCard },
                  { id: 'paylater', label: 'PayLater', icon: Clock },
                  { id: 'investment', label: 'Pelaburan / ASNB', icon: Coins },
                  { id: 'gold', label: 'Emas / MIGA', icon: Sparkles },
                  { id: 'cash', label: 'Tunai', icon: Wallet },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as AccountType)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Akaun
              </label>
              <input
                type="text"
                id="input_add_account_name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                placeholder="cth: MAE / Savings Account / Kad Cashback"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Opening Balance */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Baki Permulaan (RM) {(type === 'credit_card' || type === 'paylater') && <span className="text-rose-500 font-normal">(- jika ada hutang semasa)</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  RM
                </div>
                <input
                  type="number"
                  step="0.01"
                  id="input_add_balance"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan (Pilihan)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="cth: Gaji bulanan, rebate petrol"
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
                id="btn_submit_new_account"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Tambah Akaun</span>
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
