import React from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { X, Receipt, Calendar, CreditCard, Tag, FileText, Download, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  if (!isOpen || !transaction) return null;

  const isIncome = transaction.type === 'income';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                <Receipt className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bukti Resit & Ekstrak AI
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {transaction.category} • {transaction.date}
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

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5">
            
            {/* Image Preview & Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* Receipt Image Display */}
              <div className="md:col-span-6 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-2 relative group min-h-[220px]">
                {transaction.receipt_url ? (
                  <img
                    src={transaction.receipt_url}
                    alt="Gambar Resit Transaksi"
                    className="w-full max-h-72 object-contain rounded-xl"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Tiada imej visual disertakan.</p>
                  </div>
                )}

                {transaction.receipt_url && (
                  <a
                    href={transaction.receipt_url}
                    download={`resit_${transaction.id}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg backdrop-blur-sm border border-slate-700 flex items-center gap-1.5 shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Muat Turun</span>
                  </a>
                )}
              </div>

              {/* Extracted Details */}
              <div className="md:col-span-6 space-y-3.5 text-xs">
                <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1">
                    Jumlah Transaksi
                  </span>
                  <p className={`text-2xl font-black ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </p>
                </div>

                <div className="space-y-2 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Tarikh:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-auto">{transaction.date}</span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Kategori:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-auto">{transaction.category}</span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Akaun:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-auto">{transaction.account_name || transaction.account_id}</span>
                  </div>

                  {transaction.note && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Catatan / Butiran:</span>
                      </div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 italic pl-5">
                        "{transaction.note}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Items detected */}
                {transaction.receipt_data?.items && transaction.receipt_data.items.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Pecahan Barangan Dikesan ({transaction.receipt_data.items.length}):
                    </span>
                    <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {transaction.receipt_data.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                          <span>{item.name} {item.qty ? `(x${item.qty})` : ''}</span>
                          {item.price !== undefined && (
                            <span className="font-medium text-slate-900 dark:text-slate-200">
                              RM {item.price.toFixed(2)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Resit ini telah disahkan & disimpan kekal di lejar pangkalan data backend.</span>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
