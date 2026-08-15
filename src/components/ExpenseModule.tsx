import React, { useState } from 'react';
import { Transaction, Account, CategoryItem } from '../types';
import { formatCurrency } from '../utils/formatters';
import { 
  ArrowUpRight, 
  Plus, 
  Settings, 
  Scan, 
  Trash2, 
  Pencil,
  ShoppingBag, 
  Flame, 
  TrendingDown,
  Receipt
} from 'lucide-react';
import { motion } from 'motion/react';
import { ReceiptViewerModal } from './ReceiptViewerModal';

interface ExpenseModuleProps {
  transactions: Transaction[];
  accounts: Account[];
  expenseCategories: CategoryItem[];
  onAddExpense: () => void;
  onOpenReceiptScanner: () => void;
  onOpenCategoryManager: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const ExpenseModule: React.FC<ExpenseModuleProps> = ({
  transactions,
  accounts,
  expenseCategories,
  onAddExpense,
  onOpenReceiptScanner,
  onOpenCategoryManager,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewingReceiptTx, setViewingReceiptTx] = useState<Transaction | null>(null);

  const expenseList = transactions.filter((t) => t.type === 'expense');
  const filteredExpense = selectedCategory === 'all'
    ? expenseList
    : expenseList.filter((t) => t.category === selectedCategory);

  const totalExpense = expenseList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const avgExpense = expenseList.length > 0 ? totalExpense / expenseList.length : 0;

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 rounded-3xl p-6 text-white shadow-lg shadow-rose-700/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-white/15 text-rose-200 backdrop-blur-sm">
                <ArrowUpRight className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold">Pengurusan Duit Keluar (Expense)</h2>
            </div>
            <p className="text-xs text-rose-100 max-w-xl">
              Kawal perbelanjaan harian, bil utiliti, makanan, petrol, ansuran kad kredit dan paylater.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenReceiptScanner}
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Imbas Resit AI</span>
            </button>

            <button
              onClick={onOpenCategoryManager}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Urus Kategori</span>
            </button>

            <button
              onClick={onAddExpense}
              className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-800 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Rekod Perbelanjaan</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/15 text-white">
          <div className="bg-black/15 p-3 rounded-2xl backdrop-blur-xs">
            <p className="text-[11px] text-rose-200">Jumlah Keseluruhan Keluar</p>
            <p className="text-xl font-black mt-0.5">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-black/15 p-3 rounded-2xl backdrop-blur-xs">
            <p className="text-[11px] text-rose-200">Bilangan Transaksi Keluar</p>
            <p className="text-xl font-black mt-0.5">{expenseList.length} rekod</p>
          </div>
          <div className="bg-black/15 p-3 rounded-2xl backdrop-blur-xs">
            <p className="text-[11px] text-rose-200">Purata Setiap Belanja</p>
            <p className="text-xl font-black mt-0.5">{formatCurrency(avgExpense)}</p>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          Semua ({expenseList.length})
        </button>
        {expenseCategories.map((c) => {
          const count = expenseList.filter((t) => t.category === c.name).length;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === c.name
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || '#EF4444' }} />
              <span>{c.name} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* Expense List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Tarikh</th>
                <th className="py-3 px-4">Akaun Pembayar</th>
                <th className="py-3 px-4">Kategori Belanja</th>
                <th className="py-3 px-4">Nota / Butiran</th>
                <th className="py-3 px-4 text-right">Jumlah Keluar</th>
                <th className="py-3 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredExpense.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Tiada rekod perbelanjaan untuk kategori ini.
                  </td>
                </tr>
              ) : (
                filteredExpense.map((tx) => (
                  <tr key={tx.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {tx.account_name || tx.account_id}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {tx.note || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {tx.receipt_url && (
                          <button
                            onClick={() => setViewingReceiptTx(tx)}
                            title="Lihat Gambar Resit & Butiran AI"
                            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onEditTransaction(tx)}
                          title="Kemaskini (Pencil)"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Padam rekod perbelanjaan ini (-${formatCurrency(tx.amount)})?`)) {
                              await onDeleteTransaction(tx.id);
                            }
                          }}
                          title="Padam (Tong Sampah)"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Image Viewer Modal */}
      <ReceiptViewerModal
        isOpen={!!viewingReceiptTx}
        onClose={() => setViewingReceiptTx(null)}
        transaction={viewingReceiptTx}
      />
    </div>
  );
};
