/**
 * MyWang - Accounts Module (Google Apps Script)
 * Manages bank accounts, e-wallets, credit cards, paylater
 */

function getAccountsList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('ACCOUNTS');
  if (!sheet) {
    initializeDatabaseSheets();
    sheet = ss.getSheetByName('ACCOUNTS');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [] };

  var headers = data[0];
  var accounts = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    
    var acc = {};
    for (var h = 0; h < headers.length; h++) {
      acc[headers[h]] = row[h];
    }
    acc.balance = Number(acc.balance) || 0;
    accounts.push(acc);
  }

  return { status: 'success', data: accounts };
}

function handleSaveAccount(accountData) {
  if (!accountData || !accountData.id) {
    return { status: 'error', message: 'ID akaun diperlukan.' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('ACCOUNTS');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var idIndex = headers.indexOf('id');
  var foundRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(accountData.id)) {
      foundRow = i + 1; // 1-indexed for Sheet
      break;
    }
  }

  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  accountData.updated_at = todayStr;

  if (foundRow > 0) {
    // Update existing row
    for (var h = 0; h < headers.length; h++) {
      var key = headers[h];
      if (accountData[key] !== undefined) {
        sheet.getRange(foundRow, h + 1).setValue(accountData[key]);
      }
    }
    addAuditLog('UPDATE_ACCOUNT', 'Kemaskini baki akaun ' + (accountData.account_name || accountData.bank) + ' kepada RM ' + accountData.balance);
  } else {
    // Append as new
    var newRow = headers.map(function(k) {
      return accountData[k] !== undefined ? accountData[k] : '';
    });
    sheet.appendRow(newRow);
    addAuditLog('ADD_ACCOUNT', 'Tambah akaun baru ' + (accountData.account_name || accountData.bank) + ' baki RM ' + accountData.balance);
  }

  return { status: 'success', message: 'Akaun berjaya disimpan.', data: accountData };
}

function handleAddAccount(accountData) {
  if (!accountData.id) {
    accountData.id = 'acc_' + new Date().getTime();
  }
  return handleSaveAccount(accountData);
}

function handleDeleteAccount(accountId) {
  if (!accountId) return { status: 'error', message: 'ID diperlukan' };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('ACCOUNTS');
  var data = sheet.getDataRange().getValues();
  var idIndex = data[0].indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(accountId)) {
      sheet.deleteRow(i + 1);
      addAuditLog('DELETE_ACCOUNT', 'Padam akaun ID: ' + accountId);
      return { status: 'success', message: 'Akaun berjaya dipadam.' };
    }
  }

  return { status: 'error', message: 'Akaun tidak dijumpai.' };
}
