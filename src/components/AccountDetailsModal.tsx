import React, { useState, useMemo } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency, formatDateMalay, getBankVisuals } from '../utils/formatters';
import {
  isTransactionForAccount,
  isTransactionSourceForAccount,
  isTransactionDestinationForAccount,
} from '../utils/accountMatcher';
import {
  X,
  CreditCard,
  Smartphone,
  Landmark,
  Coins,
  Wallet,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Pencil,
  Trash2,
  Receipt,
  Layers,
  ChevronRight,
  Clock,
  PiggyBank
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccountDetailsModalProps {
  isOpen: boolean;
  account: Account | null;
  accounts: Account[];
  transactions: Transaction[];
  onClose: () => void;
  onEditAccount: (account: Account) => void;
  onQuickTransfer: (account: Account) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
  isOpen,
  account,
  accounts,
  transactions,
  onClose,
  onEditAccount,
  onQuickTransfer,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'trend' | 'statement'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Reset filter when opened
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setSearchQuery('');
      setTypeFilter('all');
      setSelectedMonth(new Date().toISOString().slice(0, 7));
    }
  }, [isOpen, account?.id]);

  const visuals = getBankVisuals(account?.bank || '');
  const isDebt = account?.type === 'credit_card' || account?.type === 'paylater';
  const isNegative = (account?.balance || 0) < 0;

  // Filter transactions belonging to this account (either as source account or destination transfer account)
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    return transactions.filter((tx) => isTransactionForAccount(tx, account, accounts));
  }, [transactions, account, accounts]);

  // Current Month calculations for this account
  const currentMonthPrefix = selectedMonth;
  const currentMonthTxs = useMemo(() => {
    return accountTransactions.filter((tx) => (tx.date || tx.created_at || '').startsWith(currentMonthPrefix));
  }, [accountTransactions, currentMonthPrefix]);

  const monthStats = useMemo(() => {
    if (!account) {
      return { inflows: 0, outflows: 0, transferIn: 0, transferOut: 0, netMovement: 0, txCount: 0 };
    }
    let inflows = 0;
    let outflows = 0;
    let transferIn = 0;
    let transferOut = 0;

    currentMonthTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const isSource = isTransactionSourceForAccount(tx, account, accounts);
      const isDest = isTransactionDestinationForAccount(tx, account, accounts);

      if (tx.type === 'income' || tx.type === 'refund') {
        if (isSource) inflows += amt;
      } else if (tx.type === 'expense') {
        if (isSource) outflows += amt;
      } else if (tx.type === 'transfer') {
        if (isSource) {
          transferOut += amt;
          outflows += amt;
        }
        if (isDest) {
          transferIn += amt;
          inflows += amt;
        }
      } else if (tx.type === 'adjustment') {
        if (isSource) {
          if (amt > 0) inflows += amt;
          else outflows += Math.abs(amt);
        }
      }
    });

    const netMovement = inflows - outflows;
    return {
      inflows,
      outflows,
      transferIn,
      transferOut,
      netMovement,
      txCount: currentMonthTxs.length,
    };
  }, [currentMonthTxs, account, accounts]);

  // Filtered transactions for the History tab
  const filteredHistory = useMemo(() => {
    return accountTransactions.filter((tx) => {
      const matchesSearch =
        searchQuery === '' ||
        (tx.note || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.account_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.toString().includes(searchQuery);

      if (!matchesSearch) return false;

      if (typeFilter === 'income') return tx.type === 'income' || tx.type === 'refund';
      if (typeFilter === 'expense') return tx.type === 'expense';
      if (typeFilter === 'transfer') return tx.type === 'transfer';
      return true;
    });
  }, [accountTransactions, searchQuery, typeFilter]);

  // 6-Month Trend Data for this account
  const monthlyTrendData = useMemo(() => {
    if (!account) return [];
    const months: { monthKey: string; monthLabel: string; inflows: number; outflows: number; net: number; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('ms-MY', { month: 'short', year: 'numeric' });

      let inAmt = 0;
      let outAmt = 0;
      let count = 0;

      accountTransactions.forEach((tx) => {
        if ((tx.date || tx.created_at || '').startsWith(key)) {
          const amt = Number(tx.amount) || 0;
          count++;
          if (tx.type === 'income' || tx.type === 'refund') {
            if (tx.account_id === account.id) inAmt += amt;
          } else if (tx.type === 'expense') {
            if (tx.account_id === account.id) outAmt += amt;
          } else if (tx.type === 'transfer') {
            if (tx.account_id === account.id) outAmt += amt;
            else if (tx.to_account_id === account.id) inAmt += amt;
          }
        }
      });

      months.push({
        monthKey: key,
        monthLabel: label,
        inflows: Math.round(inAmt * 100) / 100,
        outflows: Math.round(outAmt * 100) / 100,
        net: Math.round((inAmt - outAmt) * 100) / 100,
        count,
      });
    }

    return months;
  }, [accountTransactions, account?.id]);

  // If modal is closed or no account is selected, return null AFTER all hooks are called
  if (!isOpen || !account) return null;

  // CSV Statement Export
  const handleExportStatementCSV = () => {
    const headers = ['Tarikh', 'Jenis', 'Kategori', 'Daripada / Kepada', 'Nota', 'Masuk (RM)', 'Keluar (RM)', 'Baki Kesan (RM)'];
    const rows = currentMonthTxs.map((tx) => {
      const isIncoming = tx.type === 'income' || tx.type === 'refund' || (tx.type === 'transfer' && tx.to_account_id === account.id);
      const inVal = isIncoming ? Number(tx.amount).toFixed(2) : '0.00';
      const outVal = !isIncoming ? Number(tx.amount).toFixed(2) : '0.00';
      const counterparty = tx.type === 'transfer' 
        ? (tx.account_id === account.id ? `Ke: ${tx.to_account_name || 'Akaun Lain'}` : `Dari: ${tx.account_name}`) 
        : tx.account_name || account.account_name;

      return [
        `"${tx.date}"`,
        `"${tx.type.toUpperCase()}"`,
        `"${tx.category}"`,
        `"${counterparty}"`,
        `"${(tx.note || '').replace(/"/g, '""')}"`,
        inVal,
        outVal,
        `"${isIncoming ? `+${inVal}` : `-${outVal}`}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Penyata_${account.bank}_${account.account_name.replace(/\s+/g, '_')}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        >
          {/* Header Card with Gradient */}
          <div className={`p-6 bg-gradient-to-r ${visuals.bgGradient} text-white relative overflow-hidden`}>
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner border border-white/20">
                  {account.type === 'gold' ? <Sparkles className="w-6 h-6" /> :
                   account.type === 'investment' ? <Coins className="w-6 h-6" /> :
                   account.type === 'credit_card' ? <CreditCard className="w-6 h-6" /> :
                   account.type === 'paylater' ? <Clock className="w-6 h-6" /> :
                   account.type === 'ewallet' ? <Smartphone className="w-6 h-6" /> :
                   <Landmark className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md border border-white/20">
                      {account.bank}
                    </span>
                    <span className="text-xs font-medium text-white/80">
                      {account.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-0.5 leading-tight tracking-tight">
                    {account.account_name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditAccount(account)}
                  title="Edit Maklumat Akaun"
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/20"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Live Balance & Quick Stats Banner */}
            <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-xs font-medium text-white/80 block">Baki Semasa</span>
                <span className={`text-xl sm:text-2xl font-black ${isNegative ? 'text-rose-200' : 'text-white'}`}>
                  {formatCurrency(account.balance)}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-white/80 block">Aliran Bulan Ini</span>
                <span className={`text-sm sm:text-base font-bold flex items-center gap-1 ${
                  monthStats.netMovement >= 0 ? 'text-emerald-200' : 'text-rose-200'
                }`}>
                  {monthStats.netMovement >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {monthStats.netMovement >= 0 ? `+${formatCurrency(monthStats.netMovement)}` : `-${formatCurrency(Math.abs(monthStats.netMovement))}`}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-white/80 block">Duit Masuk ({selectedMonth.slice(5)})</span>
                <span className="text-sm sm:text-base font-bold text-white">
                  +{formatCurrency(monthStats.inflows)}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-white/80 block">Duit Keluar ({selectedMonth.slice(5)})</span>
                <span className="text-sm sm:text-base font-bold text-white">
                  -{formatCurrency(monthStats.outflows)}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/60 dark:bg-slate-900/60 overflow-x-auto">
            <div className="flex items-center gap-2">
              {[
                { id: 'overview', label: '1. Ringkasan & Butiran' },
                { id: 'history', label: `2. Sejarah Transaksi (${accountTransactions.length})` },
                { id: 'trend', label: '3. Trend Bulanan' },
                { id: 'statement', label: '4. Penyata Ringkas' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white/40 dark:bg-slate-800/40'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Actions in tab bar */}
            <div className="flex items-center gap-2 py-2">
              <button
                onClick={() => {
                  onClose();
                  onQuickTransfer(account);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Pindah Wang</span>
              </button>
            </div>
          </div>

          {/* Modal Tab Content Area */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* TAB 1: OVERVIEW & ACCOUNT DETAILS */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Account Specification Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Maklumat Akaun
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                        <span className="text-slate-500 dark:text-slate-400">Institusi / Bank:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{account.bank}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                        <span className="text-slate-500 dark:text-slate-400">Nama Akaun:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{account.account_name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                        <span className="text-slate-500 dark:text-slate-400">Jenis Akaun:</span>
                        <span className="font-bold text-slate-900 dark:text-white capitalize">{account.type.replace('_', ' ')}</span>
                      </div>
                      {account.account_number && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">No. Akaun:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{account.account_number}</span>
                        </div>
                      )}
                      {account.credit_limit && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Had Kredit / Limit:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(account.credit_limit)}</span>
                        </div>
                      )}
                      {account.type === 'gold' && account.weight_grams && (
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Berat Emas Bersih:</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{account.weight_grams} gram (999.9)</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 dark:text-slate-400">Kemaskini Terakhir:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateMalay(account.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Activity Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Ringkasan Aktiviti Bulan Ini ({selectedMonth})
                    </h3>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-semibold text-emerald-950 dark:text-emerald-300">Duit Masuk</span>
                        </div>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          +{formatCurrency(monthStats.inflows)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="font-semibold text-rose-950 dark:text-rose-300">Duit Keluar</span>
                        </div>
                        <span className="font-black text-rose-700 dark:text-rose-400">
                          -{formatCurrency(monthStats.outflows)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-blue-950 dark:text-blue-300">Pindahan Dana (Transfer)</span>
                        </div>
                        <span className="font-bold text-blue-700 dark:text-blue-400">
                          {monthStats.transferIn > 0 ? `+${formatCurrency(monthStats.transferIn)} / ` : ''}-{formatCurrency(monthStats.transferOut)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 font-bold text-slate-700 dark:text-slate-300">
                        <span>Bilangan Transaksi:</span>
                        <span>{monthStats.txCount} transaksi</span>
                      </div>
                    </div>
                  </div>

                </div>

                {account.notes && (
                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">Nota Akaun:</span>
                    <p className="text-amber-800 dark:text-amber-200/90">{account.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TRANSACTION HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari transaksi akaun ini..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    {[
                      { id: 'all', label: 'Semua' },
                      { id: 'income', label: 'Duit Masuk' },
                      { id: 'expense', label: 'Duit Keluar' },
                      { id: 'transfer', label: 'Pindahan' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setTypeFilter(btn.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          typeFilter === btn.id
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transactions Table / List */}
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Tiada rekod transaksi dijumpai</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tiada transaksi sepadan dengan carian atau penapis ini.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="p-3">Tarikh</th>
                          <th className="p-3">Jenis & Kategori</th>
                          <th className="p-3">Butiran / Nota</th>
                          <th className="p-3 text-right">Amaun (RM)</th>
                          <th className="p-3 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredHistory.map((tx) => {
                          const isIncoming = tx.type === 'income' || tx.type === 'refund' || (tx.type === 'transfer' && tx.to_account_id === account.id);
                          const isTransfer = tx.type === 'transfer';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors">
                              <td className="p-3 font-medium whitespace-nowrap text-slate-600 dark:text-slate-400">
                                {tx.date}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${
                                    isTransfer ? 'bg-blue-500' : isIncoming ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`} />
                                  <span className="font-bold text-slate-900 dark:text-white">{tx.category}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{tx.type}</span>
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                {isTransfer ? (
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                                    {tx.account_id === account.id ? `Pindah ke: ${tx.to_account_name || 'Akaun Penerima'}` : `Pindah dari: ${tx.account_name}`}
                                  </span>
                                ) : (
                                  tx.note || '-'
                                )}
                              </td>
                              <td className="p-3 text-right font-bold whitespace-nowrap">
                                <span className={isIncoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  {isIncoming ? `+RM ${Number(tx.amount).toFixed(2)}` : `-RM ${Number(tx.amount).toFixed(2)}`}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => onEditTransaction(tx)}
                                    title="Edit Transaksi"
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteTransaction(tx.id)}
                                    title="Padam Transaksi"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MONTHLY TRENDS */}
            {activeTab === 'trend' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Trend Aliran Wang 6 Bulan Terakhir ({account.account_name})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perbandingan duit masuk vs duit keluar bagi akaun ini dari bulan ke bulan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {monthlyTrendData.map((m) => (
                    <div
                      key={m.monthKey}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white capitalize">
                          📅 {m.monthLabel}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {m.count} tx
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Duit Masuk:</span>
                          <span className="font-bold">+{formatCurrency(m.inflows)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>Duit Keluar:</span>
                          <span className="font-bold">-{formatCurrency(m.outflows)}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black">
                          <span>Pergerakan Bersih:</span>
                          <span className={m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {m.net >= 0 ? `+${formatCurrency(m.net)}` : `-${formatCurrency(Math.abs(m.net))}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: STATEMENT PREVIEW & EXPORT */}
            {activeTab === 'statement' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Penyata Akaun Rasmi ({account.bank} - {account.account_name})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pilih bulan untuk menjana lembaran penyata dan muat turun salinan CSV / cetak.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      onClick={handleExportStatementCSV}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Eksport CSV</span>
                    </button>
                    <button
                      onClick={handlePrint}
                      className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                      title="Cetak Penyata"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Printable Statement Sheet View */}
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
                  <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">MYWANG ACCOUNT STATEMENT</h4>
                      <p className="text-xs text-slate-500">{account.bank} — {account.account_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">Bulan: {selectedMonth}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Baki Akaun Semasa</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(account.balance)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center py-2 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Jumlah Masuk</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(monthStats.inflows)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Jumlah Keluar</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(monthStats.outflows)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Pergerakan Bersih</span>
                      <span className={`text-sm font-bold ${monthStats.netMovement >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {monthStats.netMovement >= 0 ? `+${formatCurrency(monthStats.netMovement)}` : `-${formatCurrency(Math.abs(monthStats.netMovement))}`}
                      </span>
                    </div>
                  </div>

                  {/* Mini Ledger */}
                  <div className="text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                      Senarai Transaksi ({currentMonthTxs.length}):
                    </span>
                    {currentMonthTxs.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">Tiada transaksi pada bulan {selectedMonth}.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {currentMonthTxs.map((tx) => (
                          <div key={tx.id} className="flex justify-between items-center py-1.5 px-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-850 text-xs">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white mr-2">{tx.date}</span>
                              <span className="text-slate-600 dark:text-slate-300">{tx.category}</span>
                              {tx.note && <span className="text-slate-400 text-[11px] ml-1.5 italic">— {tx.note}</span>}
                            </div>
                            <span className={`font-bold ${
                              tx.type === 'income' || tx.type === 'refund' || (tx.type === 'transfer' && tx.to_account_id === account.id)
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {tx.type === 'income' || tx.type === 'refund' || (tx.type === 'transfer' && tx.to_account_id === account.id)
                                ? `+RM ${Number(tx.amount).toFixed(2)}`
                                : `-RM ${Number(tx.amount).toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              ID Akaun: <code className="font-mono text-slate-500">{account.id}</code>
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
