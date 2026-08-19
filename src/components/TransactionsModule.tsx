import React, { useState, useMemo } from 'react';
import { Transaction, Account, SummaryStats } from '../types';
import { formatCurrency, formatDateMalay } from '../utils/formatters';
import { isTransactionForAccount } from '../utils/accountMatcher';
import { exportTransactionsToExcel } from '../utils/excelExporter';
import { exportTransactionsToPDF } from '../utils/pdfExporter';
import { 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Trash2, 
  Pencil,
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Scale, 
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { motion } from 'motion/react';
import { ReceiptViewerModal } from './ReceiptViewerModal';

interface TransactionsModuleProps {
  transactions: Transaction[];
  accounts: Account[];
  stats: SummaryStats;
  onAddTransaction: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
}

export const TransactionsModule: React.FC<TransactionsModuleProps> = ({
  transactions,
  accounts,
  stats,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // e.g. '2026-08'
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingReceiptTx, setViewingReceiptTx] = useState<Transaction | null>(null);
  const itemsPerPage = 10;

  // Filter logic
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        const matchCat = (tx.category || '').toLowerCase().includes(q);
        const matchAcc = (tx.account_name || '').toLowerCase().includes(q);
        const matchToAcc = (tx.to_account_name || '').toLowerCase().includes(q);
        if (!matchNote && !matchCat && !matchAcc && !matchToAcc) return false;
      }

      // Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // Account filter
      if (selectedAccountId !== 'all') {
        const targetAcc = accounts.find((a) => a.id === selectedAccountId);
        if (targetAcc) {
          if (!isTransactionForAccount(tx, targetAcc, accounts)) return false;
        } else if (tx.account_id !== selectedAccountId && tx.to_account_id !== selectedAccountId) {
          return false;
        }
      }

      // Month filter
      if (selectedMonth && !tx.date.startsWith(selectedMonth)) {
        return false;
      }

      return true;
    });
  }, [transactions, searchTerm, selectedType, selectedAccountId, selectedMonth, accounts]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedTransactions = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'income':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ArrowDownLeft className="w-3 h-3" />
            Duit Masuk
          </span>
        );
      case 'expense':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <ArrowUpRight className="w-3 h-3" />
            Duit Keluar
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <ArrowLeftRight className="w-3 h-3" />
            Transfer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Scale className="w-3 h-3" />
            Pelarasan
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Lejar Transaksi ({filtered.length} daripada {transactions.length})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rekod pergerakan duit masuk, duit keluar & pemindahan akaun secara menyeluruh.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportTransactionsToExcel(filtered)}
              title="Muat turun fail Excel (.xlsx)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Eksport Excel</span>
            </button>

            <button
              onClick={() => exportTransactionsToPDF(filtered, stats)}
              title="Muat turun Laporan PDF"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Laporan PDF</span>
            </button>

            <button
              onClick={onAddTransaction}
              id="btn_add_transaction_tab"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Rekod Transaksi</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          
          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="input_search_transactions"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari transaksi / kedai / nota..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Jenis Transaksi</option>
              <option value="income">Duit Masuk (Income)</option>
              <option value="expense">Duit Keluar (Expense)</option>
              <option value="transfer">Pindahan Dana (Transfer)</option>
              <option value="adjustment">Pelarasan (Adjustment)</option>
            </select>
          </div>

          {/* Filter Account */}
          <div>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Akaun Bank & Dompet</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bank} - {a.account_name}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

        </div>

      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Tarikh</th>
                <th className="py-3.5 px-4">Akaun</th>
                <th className="py-3.5 px-4">Jenis</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Nota / Butiran</th>
                <th className="py-3.5 px-4 text-right">Jumlah</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">Tiada rekod transaksi dijumpai</p>
                    <p className="text-xs mt-1">Cuba tukar carian atau tambah transaksi baru.</p>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isExpense = tx.type === 'expense';
                  const isTransfer = tx.type === 'transfer';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div>
                          <span>{tx.account_name || tx.account_id}</span>
                          {isTransfer && tx.to_account_name && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                              <span>➔ ke {tx.to_account_name}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getTypeBadge(tx.type)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {tx.note || '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-black ${
                          isIncome 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : isExpense 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(tx.amount)}
                        </span>
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
                            title="Kemaskini Transaksi (Pencil)"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Padam transaksi ini (${formatCurrency(tx.amount)})?`)) {
                                await onDeleteTransaction(tx.id);
                              }
                            }}
                            title="Padam Transaksi (Tong Sampah)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Menunjukkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} daripada {filtered.length} rekod
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-2 text-slate-800 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
