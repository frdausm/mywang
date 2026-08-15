import React, { useState, useEffect } from 'react';
import { LoanFinancing, Account } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils/formatters';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Pencil, 
  Trash2, 
  Plus, 
  Car, 
  Landmark, 
  Calendar, 
  Percent, 
  CheckCircle2, 
  X, 
  KeyRound, 
  DollarSign,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SecretLoansModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onRecordPayment?: (loan: LoanFinancing, fromAccountId: string) => void;
}

export const SecretLoansModal: React.FC<SecretLoansModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onRecordPayment,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  const [loans, setLoans] = useState<LoanFinancing[]>([]);
  const [editingLoan, setEditingLoan] = useState<LoanFinancing | null>(null);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);

  // New/Edit Loan Form State
  const [formData, setFormData] = useState<Partial<LoanFinancing>>({
    name: '',
    provider: 'BSN',
    type: 'personal_loan',
    remaining_balance: 0,
    monthly_installment: 0,
    remaining_tenure_months: 12,
    total_paid: 0,
    profit_rate: 4.0,
    account_number_or_vehicle: '',
    notes: '',
  });

  // Change Passcode Form State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passChangeSuccess, setPassChangeSuccess] = useState('');

  // Payment Recording State
  const [payingLoan, setPayingLoan] = useState<LoanFinancing | null>(null);
  const [selectedPayAccount, setSelectedPayAccount] = useState<string>(accounts[0]?.id || '');

  useEffect(() => {
    if (isOpen) {
      const storedLoans = StorageService.getLoans();
      setLoans(storedLoans);
      setErrorMsg('');
      setPasscode('');
    } else {
      // Auto-lock when closed
      setIsUnlocked(false);
      setEditingLoan(null);
      setIsAddLoanOpen(false);
      setPayingLoan(null);
    }
  }, [isOpen]);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPass = StorageService.getSecretPasscode();
    
    // Accept either configured passcode OR default "7445" / "1234"
    if (passcode.trim() === correctPass || passcode.trim() === '7445' || passcode.trim() === '1234') {
      setIsUnlocked(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Passcode salah. Sila semak passcode rahsia anda di backend Google Sheets.');
    }
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.provider) {
      alert('Sila lengkapkan nama pinjaman dan penyedia.');
      return;
    }

    let updatedLoans: LoanFinancing[];
    const nowIso = new Date().toISOString().split('T')[0];

    if (editingLoan) {
      updatedLoans = loans.map((l) =>
        l.id === editingLoan.id
          ? {
              ...l,
              ...formData,
              remaining_balance: Number(formData.remaining_balance) || 0,
              monthly_installment: Number(formData.monthly_installment) || 0,
              remaining_tenure_months: Number(formData.remaining_tenure_months) || 0,
              total_paid: Number(formData.total_paid) || 0,
              profit_rate: Number(formData.profit_rate) || 0,
              updated_at: nowIso,
            } as LoanFinancing
          : l
      );
    } else {
      const newLoanItem: LoanFinancing = {
        id: `loan_${Date.now()}`,
        name: formData.name || 'Pinjaman Baru',
        provider: formData.provider || 'Bank',
        type: formData.type || 'personal_loan',
        remaining_balance: Number(formData.remaining_balance) || 0,
        monthly_installment: Number(formData.monthly_installment) || 0,
        remaining_tenure_months: Number(formData.remaining_tenure_months) || 0,
        total_paid: Number(formData.total_paid) || 0,
        profit_rate: Number(formData.profit_rate) || 0,
        account_number_or_vehicle: formData.account_number_or_vehicle || '',
        notes: formData.notes || '',
        created_at: nowIso,
        updated_at: nowIso,
      };
      updatedLoans = [...loans, newLoanItem];
    }

    setLoans(updatedLoans);
    StorageService.saveLoans(updatedLoans);
    StorageService.addLog('SAVE_LOAN', `Kemaskini pinjaman rahsia: ${formData.name}`);
    
    // Sync to GAS
    StorageService.syncWithGAS('saveLoans', updatedLoans).catch(console.error);

    setEditingLoan(null);
    setIsAddLoanOpen(false);
  };

  const handleDeleteLoan = (loanId: string) => {
    if (!window.confirm('Adakah anda pasti ingin memadamkan rekod pinjaman ini?')) return;
    const filtered = loans.filter((l) => l.id !== loanId);
    setLoans(filtered);
    StorageService.saveLoans(filtered);
    StorageService.addLog('DELETE_LOAN', `Pinjaman rahsia dipadam: ${loanId}`);
    StorageService.syncWithGAS('saveLoans', filtered).catch(console.error);
    setEditingLoan(null);
  };

  const handleOpenEdit = (loan: LoanFinancing) => {
    setEditingLoan(loan);
    setFormData({
      name: loan.name,
      provider: loan.provider,
      type: loan.type,
      remaining_balance: loan.remaining_balance,
      monthly_installment: loan.monthly_installment,
      remaining_tenure_months: loan.remaining_tenure_months,
      total_paid: loan.total_paid || 0,
      profit_rate: loan.profit_rate || 0,
      account_number_or_vehicle: loan.account_number_or_vehicle || '',
      notes: loan.notes || '',
    });
    setIsAddLoanOpen(true);
  };

  const handleOpenNew = () => {
    setEditingLoan(null);
    setFormData({
      name: '',
      provider: 'BSN',
      type: 'personal_loan',
      remaining_balance: 0,
      monthly_installment: 0,
      remaining_tenure_months: 12,
      total_paid: 0,
      profit_rate: 4.0,
      account_number_or_vehicle: '',
      notes: '',
    });
    setIsAddLoanOpen(true);
  };

  const handleChangePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPass = StorageService.getSecretPasscode();
    if (oldPass !== currentPass && oldPass !== '7445' && oldPass !== '1234') {
      alert('Passcode lama tidak tepat.');
      return;
    }
    if (newPass.length < 4) {
      alert('Passcode baru mestilah sekurang-kurangnya 4 angka/aksara.');
      return;
    }
    if (newPass !== confirmNewPass) {
      alert('Pengesahan passcode baru tidak sepadan.');
      return;
    }

    StorageService.saveSecretPasscode(newPass);
    StorageService.addLog('CHANGE_SECRET_PASS', 'Passcode rahsia peti pembiayaan telah ditukar.');
    setPassChangeSuccess('Passcode rahsia berjaya dikemaskini!');
    setOldPass('');
    setNewPass('');
    setConfirmNewPass('');
    setTimeout(() => {
      setPassChangeSuccess('');
      setIsChangePassOpen(false);
    }, 1500);
  };

  // Calculations
  const totalOutstanding = loans.reduce((acc, l) => acc + (l.remaining_balance || 0), 0);
  const totalMonthlyCommitment = loans.reduce((acc, l) => acc + (l.monthly_installment || 0), 0);
  const totalAlreadyPaid = loans.reduce((acc, l) => acc + (l.total_paid || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
      >
        {/* Header Strip */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
              {isUnlocked ? <Unlock className="w-6 h-6 text-emerald-400" /> : <Lock className="w-6 h-6 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Secret Vault: Pembiayaan & Liabiliti
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                  Rahsia
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pengurusan pinjaman kenderaan, pinjaman peribadi & komitmen bulanan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={() => setIsUnlocked(false)}
                title="Kunci Semula Vault"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Kunci</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isUnlocked ? (
            /* Passcode Screen */
            <div className="max-w-md mx-auto py-10 text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
                <KeyRound className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Masukkan Passcode Rahsia</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
                  Bahagian ini mengandungi maklumat sulit pinjaman dan hutang. Sila masukkan PIN / Passcode anda.
                </p>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4 max-w-xs mx-auto">
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Masukkan Passcode (cth: 7445)"
                    maxLength={10}
                    autoFocus
                    className="w-full text-center text-2xl tracking-widest font-black px-4 py-3.5 bg-slate-950 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl text-white outline-hidden shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Buka Peti Rahsia</span>
                </button>

                <p className="text-[11px] text-slate-400">
                  Tip Lalai: Passcode rahsia boleh ditetapkan mengikut nombor plat <span className="text-indigo-300 font-mono font-bold">7445</span> atau diubah di dalam sistem.
                </p>
              </form>
            </div>
          ) : (
            /* Unlocked Secret Loans Dashboard */
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Baki Hutang Keseluruhan</span>
                    <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400">
                      <Landmark className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-rose-400">
                      {formatCurrency(totalOutstanding)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jumlah baki pokok pembiayaan aktif
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Komitmen Ansuran Bulanan</span>
                    <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-amber-400">
                      {formatCurrency(totalMonthlyCommitment)} <span className="text-xs font-normal text-slate-400">/bln</span>
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Perlu dibayar setiap bulan
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Jumlah Sudah Dibayar</span>
                    <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-emerald-400">
                      {formatCurrency(totalAlreadyPaid)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prinsipal ansuran terlunas setakat ini
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Senarai Pinjaman & Pembiayaan Aktif ({loans.length})</span>
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsChangePassOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Tukar Passcode</span>
                  </button>

                  <button
                    onClick={handleOpenNew}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Pinjaman</span>
                  </button>
                </div>
              </div>

              {/* Loans List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loans.map((loan) => {
                  const isCar = loan.type === 'hire_purchase';
                  const totalInitial = (loan.total_paid || 0) + loan.remaining_balance;
                  const percentPaid = totalInitial > 0 ? Math.round(((loan.total_paid || 0) / totalInitial) * 100) : 0;

                  return (
                    <div
                      key={loan.id}
                      className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
                    >
                      <div>
                        {/* Top Provider & Vehicle/Type */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                              {loan.provider}
                            </span>
                            {isCar && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold font-mono">
                                <Car className="w-3.5 h-3.5" />
                                {loan.account_number_or_vehicle || 'Kenderaan'}
                              </span>
                            )}
                          </div>

                          {/* Pencil Edit Button */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(loan)}
                              title="Kemaskini Pinjaman (Pencil)"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLoan(loan.id)}
                              title="Padam Pinjaman"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Loan Name */}
                        <h4 className="text-base font-bold text-white mb-1">
                          {loan.name}
                        </h4>

                        {loan.notes && (
                          <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                            {loan.notes}
                          </p>
                        )}

                        {/* Key Loan Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs mb-3">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Ansuran Bulanan</span>
                            <span className="font-bold text-amber-300 text-sm">
                              {formatCurrency(loan.monthly_installment)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Baki Tempoh</span>
                            <span className="font-bold text-slate-200">
                              {loan.remaining_tenure_months} Bulan
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Kadar Keuntungan</span>
                            <span className="font-bold text-indigo-300">
                              {loan.profit_rate}% p.a.
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Sudah Dibayar</span>
                            <span className="font-bold text-emerald-400">
                              {formatCurrency(loan.total_paid || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar (Paid vs Remaining) */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-medium">Kemajuan Bayaran</span>
                            <span className="text-emerald-400 font-bold font-mono">
                              {percentPaid}% Selesai
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/60 p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                              style={{ width: `${Math.min(Math.max(percentPaid, 0), 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>Sudah: {formatCurrency(loan.total_paid || 0)}</span>
                            <span>Jumlah Nilai: {formatCurrency(totalInitial)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Remaining Balance & Action */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Baki Hutang Semasa</span>
                          <span className="text-lg font-black text-rose-400">
                            {formatCurrency(loan.remaining_balance)}
                          </span>
                        </div>

                        {onRecordPayment && (
                          <button
                            onClick={() => {
                              setPayingLoan(loan);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 border border-slate-700 hover:border-emerald-500"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Bayar Ansuran</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Change Passcode Modal Popup */}
        <AnimatePresence>
          {isChangePassOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-indigo-400" />
                    <span>Tukar Passcode Rahsia</span>
                  </h3>
                  <button onClick={() => setIsChangePassOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleChangePasscode} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Passcode Lama</label>
                    <input
                      type="password"
                      value={oldPass}
                      onChange={(e) => setOldPass(e.target.value)}
                      placeholder="Passcode semasa (cth: 7445)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Passcode Baru</label>
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Passcode baru (min. 4 angka)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Sahkan Passcode Baru</label>
                    <input
                      type="password"
                      value={confirmNewPass}
                      onChange={(e) => setConfirmNewPass(e.target.value)}
                      placeholder="Ulang passcode baru"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>

                  {passChangeSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{passChangeSuccess}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsChangePassOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Passcode
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add/Edit Loan Form Modal */}
        <AnimatePresence>
          {isAddLoanOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-2xl space-y-4 my-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-indigo-400" />
                    <span>{editingLoan ? 'Kemaskini Maklumat Pinjaman' : 'Tambah Pinjaman Baru'}</span>
                  </h3>
                  <button onClick={() => setIsAddLoanOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveLoan} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Pinjaman / Tajuk</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="cth: BSN Personal Loan atau Hire Purchase Proton Saga"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Institusi / Bank</label>
                      <input
                        type="text"
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        placeholder="cth: BSN, Maybank, CIMB"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Jenis Pinjaman</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500"
                      >
                        <option value="personal_loan">Personal Loan</option>
                        <option value="hire_purchase">Hire Purchase (Kereta)</option>
                        <option value="housing_loan">Housing Loan (Rumah)</option>
                        <option value="education">Pendidikan / PTPTN</option>
                        <option value="other">Lain-lain</option>
                      </select>
                    </div>
                  </div>

                  {formData.type === 'hire_purchase' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">No. Kenderaan / Model</label>
                      <input
                        type="text"
                        value={formData.account_number_or_vehicle}
                        onChange={(e) => setFormData({ ...formData, account_number_or_vehicle: e.target.value })}
                        placeholder="cth: Proton Saga CFA 7445"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Baki Hutang Semasa (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.remaining_balance}
                        onChange={(e) => setFormData({ ...formData, remaining_balance: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500 font-mono font-bold text-rose-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Ansuran Bulanan (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.monthly_installment}
                        onChange={(e) => setFormData({ ...formData, monthly_installment: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-indigo-500 font-mono font-bold text-amber-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Baki (Bulan)</label>
                      <input
                        type="number"
                        value={formData.remaining_tenure_months}
                        onChange={(e) => setFormData({ ...formData, remaining_tenure_months: parseInt(e.target.value) || 0 })}
                        placeholder="83"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Kadar Faedah (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.profit_rate}
                        onChange={(e) => setFormData({ ...formData, profit_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="4.75"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Sudah Bayar (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.total_paid}
                        onChange={(e) => setFormData({ ...formData, total_paid: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Nota Tambahan</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      placeholder="Catatan tambahan mengenai pinjaman ini..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                    {editingLoan ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteLoan(editingLoan.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold border border-rose-800 cursor-pointer"
                      >
                        Padam
                      </button>
                    ) : <div />}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddLoanOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
                      >
                        Simpan Pinjaman
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Quick Payment Popup */}
        <AnimatePresence>
          {payingLoan && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>Rekod Ansuran: {payingLoan.name}</span>
                  </h3>
                  <button onClick={() => setPayingLoan(null)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Jumlah Ansuran:</span>
                    <span className="font-bold text-amber-400">{formatCurrency(payingLoan.monthly_installment)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Baki Hutang Sebelum:</span>
                    <span className="font-bold text-rose-400">{formatCurrency(payingLoan.remaining_balance)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Bayar Menggunakan Akaun Sumber:
                  </label>
                  <select
                    value={selectedPayAccount}
                    onChange={(e) => setSelectedPayAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-hidden focus:border-emerald-500"
                  >
                    {accounts.filter(a => a.type === 'bank' || a.type === 'ewallet' || a.type === 'cash').map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank} - {acc.account_name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setPayingLoan(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onRecordPayment) {
                        onRecordPayment(payingLoan, selectedPayAccount);
                        // Update loan balances
                        const newBal = Math.max(0, payingLoan.remaining_balance - payingLoan.monthly_installment);
                        const newMonths = Math.max(0, payingLoan.remaining_tenure_months - 1);
                        const newPaid = (payingLoan.total_paid || 0) + payingLoan.monthly_installment;
                        const updated = loans.map(l => l.id === payingLoan.id ? {
                          ...l,
                          remaining_balance: newBal,
                          remaining_tenure_months: newMonths,
                          total_paid: newPaid,
                          updated_at: new Date().toISOString().split('T')[0]
                        } : l);
                        setLoans(updated);
                        StorageService.saveLoans(updated);
                        StorageService.syncWithGAS('saveLoans', updated).catch(console.error);
                      }
                      setPayingLoan(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    Sahkan Bayaran Ansuran
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
