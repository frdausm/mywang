import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Info, Sparkles, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/formatters';
import { SummaryStats } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SummaryStats;
  onOpenReceiptScanner: () => void;
  onOpenSyncModal: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  stats,
  onOpenReceiptScanner,
  onOpenSyncModal,
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif_1',
      title: 'Peringatan Bil Kad Kredit & PayLater',
      message: `Jumlah hutang semasa adalah ${formatCurrency(stats.creditUsed)}. Pastikan bayaran dibuat sebelum tarikh matang penyata.`,
      icon: CreditCard,
      type: 'warning',
      time: 'Hari ini',
    },
    {
      id: 'notif_2',
      title: 'Pengimbas Resit AI Sedia Digunakan',
      message: 'Ambil gambar resit minyak atau pasaraya anda untuk auto-kategori dalam lejar perbelanjaan.',
      icon: Sparkles,
      type: 'info',
      time: 'Baru',
      action: onOpenReceiptScanner,
      actionLabel: 'Imbas Sekarang',
    },
    {
      id: 'notif_3',
      title: 'Penyegerakan Google Sheets',
      message: 'Pastikan URL Web App Google Sheets anda telah disambungkan untuk simpanan kekal.',
      icon: CheckCircle2,
      type: 'success',
      time: 'Sistem',
      action: onOpenSyncModal,
      actionLabel: 'Semak Status',
    },
  ];

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
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pemberitahuan & Peringatan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notis kewangan dan kemas kini pintar MyWang.
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

          {/* List */}
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      n.type === 'warning'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 border border-amber-300'
                        : n.type === 'info'
                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-600 border border-purple-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 border border-emerald-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>

                  {n.action && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          onClose();
                          n.action!();
                        }}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {n.actionLabel} &rarr;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
