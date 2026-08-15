import * as XLSX from 'xlsx';
import { Account, Transaction, CategoryItem } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_INCOME_TYPES, INITIAL_EXPENSE_TYPES } from '../data/defaultData';

/**
 * Export current transactions list to Excel
 */
export function exportTransactionsToExcel(transactions: Transaction[], filename = 'MyWang_Transactions.xlsx') {
  const data = transactions.map((t) => ({
    'Tarikh': t.date,
    'Akaun': t.account_name || t.account_id,
    'Akaun Sasaran (Transfer)': t.to_account_name || '-',
    'Jenis': t.type.toUpperCase(),
    'Kategori': t.category,
    'Jumlah (RM)': t.amount,
    'Nota': t.note,
    'Dicipta Pada': t.created_at || t.date,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TRANSACTIONS');

  XLSX.writeFile(workbook, filename);
}

/**
 * Generate full 10-sheet GoogleSheet_Template.xlsx
 */
export function generateGoogleSheetTemplateXlsx() {
  const workbook = XLSX.utils.book_new();

  // 1. USERS
  const usersData = [
    { id: 'usr_001', username: 'admin', password_hash: 'admin123', full_name: 'Fifi Haziq (Admin)', email: 'fifinoty@gmail.com', role: 'Owner', created_at: '2026-08-14T08:00:00Z' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(usersData), 'USERS');

  // 2. ACCOUNTS
  const accountsData = INITIAL_ACCOUNTS.map(a => ({
    id: a.id,
    bank: a.bank,
    account_name: a.account_name,
    type: a.type,
    balance: a.balance,
    credit_limit: a.credit_limit || 0,
    color: a.color || '',
    icon: a.icon || '',
    notes: a.notes || '',
    updated_at: a.updated_at
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accountsData), 'ACCOUNTS');

  // 3. TRANSACTIONS
  const txData = [
    { id: 'tx_001', date: '2026-08-14', account_id: 'acc_mb_mae', account_name: 'Maybank - MAE Digital Wallet', to_account_id: '', to_account_name: '', type: 'expense', category: 'Makanan & Minuman', amount: 18.50, note: 'Nasi Lemak Ayam Berempah', created_at: '2026-08-14T08:30:00Z' },
    { id: 'tx_002', date: '2026-08-13', account_id: 'acc_setel', account_name: 'Setel by Petronas', to_account_id: '', to_account_name: '', type: 'expense', category: 'Minyak & Tol & Petrol', amount: 50.00, note: 'Petrol Primax 95', created_at: '2026-08-13T17:45:00Z' },
    { id: 'tx_003', date: '2026-08-01', account_id: 'acc_mb_sav', account_name: 'Maybank - Savings Account', to_account_id: '', to_account_name: '', type: 'income', category: 'Gaji', amount: 4500.00, note: 'Gaji Bulanan Ogos 2026', created_at: '2026-08-01T00:05:00Z' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(txData), 'TRANSACTIONS');

  // 4. INCOME
  const incomeData = [
    { id: 'inc_001', date: '2026-08-01', account: 'Maybank - Savings Account', income_type: 'Gaji', amount: 4500.00, note: 'Gaji Ogos', created_at: '2026-08-01T00:05:00Z' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(incomeData), 'INCOME');

  // 5. EXPENSE
  const expenseData = [
    { id: 'exp_001', date: '2026-08-14', account: 'Maybank - MAE', expense_type: 'Makanan & Minuman', amount: 18.50, note: 'Sarapan', created_at: '2026-08-14T08:30:00Z' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseData), 'EXPENSE');

  // 6. TRANSFERS
  const transferData = [
    { id: 'tf_001', date: '2026-08-05', from_account: 'Maybank - Savings Account', to_account: "Touch 'n Go eWallet", amount: 200.00, note: 'Top up TNG', created_at: '2026-08-05T09:00:00Z' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transferData), 'TRANSFERS');

  // 7. INCOME_TYPES
  const incTypesData = INITIAL_INCOME_TYPES.map(i => ({ id: i.id, name: i.name, color: i.color, icon: i.icon, is_default: 'TRUE' }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(incTypesData), 'INCOME_TYPES');

  // 8. EXPENSE_TYPES
  const expTypesData = INITIAL_EXPENSE_TYPES.map(e => ({ id: e.id, name: e.name, color: e.color, icon: e.icon, is_default: 'TRUE' }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expTypesData), 'EXPENSE_TYPES');

  // 9. SETTINGS
  const settingsData = [
    { key: 'app_name', value: 'MyWang', updated_at: '2026-08-14' },
    { key: 'currency', value: 'MYR', updated_at: '2026-08-14' },
    { key: 'country', value: 'Malaysia', updated_at: '2026-08-14' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(settingsData), 'SETTINGS');

  // 10. LOGS
  const logsData = [
    { id: 'log_001', timestamp: '2026-08-14 08:30:00', action: 'INIT', details: 'Sistem MyWang dimulakan', user: 'admin' }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(logsData), 'LOGS');

  XLSX.writeFile(workbook, 'MyWang_GoogleSheet_Template.xlsx');
}
