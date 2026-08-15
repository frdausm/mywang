/**
 * MyWang - Utilities & Database Init (Google Apps Script)
 * Handles spreadsheet initialization, audit logs, categories management
 */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function initializeDatabaseSheets() {
  var ss = getSpreadsheet();

  var sheetSchemas = {
    'USERS': ['id', 'username', 'password_hash', 'full_name', 'email', 'role', 'created_at'],
    'ACCOUNTS': ['id', 'bank', 'account_name', 'type', 'balance', 'credit_limit', 'color', 'icon', 'notes', 'updated_at'],
    'TRANSACTIONS': ['id', 'date', 'account_id', 'account_name', 'to_account_id', 'to_account_name', 'type', 'category', 'amount', 'note', 'created_at'],
    'INCOME': ['id', 'date', 'account', 'income_type', 'amount', 'note', 'created_at'],
    'EXPENSE': ['id', 'date', 'account', 'expense_type', 'amount', 'note', 'created_at'],
    'TRANSFERS': ['id', 'date', 'from_account', 'to_account', 'amount', 'note', 'created_at'],
    'INCOME_TYPES': ['id', 'name', 'color', 'icon', 'is_default'],
    'EXPENSE_TYPES': ['id', 'name', 'color', 'icon', 'is_default'],
    'SETTINGS': ['key', 'value', 'updated_at'],
    'LOGS': ['id', 'timestamp', 'action', 'details', 'user']
  };

  for (var sheetName in sheetSchemas) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetSchemas[sheetName]);
      sheet.getRange(1, 1, 1, sheetSchemas[sheetName].length)
        .setBackground('#10B981')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }
  }

  // Seed default admin user if USERS is empty
  var userSheet = ss.getSheetByName('USERS');
  if (userSheet && userSheet.getLastRow() <= 1) {
    userSheet.appendRow([
      'usr_001',
      'admin',
      hashPassword('admin123'),
      'Fifi Haziq (Admin)',
      'fifinoty@gmail.com',
      'Owner',
      new Date().toISOString()
    ]);
  }

  // Seed Default Categories if empty
  var incTypeSheet = ss.getSheetByName('INCOME_TYPES');
  if (incTypeSheet && incTypeSheet.getLastRow() <= 1) {
    var incTypes = [
      ['inc_gaji', 'Gaji', '#10B981', 'Briefcase', 'TRUE'],
      ['inc_sales', 'Sales / Bisnes', '#3B82F6', 'TrendingUp', 'TRUE'],
      ['inc_cashback', 'Cashback', '#F59E0B', 'Coins', 'TRUE'],
      ['inc_refund', 'Refund', '#8B5CF6', 'RotateCcw', 'TRUE'],
      ['inc_commission', 'Commission', '#EC4899', 'Award', 'TRUE'],
      ['inc_bonus', 'Bonus', '#6366F1', 'Gift', 'TRUE'],
      ['inc_dividend', 'Dividend / ASB / Tabung Haji', '#14B8A6', 'PiggyBank', 'TRUE'],
      ['inc_lain', 'Lain-lain', '#64748B', 'MoreHorizontal', 'TRUE']
    ];
    for (var k = 0; k < incTypes.length; k++) {
      incTypeSheet.appendRow(incTypes[k]);
    }
  }

  var expTypeSheet = ss.getSheetByName('EXPENSE_TYPES');
  if (expTypeSheet && expTypeSheet.getLastRow() <= 1) {
    var expTypes = [
      ['exp_makan', 'Makanan & Minuman', '#EF4444', 'Utensils', 'TRUE'],
      ['exp_minyak', 'Minyak & Tol & Petrol', '#F97316', 'Fuel', 'TRUE'],
      ['exp_shopping', 'Shopping & Barang Rumah', '#EC4899', 'ShoppingBag', 'TRUE'],
      ['exp_bil', 'Bil & Utiliti (Elektrik / Air)', '#3B82F6', 'Zap', 'TRUE'],
      ['exp_internet', 'Internet & Telco', '#6366F1', 'Wifi', 'TRUE'],
      ['exp_sewa', 'Sewa & Rumah / Kereta', '#8B5CF6', 'Home', 'TRUE'],
      ['exp_hiburan', 'Hiburan & Langganan (Netflix/Spotify)', '#A855F7', 'Film', 'TRUE'],
      ['exp_zakat', 'Zakat', '#10B981', 'HeartHandshake', 'TRUE'],
      ['exp_sedekah', 'Sedekah & Infaq', '#14B8A6', 'Heart', 'TRUE'],
      ['exp_kesihatan', 'Kesihatan & Perubatan', '#06B6D4', 'Activity', 'TRUE'],
      ['exp_lain', 'Lain-lain', '#64748B', 'MoreHorizontal', 'TRUE']
    ];
    for (var m = 0; m < expTypes.length; m++) {
      expTypeSheet.appendRow(expTypes[m]);
    }
  }

  addAuditLog('INIT_DATABASE', 'Struktur 10 Google Sheet MyWang berjaya dimulakan.');

  return { status: 'success', message: 'Pengkalan data Google Sheets MyWang berjaya dimulakan!' };
}

function addAuditLog(action, details, user) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('LOGS');
    if (!sheet) return;

    var logId = 'log_' + new Date().getTime();
    var timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss');
    var currentUser = user || 'admin';

    sheet.appendRow([logId, timeStr, action, details, currentUser]);
  } catch (e) {
    // Ignore logging errors to prevent breaking main flow
  }
}

function getAuditLogsList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('LOGS');
  if (!sheet) return { status: 'success', data: [] };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [] };

  var headers = data[0];
  var logs = [];

  for (var i = data.length - 1; i >= Math.max(1, data.length - 50); i--) {
    var row = data[i];
    if (!row[0]) continue;
    var logItem = {};
    for (var h = 0; h < headers.length; h++) {
      logItem[headers[h]] = row[h];
    }
    logs.push(logItem);
  }

  return { status: 'success', data: logs };
}

function getCategoriesData() {
  var ss = getSpreadsheet();
  var incSheet = ss.getSheetByName('INCOME_TYPES');
  var expSheet = ss.getSheetByName('EXPENSE_TYPES');

  var incomeTypes = [];
  var expenseTypes = [];

  if (incSheet) {
    var incData = incSheet.getDataRange().getValues();
    if (incData.length > 1) {
      for (var i = 1; i < incData.length; i++) {
        if (!incData[i][0]) continue;
        incomeTypes.push({
          id: incData[i][0],
          name: incData[i][1],
          color: incData[i][2] || '#10B981',
          icon: incData[i][3] || 'TrendingUp',
          type: 'income'
        });
      }
    }
  }

  if (expSheet) {
    var expData = expSheet.getDataRange().getValues();
    if (expData.length > 1) {
      for (var j = 1; j < expData.length; j++) {
        if (!expData[j][0]) continue;
        expenseTypes.push({
          id: expData[j][0],
          name: expData[j][1],
          color: expData[j][2] || '#EF4444',
          icon: expData[j][3] || 'ShoppingBag',
          type: 'expense'
        });
      }
    }
  }

  return {
    status: 'success',
    data: {
      incomeTypes: incomeTypes,
      expenseTypes: expenseTypes
    }
  };
}

function handleSaveCategory(category) {
  if (!category || !category.name) return { status: 'error', message: 'Nama kategori diperlukan.' };

  var ss = getSpreadsheet();
  var sheetName = category.type === 'income' ? 'INCOME_TYPES' : 'EXPENSE_TYPES';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'Sheet kategori tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  var catId = category.id || (category.type === 'income' ? 'inc_' : 'exp_') + new Date().getTime();

  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(catId)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(category.name);
    sheet.getRange(foundRow, 3).setValue(category.color || '#10B981');
    sheet.getRange(foundRow, 4).setValue(category.icon || 'Tag');
  } else {
    sheet.appendRow([catId, category.name, category.color || '#10B981', category.icon || 'Tag', 'FALSE']);
  }

  return { status: 'success', message: 'Kategori berjaya disimpan.', data: category };
}

function handleDeleteCategory(catId, type) {
  if (!catId) return { status: 'error', message: 'ID diperlukan.' };
  var ss = getSpreadsheet();
  var sheetName = type === 'income' ? 'INCOME_TYPES' : 'EXPENSE_TYPES';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'Sheet tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(catId)) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Kategori berjaya dipadam.' };
    }
  }
  return { status: 'error', message: 'Kategori tidak dijumpai.' };
}

function handleSyncDashboard(syncPayload) {
  // Sync full accounts, transactions, and categories in a single call
  if (syncPayload.accounts && syncPayload.accounts.length > 0) {
    for (var a = 0; a < syncPayload.accounts.length; a++) {
      handleSaveAccount(syncPayload.accounts[a]);
    }
  }
  return getDashboardData();
}
