export type AccountType = 'bank' | 'ewallet' | 'credit_card' | 'paylater' | 'investment' | 'cash' | 'gold';

export interface Account {
  id: string;
  bank: string;
  account_name: string;
  type: AccountType;
  balance: number;
  credit_limit?: number;
  color?: string;
  icon?: string;
  notes?: string;
  weight_grams?: number;
  avg_price_per_gram?: number;
  total_invested?: number;
  fund_name?: string;
  account_number?: string;
  updated_at: string;
}

export interface LoanFinancing {
  id: string;
  name: string;
  provider: string; // e.g. "BSN", "Maybank"
  type: 'personal_loan' | 'hire_purchase' | 'housing_loan' | 'education' | 'other';
  remaining_balance: number;
  monthly_installment: number;
  remaining_tenure_months: number;
  total_paid?: number;
  profit_rate?: number;
  account_number_or_vehicle?: string;
  due_day?: number;
  notes?: string;
  created_at?: string;
  updated_at: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment' | 'refund';

export interface MonthlyClosedRecord {
  id: string;
  month: string; // e.g. "2026-08"
  month_name: string; // e.g. "Ogos 2026"
  opening_balance: number;
  total_income: number;
  total_expense: number;
  total_transfers: number;
  total_adjustments: number;
  total_refunds: number;
  closing_balance: number;
  net_savings: number;
  closed_at: string;
  closed_by: string;
  is_locked: boolean;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  account_id: string;
  account_name?: string;
  to_account_id?: string;
  to_account_name?: string;
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
  receipt_url?: string;
  receipt_data?: ReceiptScanResult;
  created_at: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  is_default?: boolean;
}

export interface User {
  id: string;
  username: string;
  full_name?: string;
  name?: string;
  email?: string;
  role?: string;
  currency?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface SummaryStats {
  totalMoney: number;
  cashAvailable: number;
  creditUsed: number;
  incomeThisMonth: number;
  expenseThisMonth: number;
  netWorth: number;
}

export interface ReceiptItem {
  name: string;
  qty?: number;
  price?: number;
}

export interface ReceiptScanResult {
  merchant: string;
  date: string;
  amount: number;
  category: string;
  suggestedAccount?: string;
  tax?: number;
  items?: ReceiptItem[];
  payment_method?: string;
  note?: string;
  raw_text?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}

export interface GoogleSheetsConfig {
  webAppUrl: string;
  sheetId?: string;
  lastSynced?: string;
  autoSync: boolean;
  isConnected: boolean;
}
