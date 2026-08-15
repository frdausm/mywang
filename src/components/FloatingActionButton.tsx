import React, { useState } from 'react';
import { Plus, ArrowLeftRight, Scan, Landmark, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingActionButtonProps {
  onAddTransaction: () => void;
  onOpenReceiptScanner: () => void;
  onOpenTransferModal: () => void;
  onOpenAddAccountModal: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onAddTransaction,
  onOpenReceiptScanner,
  onOpenTransferModal,
  onOpenAddAccountModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            className="flex flex-col items-end gap-2"
          >
            {/* 1. Imbas Resit AI */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenReceiptScanner();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <span>Imbas Resit AI</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                <Scan className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 2. Pindah Wang (Transfer) */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenTransferModal();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <span>Pindah Wang</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 3. Tambah Transaksi */}
            <button
              onClick={() => {
                setIsOpen(false);
                onAddTransaction();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <span>Rekod Transaksi</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 4. Tambah Akaun Baru */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAddAccountModal();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <span>Tambah Akaun</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Trigger FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        id="btn_main_fab"
        title="Tindakan Pantas"
        className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white flex items-center justify-center shadow-xl shadow-emerald-600/35 ring-4 ring-emerald-500/20 transition-all cursor-pointer"
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </motion.div>
      </motion.button>
    </div>
  );
};
