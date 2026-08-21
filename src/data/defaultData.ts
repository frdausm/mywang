import { Account, Transaction, CategoryItem, User, LoanFinancing, AuditLog } from '../types';

export const DEFAULT_USER: User = {
  id: 'usr_admin',
  username: 'admin',
  name: 'Pentadbir (Admin)',
  role: 'admin',
  created_at: new Date().toISOString()
};

export const INITIAL_ACCOUNTS: Account[] = [
  // 1. Maybank
  {
    id: 'acc_mb_sav',
    bank: 'Maybank',
    account_name: 'Savings Account',
    type: 'bank',
    balance: 0.00,
    color: 'from-amber-500 to-yellow-600',
    icon: 'Landmark',
    notes: 'Akaun Simpanan Maybank',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_mb_mae',
    bank: 'Maybank',
    account_name: 'MAE',
    type: 'ewallet',
    balance: 0.00,
    color: 'from-amber-400 to-yellow-500',
    icon: 'Smartphone',
    notes: 'MAE Digital Wallet & QR Pay',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_mb_cc',
    bank: 'Maybank',
    account_name: 'Credit Card Ikhwan Islamic',
    type: 'credit_card',
    balance: 0.00,
    credit_limit: 6000.00,
    color: 'from-amber-600 to-yellow-800',
    icon: 'CreditCard',
    notes: 'Maybank Islamic Ikhwan Card',
    updated_at: '2026-08-16',
  },

  // 2. RHB Bank
  {
    id: 'acc_rhb_sav',
    bank: 'RHB Bank',
    account_name: 'Savings Account',
    type: 'bank',
    balance: 0.00,
    color: 'from-blue-600 to-cyan-700',
    icon: 'Landmark',
    notes: 'RHB Simpanan',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_rhb_cc',
    bank: 'RHB Bank',
    account_name: 'RHB Credit Card Islamic Cashback',
    type: 'credit_card',
    balance: 0.00,
    credit_limit: 5000.00,
    color: 'from-blue-700 to-indigo-900',
    icon: 'CreditCard',
    notes: 'Cashback petrol, groceries & dining',
    updated_at: '2026-08-16',
  },

  // 3. CIMB
  {
    id: 'acc_cimb_cc',
    bank: 'CIMB',
    account_name: 'CIMB Petronas Visa Islamic Credit Card',
    type: 'credit_card',
    balance: 0.00,
    credit_limit: 12000.00,
    color: 'from-red-600 to-rose-800',
    icon: 'CreditCard',
    notes: 'Rebat minyak 8% Petronas',
    updated_at: '2026-08-16',
  },

  // 4. Touch 'n Go eWallet & GO+
  {
    id: 'acc_tng_wallet',
    bank: "Touch 'n Go eWallet",
    account_name: "Touch 'n Go eWallet",
    type: 'ewallet',
    balance: 0.00,
    color: 'from-blue-500 to-indigo-600',
    icon: 'Smartphone',
    notes: 'Tol RFID, Street parking & QR',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_tng_goplus',
    bank: "Touch 'n Go eWallet",
    account_name: "TnG go+",
    type: 'investment',
    balance: 0.00,
    color: 'from-sky-500 to-blue-700',
    icon: 'TrendingUp',
    notes: 'Principal e-Cash Fund - Pulangan Harian (Daily Return)',
    updated_at: '2026-08-17',
  },

  // 5. Boost
  {
    id: 'acc_boost',
    bank: 'Boost',
    account_name: 'Boost',
    type: 'ewallet',
    balance: 0.00,
    color: 'from-red-500 to-orange-600',
    icon: 'Flame',
    notes: 'Boost Pay & Loyalty Stars',
    updated_at: '2026-08-16',
  },

  // 6. Setel by Petronas
  {
    id: 'acc_setel',
    bank: 'Setel by Petronas',
    account_name: 'Setel by Petronas',
    type: 'ewallet',
    balance: 0.00,
    color: 'from-emerald-500 to-teal-700',
    icon: 'Fuel',
    notes: 'Minyak Petronas Automatik',
    updated_at: '2026-08-16',
  },

  // 7. Shopee
  {
    id: 'acc_shopeepay',
    bank: 'Shopee',
    account_name: 'ShopeePay',
    type: 'ewallet',
    balance: 0.00,
    color: 'from-orange-500 to-amber-600',
    icon: 'ShoppingBag',
    notes: 'ShopeePay Wallet',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_spaylater',
    bank: 'Shopee',
    account_name: 'SPayLater',
    type: 'paylater',
    balance: 0.00,
    credit_limit: 2500.00,
    color: 'from-amber-600 to-orange-700',
    icon: 'Clock',
    notes: 'Shopee SPayLater BNPL',
    updated_at: '2026-08-16',
  },

  // 8. Atome
  {
    id: 'acc_atome_pl',
    bank: 'Atome',
    account_name: 'PayLater',
    type: 'paylater',
    balance: 0.00,
    credit_limit: 1500.00,
    color: 'from-lime-400 to-yellow-500',
    icon: 'Zap',
    notes: 'Atome 3-bulan ansuran 0% faedah',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_atome_card',
    bank: 'Atome',
    account_name: 'Atome Card',
    type: 'credit_card',
    balance: 0.00,
    credit_limit: 1000.00,
    color: 'from-yellow-400 to-lime-500',
    icon: 'CreditCard',
    notes: 'Kad fizikal Mastercard Atome',
    updated_at: '2026-08-16',
  },

  // 9. BSN
  {
    id: 'acc_bsn_sav',
    bank: 'BSN',
    account_name: 'BSN',
    type: 'bank',
    balance: 0.00,
    color: 'from-teal-600 to-emerald-700',
    icon: 'Landmark',
    notes: 'Bank Simpanan Nasional',
    updated_at: '2026-08-16',
  },

  // 10. GXBANK
  {
    id: 'acc_gx_sav',
    bank: 'GXBANK',
    account_name: 'GXBANK',
    type: 'bank',
    balance: 0.00,
    color: 'from-violet-600 to-purple-800',
    icon: 'Landmark',
    notes: 'Bank Digital GX faedah harian',
    updated_at: '2026-08-16',
  },

  // 11. AEON BANK
  {
    id: 'acc_aeon_sav',
    bank: 'AEON BANK',
    account_name: 'AEON BANK',
    type: 'bank',
    balance: 0.00,
    color: 'from-fuchsia-600 to-pink-700',
    icon: 'Landmark',
    notes: 'Bank Digital Islamik AEON',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_aeon_pot',
    bank: 'AEON BANK',
    account_name: 'SAVINGS POT (TABUNG KELUARGA)',
    type: 'bank',
    balance: 0.00,
    color: 'from-pink-600 to-rose-700',
    icon: 'PiggyBank',
    notes: 'Simpanan khas Tabung Keluarga',
    updated_at: '2026-08-16',
  },
  {
    id: 'acc_bsn_ssp_40',
    bank: 'BSN',
    account_name: 'SSP BSN (Sijil RM40)',
    type: 'investment',
    balance: 40.00,
    color: 'from-teal-600 to-emerald-700',
    icon: 'Award',
    notes: 'Cabutan Sijil Simpanan Premium RM40',
    updated_at: '2026-08-14',
  },

  // 13. MIGA (Maybank Islamic Gold Account-i)
  {
    id: 'acc_miga_gold',
    bank: 'Maybank',
    account_name: 'MIGA-i Gold (0.088g)',
    type: 'gold',
    balance: 49.43,
    weight_grams: 0.088,
    avg_price_per_gram: 604.79,
    total_invested: 51.73,
    color: 'from-amber-400 via-amber-500 to-yellow-600',
    icon: 'Sparkles',
    notes: 'Maybank MIGA-i 764018601800 (0.088g @ RM604.79/g, Nilai: RM49.43)',
    updated_at: '2026-08-17',
  },

  // 14. ASNB (Amanah Saham Nasional Berhad)
  {
    id: 'acc_asnb_asb',
    bank: 'ASNB',
    account_name: 'Amanah Saham Bumiputera (ASB)',
    type: 'investment',
    balance: 227.09,
    fund_name: 'Amanah Saham Bumiputera',
    account_number: '000007814094',
    color: 'from-blue-700 to-sky-900',
    icon: 'Coins',
    notes: 'Firdaus Bin Mohd Pauzi - ASB (000007814094)',
    updated_at: '2026-08-17',
  },
  {
    id: 'acc_asnb_asn',
    bank: 'ASNB',
    account_name: 'Amanah Saham Nasional (ASN)',
    type: 'investment',
    balance: 16.81,
    fund_name: 'Amanah Saham Nasional',
    account_number: '000007814094',
    color: 'from-blue-600 to-indigo-800',
    icon: 'Coins',
    notes: 'Firdaus Bin Mohd Pauzi - ASN (000007814094)',
    updated_at: '2026-08-17',
  }
];

export const INITIAL_LOANS: LoanFinancing[] = [
  {
    id: 'loan_bsn_personal',
    name: 'BSN Personal Loan',
    provider: 'BSN (Bank Simpanan Nasional)',
    type: 'personal_loan',
    remaining_balance: 26173.95,
    monthly_installment: 315.00,
    total_paid: 11655.00,
    remaining_tenure_months: 83,
    profit_rate: 4.75,
    due_day: 1,
    notes: 'Pinjaman Peribadi BSN (Ansuran bulanan RM315.00, sudah bayar RM11,655.00, baki 83 bulan, kadar 4.75%)',
    updated_at: '2026-08-14'
  },
  {
    id: 'loan_maybank_saga',
    name: 'Maybank Hire Purchase (Proton Saga)',
    provider: 'Maybank',
    type: 'hire_purchase',
    account_number_or_vehicle: 'Proton Saga CFA 7445',
    remaining_balance: 41133.26,
    monthly_installment: 624.00,
    total_paid: 11232.00,
    remaining_tenure_months: 66,
    profit_rate: 3.06,
    due_day: 1,
    notes: 'Pinjaman Kereta Proton Saga CFA 7445 (Ansuran RM624.00, sudah bayar RM11,232.00, baki 66 bulan, kadar 3.06%)',
    updated_at: '2026-08-14'
  }
];

export const INITIAL_INCOME_TYPES: CategoryItem[] = [
  { id: 'inc_gaji', name: 'Gaji', type: 'income', color: '#10B981', icon: 'Briefcase', is_default: true },
  { id: 'inc_goplus', name: 'Pulangan GO+ / Faedah Harian', type: 'income', color: '#0EA5E9', icon: 'TrendingUp', is_default: true },
  { id: 'inc_sales', name: 'Sales / Bisnes', type: 'income', color: '#3B82F6', icon: 'TrendingUp', is_default: true },
  { id: 'inc_cashback', name: 'Cashback', type: 'income', color: '#F59E0B', icon: 'Coins', is_default: true },
  { id: 'inc_refund', name: 'Refund', type: 'income', color: '#8B5CF6', icon: 'RotateCcw', is_default: true },
  { id: 'inc_commission', name: 'Commission', type: 'income', color: '#EC4899', icon: 'Award', is_default: true },
  { id: 'inc_bonus', name: 'Bonus', type: 'income', color: '#6366F1', icon: 'Gift', is_default: true },
  { id: 'inc_dividend', name: 'Dividend / ASB / Tabung Haji', type: 'income', color: '#14B8A6', icon: 'PiggyBank', is_default: true },
  { id: 'inc_lain', name: 'Lain-lain', type: 'income', color: '#64748B', icon: 'MoreHorizontal', is_default: true }
];

export const INITIAL_EXPENSE_TYPES: CategoryItem[] = [
  { id: 'exp_makan', name: 'Makanan & Minuman', type: 'expense', color: '#EF4444', icon: 'Utensils', is_default: true },
  { id: 'exp_minyak', name: 'Minyak & Tol & Petrol', type: 'expense', color: '#F97316', icon: 'Fuel', is_default: true },
  { id: 'exp_ansuran_kereta', name: 'Ansuran Kereta (Hire Purchase)', type: 'expense', color: '#3B82F6', icon: 'Car', is_default: true },
  { id: 'exp_ansuran_loan', name: 'Ansuran Pinjaman (Personal Loan)', type: 'expense', color: '#8B5CF6', icon: 'Landmark', is_default: true },
  { id: 'exp_shopping', name: 'Shopping & Barang Rumah', type: 'expense', color: '#EC4899', icon: 'ShoppingBag', is_default: true },
  { id: 'exp_bil', name: 'Bil & Utiliti (Elektrik / Air)', type: 'expense', color: '#06B6D4', icon: 'Zap', is_default: true },
  { id: 'exp_internet', name: 'Internet & Telco', type: 'expense', color: '#6366F1', icon: 'Wifi', is_default: true },
  { id: 'exp_sewa', name: 'Sewa Rumah', type: 'expense', color: '#A855F7', icon: 'Home', is_default: true },
  { id: 'exp_hiburan', name: 'Hiburan & Langganan (Netflix/Spotify)', type: 'expense', color: '#D946EF', icon: 'Film', is_default: true },
  { id: 'exp_zakat', name: 'Zakat', type: 'expense', color: '#10B981', icon: 'HeartHandshake', is_default: true },
  { id: 'exp_sedekah', name: 'Sedekah & Infaq', type: 'expense', color: '#14B8A6', icon: 'Heart', is_default: true },
  { id: 'exp_kesihatan', name: 'Kesihatan & Perubatan', type: 'expense', color: '#F43F5E', icon: 'Activity', is_default: true },
  { id: 'exp_lain', name: 'Lain-lain', type: 'expense', color: '#64748B', icon: 'MoreHorizontal', is_default: true }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'log_001',
    timestamp: '2026-08-14 00:00:00',
    action: 'INIT_SYSTEM',
    details: 'Pengkalan data MyWang dimulakan dengan akaun perbankan, pelaburan SSP, ASNB, MIGA dan modul pembiayaan rahsia.',
    user: 'admin'
  }
];

export const INITIAL_GAS_CONFIG = {
  webAppUrl: 'https://script.google.com/macros/s/AKfycbx7jSb1NjRkNhEouyJMwRyfWiF98lAAdwsvpCAcDF_MoiNdxQWFtEzO8ncoGyPEJF31/exec',
  autoSync: true,
  isConnected: true,
  lastSynced: '2026-08-14 16:30'
};
