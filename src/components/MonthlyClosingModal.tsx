import React, { useState, useMemo, useEffect } from 'react';
import { Account, Transaction, MonthlyClosedRecord, User } from '../types';
import { formatCurrency, formatDateMalay } from '../utils/formatters';
import { StorageService } from '../services/storage';
import {
  X,
  Lock,
  Unlock,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Printer,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  AlertCircle,
  History,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MonthlyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  user: User | null;
  onMonthClosed?: (record: MonthlyClosedRecord) => void;
}

const STORAGE_KEY_CLOSED_MONTHS = 'mywang_closed_months_v1';

export const MonthlyClosingModal: React.FC<MonthlyClosingModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions,
  user,
  onMonthClosed,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [closedMonths, setClosedMonths] = useState<Record<string, MonthlyClosedRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLOSED_MONTHS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [notes, setNotes] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  // Month names in Malay
  const monthNamesMalay: Record<string, string> = {
    '01': 'Januari',
    '02': 'Februari',
    '03': 'Mac',
    '04': 'April',
    '05': 'Mei',
    '06': 'Jun',
    '07': 'Julai',
    '08': 'Ogos',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Disember',
  };

  const getReadableMonthName = (mStr: string) => {
    const [year, month] = mStr.split('-');
    return `${monthNamesMalay[month] || month} ${year}`;
  };

  const isCurrentMonthLocked = !!closedMonths[selectedMonth]?.is_locked;
  const currentClosedRecord = closedMonths[selectedMonth];

  // Calculate monthly stats for selected month
  const monthlyStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfers = 0;
    let totalAdjustments = 0;
    let totalRefunds = 0;

    const monthTxs = transactions.filter((tx) => (tx.date || tx.created_at || '').startsWith(selectedMonth));

    monthTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') totalIncome += amt;
      else if (tx.type === 'expense') totalExpense += amt;
      else if (tx.type === 'transfer') totalTransfers += amt;
      else if (tx.type === 'adjustment') totalAdjustments += amt;
      else if (tx.type === 'refund') totalRefunds += amt;
    });

    const netSavings = totalIncome + totalRefunds - totalExpense;
    const currentTotalAssets = accounts
      .filter((a) => a.type !== 'credit_card' && a.type !== 'paylater')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const closingBalance = currentTotalAssets;
    const openingBalance = closingBalance - netSavings;

    return {
      monthTxsCount: monthTxs.length,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalTransfers: Math.round(totalTransfers * 100) / 100,
      totalAdjustments: Math.round(totalAdjustments * 100) / 100,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      savingsRate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0,
    };
  }, [transactions, selectedMonth, accounts]);

  // Account Breakdown for selected month
  const accountBreakdown = useMemo(() => {
    const monthTxs = transactions.filter((tx) => (tx.date || tx.created_at || '').startsWith(selectedMonth));

    return accounts.map((acc) => {
      let inAmt = 0;
      let outAmt = 0;

      monthTxs.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income' || tx.type === 'refund') {
          if (tx.account_id === acc.id) inAmt += amt;
        } else if (tx.type === 'expense') {
          if (tx.account_id === acc.id) outAmt += amt;
        } else if (tx.type === 'transfer') {
          if (tx.account_id === acc.id) outAmt += amt;
          else if (tx.to_account_id === acc.id) inAmt += amt;
        }
      });

      return {
        id: acc.id,
        bank: acc.bank,
        name: acc.account_name,
        type: acc.type,
        inflow: Math.round(inAmt * 100) / 100,
        outflow: Math.round(outAmt * 100) / 100,
        currentBalance: acc.balance,
      };
    });
  }, [accounts, transactions, selectedMonth]);

  if (!isOpen) return null;

  const handleCloseMonth = () => {
    setIsLocking(true);
    const newRecord: MonthlyClosedRecord = {
      id: `closing_${selectedMonth}_${Date.now()}`,
      month: selectedMonth,
      month_name: getReadableMonthName(selectedMonth),
      opening_balance: monthlyStats.openingBalance,
      total_income: monthlyStats.totalIncome,
      total_expense: monthlyStats.totalExpense,
      total_transfers: monthlyStats.totalTransfers,
      total_adjustments: monthlyStats.totalAdjustments,
      total_refunds: monthlyStats.totalRefunds,
      closing_balance: monthlyStats.closingBalance,
      net_savings: monthlyStats.netSavings,
      closed_at: new Date().toISOString(),
      closed_by: user?.full_name || user?.username || 'Firdaus',
      is_locked: true,
      notes: notes.trim(),
    };

    const updated = { ...closedMonths, [selectedMonth]: newRecord };
    setClosedMonths(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CLOSED_MONTHS, JSON.stringify(updated));
    } catch {}

    StorageService.addLog(
      'CLOSE_MONTH',
      `Penutupan Akaun Bulan ${newRecord.month_name} ditutup rasmi oleh ${newRecord.closed_by}. Baki Penutupan: RM ${newRecord.closing_balance.toFixed(2)} (Lebihan: RM ${newRecord.net_savings.toFixed(2)})`,
      user?.username
    );

    if (onMonthClosed) onMonthClosed(newRecord);
    setIsLocking(false);
  };

  const handleUnlockMonth = () => {
    const updated = { ...closedMonths };
    delete updated[selectedMonth];
    setClosedMonths(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CLOSED_MONTHS, JSON.stringify(updated));
    } catch {}

    StorageService.addLog(
      'UNLOCK_MONTH',
      `Kunci Penutupan Akaun Bulan ${getReadableMonthName(selectedMonth)} dibuka semula oleh ${user?.username || 'Admin'}`,
      user?.username
    );
  };

  const handleExportClosingCSV = () => {
    const headers = ['Perkara / Item', 'Nilai (RM)'];
    const rows = [
      ['Bulan Penutupan', getReadableMonthName(selectedMonth)],
      ['Baki Pembukaan Awal Bulan (Opening Balance)', monthlyStats.openingBalance.toFixed(2)],
      ['(+) Jumlah Pendapatan / Duit Masuk', monthlyStats.totalIncome.toFixed(2)],
      ['(+) Pemulangan Wang (Refunds)', monthlyStats.totalRefunds.toFixed(2)],
      ['(-) Jumlah Perbelanjaan / Duit Keluar', monthlyStats.totalExpense.toFixed(2)],
      ['(+/-) Pelarasan Bersih', monthlyStats.totalAdjustments.toFixed(2)],
      ['(=) Lebihan Simpanan Bersih (Net Savings)', monthlyStats.netSavings.toFixed(2)],
      ['(=) Baki Penutupan Akhir Bulan (Closing Balance)', monthlyStats.closingBalance.toFixed(2)],
      ['Kadar Simpanan (Savings Rate)', `${monthlyStats.savingsRate}%`],
      ['Status Kunci', isCurrentMonthLocked ? 'DITUTUP & DIKUNCI' : 'BELUM DITUTUP'],
      ['Ditutup Oleh', currentClosedRecord?.closed_by || '-'],
      ['Tarikh Tutup', currentClosedRecord?.closed_at || '-'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => `"${r[0]}","${r[1]}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Penutupan_Akaun_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">
                    Penutupan Akaun Bulanan (Monthly Closing)
                  </h2>
                  {isCurrentMonthLocked && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      TERKUNCI
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/80">
                  Imbangan duga, rekod penyata akhir bulan, dan penguncian lejar kewangan.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Month Selector Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-500">
                ({getReadableMonthName(selectedMonth)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportClosingCSV}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Eksport Ringkasan</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Status Banner */}
            {isCurrentMonthLocked ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">
                    Bulan {getReadableMonthName(selectedMonth)} Telah Ditutup & Dikunci
                  </span>
                  <p className="text-amber-800 dark:text-amber-200/90">
                    Ditutup pada {formatDateMalay(currentClosedRecord?.closed_at || '')} oleh{' '}
                    <strong>{currentClosedRecord?.closed_by}</strong>.
                    {currentClosedRecord?.notes && ` Nota: "${currentClosedRecord.notes}"`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                    Ringkasan Lembaran Penutupan Bersedia
                  </span>
                  <p className="text-emerald-800 dark:text-emerald-200/90">
                    Semak imbangan duga dan rekod penutupan di bawah sebelum mengunci bulan ini.
                  </p>
                </div>
              </div>
            )}

            {/* Financial Reconciliation Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-400 block">Baki Pembukaan Awal</span>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block mt-1">
                  {formatCurrency(monthlyStats.openingBalance)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">(+) Duit Masuk</span>
                <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 block mt-1">
                  +{formatCurrency(monthlyStats.totalIncome + monthlyStats.totalRefunds)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 block">(-) Duit Keluar</span>
                <span className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300 block mt-1">
                  -{formatCurrency(monthlyStats.totalExpense)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 block">(=) Baki Penutupan Akhir</span>
                <span className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-300 block mt-1">
                  {formatCurrency(monthlyStats.closingBalance)}
                </span>
              </div>
            </div>

            {/* Detailed Statement Table */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Lembaran Imbangan Duga Rasmi ({getReadableMonthName(selectedMonth)})
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-600 dark:text-slate-400">Baki Pembukaan (Opening Balance):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyStats.openingBalance)}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700/60 text-emerald-600 dark:text-emerald-400">
                  <span>+ Jumlah Pendapatan (Income):</span>
                  <span className="font-bold">+{formatCurrency(monthlyStats.totalIncome)}</span>
                </div>

                {monthlyStats.totalRefunds > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700/60 text-emerald-600 dark:text-emerald-400">
                    <span>+ Pemulangan Wang (Refunds):</span>
                    <span className="font-bold">+{formatCurrency(monthlyStats.totalRefunds)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700/60 text-rose-600 dark:text-rose-400">
                  <span>- Jumlah Perbelanjaan (Expenses):</span>
                  <span className="font-bold">-{formatCurrency(monthlyStats.totalExpense)}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700/60 text-blue-600 dark:text-blue-400">
                  <span>Pindahan Antara Akaun (Transfers):</span>
                  <span className="font-medium">{formatCurrency(monthlyStats.totalTransfers)} (Neutral)</span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-slate-300 dark:border-slate-600 text-sm font-black">
                  <span>Lebihan / Simpanan Bersih (Net Savings):</span>
                  <span className={monthlyStats.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {monthlyStats.netSavings >= 0 ? `+${formatCurrency(monthlyStats.netSavings)}` : `-${formatCurrency(Math.abs(monthlyStats.netSavings))}`}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-t border-slate-300 dark:border-slate-600 text-sm font-black">
                  <span>Baki Penutupan Akhir (Closing Balance):</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(monthlyStats.closingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown by Account */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pecahan Aliran Mengikut Akaun ({accounts.length} akaun)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
                {accountBreakdown.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{acc.name}</span>
                      <span className="text-[10px] text-slate-400">{acc.bank}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                        +{formatCurrency(acc.inflow)}
                      </span>
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
                        -{formatCurrency(acc.outflow)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lock Notes / Actions */}
            {!isCurrentMonthLocked && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Catatan Penutupan Bulan (Pilihan):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="cth: Semua resit disahkan, lebihan dimasukkan ke ASB/MIGA"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <div className="flex items-center gap-2">
              {isCurrentMonthLocked ? (
                <button
                  onClick={handleUnlockMonth}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Buka Semula Kunci Bulan</span>
                </button>
              ) : (
                <button
                  onClick={handleCloseMonth}
                  disabled={isLocking}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/25"
                >
                  <Lock className="w-4 h-4" />
                  <span>Tutup & Kunci Bulan Ini</span>
                </button>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
