import React, { useState, useRef, useEffect } from 'react';
import { Account, CategoryItem, ReceiptScanResult, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { 
  X, 
  UploadCloud, 
  Camera, 
  Sparkles, 
  Check, 
  Store, 
  Calendar, 
  Tag, 
  CreditCard, 
  FileText, 
  Receipt, 
  AlertCircle,
  ShoppingBag,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  initialMode?: 'expense' | 'income';
  accounts: Account[];
  expenseCategories: CategoryItem[];
  incomeCategories: CategoryItem[];
  onClose: () => void;
  onSaveScannedTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  initialMode = 'expense',
  accounts,
  expenseCategories,
  incomeCategories,
  onClose,
  onSaveScannedTransaction,
}) => {
  const [scanType, setScanType] = useState<'expense' | 'income'>(initialMode);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Extracted Fields for Review
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ name: string; qty?: number; price?: number }[]>([]);
  const [scanSource, setScanSource] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScanType(initialMode);
      setCategory(initialMode === 'income' ? (incomeCategories[0]?.name || 'Gaji') : (expenseCategories[0]?.name || 'Makanan & Minuman'));
      setImagePreview(null);
      setMerchant('');
      setAmount('');
      setNote('');
      setItems([]);
      setError(null);
      if (accounts.length > 0) setAccountId(accounts[0].id);
    }
  }, [isOpen, initialMode]);

  // When scanType changes, adjust default category
  const handleTypeChange = (newType: 'expense' | 'income') => {
    setScanType(newType);
    if (newType === 'income') {
      setCategory(incomeCategories[0]?.name || 'Gaji');
    } else {
      setCategory(expenseCategories[0]?.name || 'Makanan & Minuman');
    }
  };

  if (!isOpen) return null;

  const currentCategories = scanType === 'income' ? incomeCategories : expenseCategories;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;

      // Smart compression for ultra-large camera photos
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(compressedBase64);
            triggerAIExtraction(compressedBase64, 'image/jpeg');
            return;
          }
        }

        setImagePreview(rawBase64);
        triggerAIExtraction(rawBase64, file.type || 'image/jpeg');
      };
      img.onerror = () => {
        setImagePreview(rawBase64);
        triggerAIExtraction(rawBase64, file.type || 'image/jpeg');
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  const triggerAIExtraction = async (base64Data: string, mimeType: string) => {
    setIsScanning(true);
    setError(null);

    try {
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType,
          mode: scanType
        }),
      });

      const json = await res.json();
      if (json && json.status === 'success' && json.data) {
        const d: ReceiptScanResult = json.data;
        setMerchant(d.merchant || (scanType === 'income' ? 'Pembayar / Sumber Dana' : 'Kedai / Merchant'));
        setAmount(d.amount ? d.amount.toString() : '0.00');
        if (d.date) setDate(d.date);
        
        if (d.category) {
          const list = scanType === 'income' ? incomeCategories : expenseCategories;
          const found = list.find(c => c.name.toLowerCase().includes(d.category.toLowerCase()) || d.category.toLowerCase().includes(c.name.toLowerCase()));
          setCategory(found ? found.name : d.category);
        }
        if (d.items) setItems(d.items);
        setNote(d.note || (scanType === 'income' ? `Terima: ${d.merchant || 'Pendapatan'}` : `Resit: ${d.merchant || 'Perbelanjaan'}`));
        setScanSource(json.source === 'gemini_ai' ? 'Gemini 3.7 Flash AI' : 'Smart Heuristics');

        // Auto-match suggested account
        if (d.suggestedAccount && accounts.length > 0) {
          const matchAcc = accounts.find(a => 
            a.bank.toLowerCase().includes(d.suggestedAccount!.toLowerCase()) || 
            a.account_name.toLowerCase().includes(d.suggestedAccount!.toLowerCase())
          );
          if (matchAcc) setAccountId(matchAcc.id);
        }
      } else {
        setError(json.message || 'Gagal mengekstrak teks daripada imej.');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError('Ralat sambungan semasa memproses imej resit: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Sila pastikan jumlah bayaran sah.');
      return;
    }

    setIsSubmitting(true);
    const selectedAcc = accounts.find(a => a.id === accountId);

    await onSaveScannedTransaction({
      date,
      account_id: accountId,
      account_name: selectedAcc ? `${selectedAcc.bank} - ${selectedAcc.account_name}` : undefined,
      type: scanType,
      category: category || (scanType === 'income' ? 'Gaji' : 'Makanan & Minuman'),
      amount: numAmount,
      note: note.trim() || (scanType === 'income' ? `Masuk: ${merchant}` : `Resit: ${merchant}`),
      receipt_url: imagePreview || undefined,
      receipt_data: {
        merchant,
        amount: numAmount,
        date,
        category,
        items,
        note,
      },
    });

    setIsSubmitting(false);
    onClose();
  };

  const isIncome = scanType === 'income';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isIncome 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-600/30' 
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-600/30'
              }`}>
                {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isIncome ? 'Pengecaman AI Slip Pendapatan / Duit Masuk' : 'Pengimbas Resit AI Perbelanjaan'}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    Gemini AI Vision
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isIncome 
                    ? 'Imbas slip gaji, slip bayaran masuk DuitNow, penyata ASB atau invois jualan secara automatik.' 
                    : 'Muat naik resit pasaraya, bil utiliti, tol, atau invois untuk mengekstrak jumlah & kategori.'}
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

          {/* Mode Switcher Tabs */}
          <div className="px-6 pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isIncome
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Resit Perbelanjaan (Duit Keluar)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isIncome
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Slip Pendapatan (Duit Masuk)</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Upload Area / Preview Area */}
            {!imagePreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 dark:border-purple-800/80 hover:border-purple-500 dark:hover:border-purple-500 rounded-2xl p-8 bg-purple-50/30 dark:bg-purple-950/15 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-purple-50/60"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-3 shadow-inner">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {isIncome ? 'Muat Naik Slip Gaji / Resit Bayaran Masuk' : 'Klik atau Tarik & Lepas Gambar Resit Di Sini'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  {isIncome 
                    ? 'Menyokong gambar slip gaji, resit pemindahan DuitNow, penyata dividen, atau invois jualan.'
                    : 'Menyokong format JPG, PNG, resit pasaraya, stesen minyak, Grab, DuitNow QR, atau invois.'}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs">
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto / Muat Naik Fail</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                
                {/* Image Preview Card */}
                <div className="md:col-span-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 relative group">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full h-56 object-cover rounded-xl"
                  />
                  <div className="mt-2.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Tukar Gambar</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    {scanSource && (
                      <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {scanSource}
                      </span>
                    )}
                  </div>

                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white p-4">
                      <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs font-bold flex items-center gap-1.5 text-purple-300">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        AI Sedang Membaca {isIncome ? 'Slip Masuk' : 'Resit'}...
                      </p>
                      <p className="text-[10px] text-slate-300 text-center mt-1">
                        Mengekstrak nama {isIncome ? 'pembayar' : 'kedai'}, jumlah RM, tarikh & kategori
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Fields Extracted */}
                <div className="md:col-span-7 space-y-3.5">
                  
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Merchant / Payer */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isIncome ? 'Nama Pembayar / Majikan / Sumber' : 'Nama Kedai / Merchant'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Store className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        required
                        placeholder={isIncome ? 'cth: Majikan Sdn Bhd / Klien' : "cth: Lotus's / Petronas / KFC"}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Amount & Date Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Jumlah (RM)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                          RM
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          placeholder="0.00"
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tarikh Transaksi
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Category & Payment Account */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isIncome ? 'Jenis Pendapatan' : 'Kategori Perbelanjaan'}
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        {currentCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isIncome ? 'Masuk ke Akaun' : 'Tolak Dari Akaun'}
                      </label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.bank} - {a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Catatan Transaksi
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={isIncome ? 'cth: Bayaran invois projek Ogos' : 'cth: Makan tengahari bersama rakan'}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Items List if extracted */}
                  {items.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 max-h-24 overflow-y-auto text-[11px]">
                      <span className="font-semibold text-purple-900 dark:text-purple-300 block mb-1">
                        Butiran Dikesan ({items.length}):
                      </span>
                      <ul className="space-y-0.5 text-slate-600 dark:text-slate-300">
                        {items.map((it, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>• {it.name} {it.qty ? `(x${it.qty})` : ''}</span>
                            {it.price !== undefined && <span className="font-medium">RM {it.price.toFixed(2)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Data akan direkod terus ke lejar Google Sheets.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!imagePreview || isScanning || isSubmitting}
                  onClick={handleSubmit}
                  id="btn_save_scanned_receipt"
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                    isIncome
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Masuk ke Transaksi & Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

