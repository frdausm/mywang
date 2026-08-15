import React, { useState } from 'react';
import { Account } from '../types';
import { formatCurrency, formatDateMalay, getBankVisuals } from '../utils/formatters';
import { 
  Pencil, 
  ArrowLeftRight, 
  Plus, 
  CreditCard, 
  Smartphone, 
  Landmark, 
  Clock, 
  Zap, 
  Fuel, 
  ShoppingBag, 
  Flame, 
  Coins, 
  Wallet,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface AccountsGridProps {
  accounts: Account[];
  onEditAccount: (account: Account) => void;
  onQuickTransfer: (sourceAccount: Account) => void;
  onAddAccount: () => void;
}

export const AccountsGrid: React.FC<AccountsGridProps> = ({
  accounts,
  onEditAccount,
  onQuickTransfer,
  onAddAccount,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredAccounts = accounts.filter((acc) => {
    if (filterType === 'all') return true;
    if (filterType === 'bank') return acc.type === 'bank';
    if (filterType === 'ewallet') return acc.type === 'ewallet';
    if (filterType === 'credit') return acc.type === 'credit_card' || acc.type === 'paylater';
    if (filterType === 'invest') return acc.type === 'investment' || acc.type === 'gold';
    if (filterType === 'cash') return acc.type === 'cash';
    return true;
  });

  // Helper to render account type icon
  const renderAccountIcon = (acc: Account) => {
    if (acc.type === 'gold') return <Sparkles className="w-4 h-4 text-amber-500" />;
    if (acc.type === 'investment') return <Coins className="w-4 h-4 text-teal-500" />;
    if (acc.type === 'cash') return <Wallet className="w-4 h-4 text-emerald-500" />;
    if (acc.type === 'bank') return <Landmark className="w-4 h-4" />;
    if (acc.type === 'ewallet') return <Smartphone className="w-4 h-4" />;
    if (acc.type === 'credit_card') return <CreditCard className="w-4 h-4" />;
    if (acc.type === 'paylater') return <Clock className="w-4 h-4" />;
    return <Wallet className="w-4 h-4" />;
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank': return 'Akaun Bank';
      case 'ewallet': return 'e-Wallet';
      case 'credit_card': return 'Kad Kredit';
      case 'paylater': return 'PayLater / BNPL';
      case 'investment': return 'Pelaburan / SSP / ASNB';
      case 'gold': return 'Emas Digital (MIGA)';
      case 'cash': return 'Duit Tunai';
      default: return 'Akaun';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Akaun & Dompet Saya ({accounts.length})</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
              Live Baki
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bank, e-Wallet, Tunai di Tangan, Pelaburan ASNB / SSP BSN, Emas MIGA & Kad Kredit.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'bank', label: 'Bank' },
            { id: 'ewallet', label: 'e-Wallet' },
            { id: 'credit', label: 'Kad & PayLater' },
            { id: 'invest', label: 'Pelaburan & Emas' },
            { id: 'cash', label: 'Tunai di Tangan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Render each Account */}
        {filteredAccounts.map((acc, index) => {
          const visuals = getBankVisuals(acc.bank);
          const isDebt = acc.type === 'credit_card' || acc.type === 'paylater';
          const isNegative = acc.balance < 0;

          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all flex flex-col justify-between"
            >
              {/* Top Bank Header Strip */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* Bank Brand Badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border shadow-xs ${visuals.badgeColor}`}>
                      {acc.bank}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {renderAccountIcon(acc)}
                      {getAccountTypeLabel(acc.type)}
                    </span>
                  </div>

                  {/* Pencil Edit Button */}
                  <button
                    onClick={() => onEditAccount(acc)}
                    id={`btn_edit_acc_${acc.id}`}
                    title="Kemaskini Baki (Pencil)"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {/* Account Name */}
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mb-1" title={acc.account_name}>
                  {acc.account_name}
                </h3>

                {/* Special Metadata for Gold/ASNB/SSP */}
                {acc.type === 'gold' && acc.weight_grams && (
                  <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      ⚖️ {acc.weight_grams} g (Emas 999.9)
                    </span>
                    {acc.avg_price_per_gram && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Purata: RM {acc.avg_price_per_gram.toFixed(2)}/g
                      </span>
                    )}
                  </div>
                )}

                {acc.fund_name && (
                  <div className="mb-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Tabung: {acc.fund_name}
                    </span>
                  </div>
                )}

                {acc.notes && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-400 line-clamp-1 mb-3">
                    {acc.notes}
                  </p>
                )}
              </div>

              {/* Balance & Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {isDebt ? 'Baki Digunakan:' : 'Baki Semasa:'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {formatDateMalay(acc.updated_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xl font-black tracking-tight ${
                    isNegative 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-slate-900 dark:text-emerald-400'
                  }`}>
                    {formatCurrency(acc.balance)}
                  </span>

                  {/* Quick Transfer Button */}
                  <button
                    onClick={() => onQuickTransfer(acc)}
                    title={`Pindah wang dari ${acc.account_name}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Pindah</span>
                  </button>
                </div>
              </div>

            </motion.div>
          );
        })}

        {/* Large "+ Tambah Akaun" Card */}
        <motion.button
          onClick={onAddAccount}
          id="btn_add_account_grid"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="min-h-[160px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 p-5 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              + Tambah Akaun Baru
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Maybank, RHB, TNG, CIMB atau kustom
            </p>
          </div>
        </motion.button>

      </div>
    </div>
  );
};
