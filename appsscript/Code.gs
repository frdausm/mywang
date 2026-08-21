/**
 * SAKUTRACK & MYWANG - COMPLETE STANDALONE BACKEND SCRIPT
 * Sesuai untuk dimasukkan terus ke dalam satu fail (Code.gs)
 * 100% Sesuai dengan struktur Sheet SakuTrack asal & sokong semua fungsi terkini
 */

// ==========================================
// 1. SPREADSHEET HELPER & JSON RESPONSE
// ==========================================

// Fungsi Ujian untuk butang 'Run' di Apps Script Editor
function testConnection() {
  var accounts = getAccountsList({});
  Logger.log("Jumlah akaun dijumpai: " + (accounts.data ? accounts.data.length : 0));
  return accounts;
}

function getSpreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.openById(SpreadsheetApp.getActiveSpreadsheet().getId());
}

function createJsonResponse(data, callback) {
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function addAuditLog(action, details, user) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('LOGS') || ss.getSheetByName('Logs');
    if (!sheet) return;
    var logId = 'LOG_' + new Date().getTime();
    var timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([logId, timeStr, action, details, user || 'user']);
  } catch (e) {}
}

// ==========================================
// 2. HTTP GET HANDLER
// ==========================================

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || 'getDashboard';
    var responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'success', message: 'SakuTrack & MyWang API is online!', timestamp: new Date().toISOString() };
        break;

      case 'getAccounts':
      case 'get_accounts':
        responseData = getAccountsList(params);
        break;

      case 'getTransactions':
      case 'get_transactions':
        responseData = getTransactionsList(params);
        break;

      case 'getDashboard':
      case 'get_dashboard':
      case 'getInitialData':
      case 'sync':
      case 'syncDashboard':
        var accs = getAccountsList(params).data || [];
        var txs = getTransactionsList(params).data || [];
        responseData = {
          status: 'success',
          accounts: accs,
          transactions: txs,
          data: {
            accounts: accs,
            transactions: txs,
            recentTransactions: txs.slice(0, 20)
          }
        };
        break;

      default:
        var defAccs = getAccountsList(params).data || [];
        var defTxs = getTransactionsList(params).data || [];
        responseData = {
          status: 'success',
          accounts: defAccs,
          transactions: defTxs,
          data: {
            accounts: defAccs,
            transactions: defTxs
          }
        };
    }

    return createJsonResponse(responseData, params.callback);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, params ? params.callback : null);
  }
}

// ==========================================
// 3. HTTP POST HANDLER
// ==========================================

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : '{}';
    var payload = {};
    try {
      payload = JSON.parse(contents);
    } catch (err) {
      payload = e && e.parameter ? e.parameter : {};
    }

    var action = payload.action || (e && e.parameter ? e.parameter.action : '');
    var data = payload.data || payload;
    var responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'success', message: 'SakuTrack & MyWang API is online!', timestamp: new Date().toISOString() };
        break;

      case 'login':
        responseData = handleUserLogin(data.username || payload.username, data.password || payload.password);
        break;

      case 'getDashboard':
      case 'get_dashboard':
      case 'getInitialData':
      case 'sync':
      case 'syncDashboard':
        var accs = getAccountsList(payload).data || [];
        var txs = getTransactionsList(payload).data || [];
        responseData = {
          status: 'success',
          accounts: accs,
          transactions: txs,
          data: {
            accounts: accs,
            transactions: txs,
            recentTransactions: txs.slice(0, 20)
          }
        };
        break;

      case 'getTransactions':
      case 'get_transactions':
        responseData = getTransactionsList(data || payload);
        break;

      case 'getAccounts':
      case 'get_accounts':
        responseData = getAccountsList(data || payload);
        break;

      case 'saveAccount':
      case 'updateAccount':
      case 'updateBalance':
      case 'save_account':
      case 'edit_account':
        responseData = handleSaveAccount(data);
        break;

      case 'addAccount':
      case 'add_account':
        responseData = handleAddAccount(data);
        break;

      case 'deleteAccount':
      case 'delete_account':
        responseData = handleDeleteAccount(data.AccountID || data.id || payload.AccountID || payload.id);
        break;

      case 'addTransaction':
      case 'add_transaction':
        responseData = handleAddTransaction(data);
        break;

      case 'updateTransaction':
      case 'update_transaction':
        responseData = handleUpdateTransaction(data);
        break;

      case 'deleteTransaction':
      case 'delete_transaction':
        responseData = handleDeleteTransaction(data.TxID || data.id || payload.TxID || payload.id || data.txId || payload.txId);
        break;

      case 'transferMoney':
      case 'transfer_money':
      case 'recordTransfer':
      case 'transfer':
      case 'transfer_funds':
        responseData = handleTransferMoney(data);
        break;

      default:
        if (data.AccountName || data.account_name || data.InitialBalance !== undefined || data.balance !== undefined) {
          responseData = handleSaveAccount(data);
        } else {
          var fbAccs = getAccountsList(payload).data || [];
          var fbTxs = getTransactionsList(payload).data || [];
          responseData = {
            status: 'success',
            accounts: fbAccs,
            transactions: fbTxs
          };
        }
    }

    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

// ==========================================
// 4. ACCOUNTS MODULE (100% SAKUTRACK SHEET FORMAT)
// ==========================================

function getAccountsSheet(ss) {
  if (!ss) ss = getSpreadsheet();
  return ss.getSheetByName('Accounts') || 
         ss.getSheetByName('ACCOUNTS') || 
         ss.getSheetByName('accounts') || 
         ss.getSheetByName('SakuTrack_DB');
}

function getAccountsList(params) {
  var ss = getSpreadsheet();
  var sheet = getAccountsSheet(ss);
  if (!sheet) {
    return { status: 'success', data: [], accounts: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [], accounts: [] };

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var accounts = [];

  var filterUser = params ? (params.username || params.token || '') : '';
  if (filterUser) filterUser = String(filterUser).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[2]) continue;
    
    var acc = {};
    for (var h = 0; h < headers.length; h++) {
      acc[headers[h]] = row[h];
    }

    var rowUser = String(acc.Username || acc.username || '').trim().toLowerCase();
    var id = acc.AccountID || acc.id || acc.account_id || ('ACC_' + i);
    var name = acc.AccountName || acc.account_name || acc.bank || acc.name || ('Akaun ' + i);
    var type = acc.AccountType || acc.type || 'Bank';
    var bal = Number(acc.InitialBalance !== undefined ? acc.InitialBalance : (acc.balance !== undefined ? acc.balance : acc.Balance)) || 0;
    var notes = acc.Notes || acc.notes || '';
    var accNum = acc.AccountNumber || acc.account_number || '';
    var userVal = acc.Username || acc.username || 'user';
    var created = acc.CreatedAt || acc.created_at || acc.updated_at || '';

    accounts.push({
      id: String(id),
      AccountID: String(id),
      account_id: String(id),
      Username: userVal,
      username: userVal,
      bank: name,
      Bank: name,
      account_name: name,
      AccountName: name,
      name: name,
      type: type,
      AccountType: type,
      balance: bal,
      InitialBalance: bal,
      notes: notes,
      Notes: notes,
      account_number: String(accNum),
      AccountNumber: String(accNum),
      created_at: created,
      CreatedAt: created,
      updated_at: created
    });
  }

  return { status: 'success', data: accounts, accounts: accounts };
}

function handleSaveAccount(accountData) {
  if (!accountData || (!accountData.id && !accountData.AccountID && !accountData.account_name && !accountData.AccountName)) {
    return { status: 'error', message: 'Maklumat akaun diperlukan.' };
  }

  var accId = String(accountData.AccountID || accountData.id || accountData.account_id || ('ACC_' + new Date().getTime()));
  var ss = getSpreadsheet();
  var sheet = getAccountsSheet(ss);
  
  if (!sheet) {
    sheet = ss.insertSheet('Accounts');
    sheet.appendRow(['AccountID', 'Username', 'AccountName', 'AccountType', 'InitialBalance', 'AccountNumber', 'Notes', 'CreatedAt']);
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  
  var idIndex = headers.indexOf('AccountID');
  if (idIndex === -1) idIndex = headers.indexOf('id');
  if (idIndex === -1) idIndex = headers.indexOf('account_id');
  if (idIndex === -1) idIndex = 0;

  var nameIndex = headers.indexOf('AccountName');
  if (nameIndex === -1) nameIndex = headers.indexOf('account_name');
  if (nameIndex === -1) nameIndex = headers.indexOf('bank');

  var foundRow = -1;
  var targetName = String(accountData.AccountName || accountData.account_name || accountData.bank || '').trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var existingId = String(data[i][idIndex] || '').trim();
    var existingName = nameIndex !== -1 ? String(data[i][nameIndex] || '').trim().toLowerCase() : '';

    if (existingId === accId || (targetName && existingName === targetName)) {
      foundRow = i + 1;
      break;
    }
  }

  var accName = accountData.AccountName || accountData.account_name || accountData.bank || accountData.name || 'Akaun';
  var accType = accountData.AccountType || accountData.type || 'Bank';
  var accBal = Number(accountData.InitialBalance !== undefined ? accountData.InitialBalance : (accountData.balance !== undefined ? accountData.balance : 0));
  var accNotes = accountData.Notes || accountData.notes || '';
  var accNumber = accountData.AccountNumber || accountData.account_number || accountData.number || '';
  var accUser = accountData.Username || accountData.username || 'user';
  var nowIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  if (foundRow > 0) {
    for (var h = 0; h < headers.length; h++) {
      var colKey = headers[h];
      if (colKey === 'AccountName' || colKey === 'account_name' || colKey === 'bank') {
        sheet.getRange(foundRow, h + 1).setValue(accName);
      } else if (colKey === 'InitialBalance' || colKey === 'balance' || colKey === 'Balance') {
        sheet.getRange(foundRow, h + 1).setValue(accBal);
      } else if (colKey === 'AccountType' || colKey === 'type') {
        sheet.getRange(foundRow, h + 1).setValue(accType);
      } else if (colKey === 'Notes' || colKey === 'notes') {
        sheet.getRange(foundRow, h + 1).setValue(accNotes);
      } else if (colKey === 'AccountNumber' || colKey === 'account_number') {
        sheet.getRange(foundRow, h + 1).setValue(accNumber);
      } else if (colKey === 'Username' || colKey === 'username') {
        if (accountData.username || accountData.Username) {
          sheet.getRange(foundRow, h + 1).setValue(accUser);
        }
      }
    }
    addAuditLog('UPDATE_ACCOUNT', 'Kemaskini akaun ' + accName + ' (Baki: RM ' + accBal + ')', accUser);
  } else {
    var newRow = [];
    for (var k = 0; k < headers.length; k++) {
      var headerName = headers[k];
      if (headerName === 'AccountID' || headerName === 'id' || headerName === 'account_id') {
        newRow.push(accId);
      } else if (headerName === 'Username' || headerName === 'username') {
        newRow.push(accUser);
      } else if (headerName === 'AccountName' || headerName === 'account_name' || headerName === 'bank') {
        newRow.push(accName);
      } else if (headerName === 'AccountType' || headerName === 'type') {
        newRow.push(accType);
      } else if (headerName === 'InitialBalance' || headerName === 'balance' || headerName === 'Balance') {
        newRow.push(accBal);
      } else if (headerName === 'AccountNumber' || headerName === 'account_number') {
        newRow.push(accNumber);
      } else if (headerName === 'Notes' || headerName === 'notes') {
        newRow.push(accNotes);
      } else if (headerName === 'CreatedAt' || headerName === 'created_at' || headerName === 'updated_at') {
        newRow.push(nowIso);
      } else {
        newRow.push(accountData[headerName] !== undefined ? accountData[headerName] : '');
      }
    }
    sheet.appendRow(newRow);
    addAuditLog('ADD_ACCOUNT', 'Tambah akaun ' + accName + ' (Baki: RM ' + accBal + ')', accUser);
  }

  return { 
    status: 'success', 
    message: 'Akaun ' + accName + ' berjaya disimpan ke Google Sheets.', 
    data: {
      id: accId,
      AccountID: accId,
      account_name: accName,
      AccountName: accName,
      type: accType,
      AccountType: accType,
      balance: accBal,
      InitialBalance: accBal,
      notes: accNotes,
      account_number: accNumber
    } 
  };
}

function handleAddAccount(accountData) {
  accountData = accountData || {};
  if (!accountData.AccountID && !accountData.id) {
    accountData.AccountID = 'ACC_' + new Date().getTime();
    accountData.id = accountData.AccountID;
  }
  return handleSaveAccount(accountData);
}

function handleDeleteAccount(accountId) {
  if (!accountId) return { status: 'error', message: 'ID akaun diperlukan' };

  var ss = getSpreadsheet();
  var sheet = getAccountsSheet(ss);
  if (!sheet) return { status: 'error', message: 'Sheet Accounts tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', message: 'Tiada akaun dijumpai.' };

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIndex = headers.indexOf('AccountID');
  if (idIndex === -1) idIndex = headers.indexOf('id');
  if (idIndex === -1) idIndex = 0;

  var targetId = String(accountId).trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]).trim() === targetId) {
      var deletedName = data[i][headers.indexOf('AccountName')] || data[i][headers.indexOf('account_name')] || targetId;
      sheet.deleteRow(i + 1);
      addAuditLog('DELETE_ACCOUNT', 'Padam akaun ' + deletedName + ' (' + targetId + ')');
      return { status: 'success', message: 'Akaun ' + deletedName + ' berjaya dipadam dari Google Sheets.' };
    }
  }

  return { status: 'error', message: 'Akaun tidak dijumpai dalam Google Sheets.' };
}

// ==========================================
// 5. TRANSACTIONS MODULE (100% SAKUTRACK SHEET FORMAT)
// ==========================================

function getTransactionsSheet(ss) {
  if (!ss) ss = getSpreadsheet();
  return ss.getSheetByName('Transactions') || 
         ss.getSheetByName('TRANSACTIONS') || 
         ss.getSheetByName('transactions');
}

function getTransactionsList(params) {
  var ss = getSpreadsheet();
  var sheet = getTransactionsSheet(ss);
  if (!sheet) {
    return { status: 'success', data: [], transactions: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [], transactions: [] };

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var transactions = [];

  var filterUser = params ? (params.username || params.token || '') : '';
  if (filterUser) filterUser = String(filterUser).trim().toLowerCase();

  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (!row[0] && !row[7]) continue;
    
    var tx = {};
    for (var h = 0; h < headers.length; h++) {
      tx[headers[h]] = row[h];
    }

    var rowUser = String(tx.Username || tx.username || '').trim().toLowerCase();
    var txId = tx.TxID || tx.id || tx.txId || ('Tx_' + i);
    var txType = String(tx.Type || tx.type || 'expense').toLowerCase();
    var txDate = tx.Date || tx.date || '';
    var txCategory = tx.Category || tx.category || 'Lain-lain';
    var txMethod = tx.Method || tx.method || tx.payment_method || 'Online Transfer';
    var txSource = tx.Source || tx.source || tx.account_name || tx.bank || 'Tunai';
    var txAmount = Number(tx.Amount !== undefined ? tx.Amount : (tx.amount !== undefined ? tx.amount : 0)) || 0;
    var txDiscount = Number(tx.Discount || tx.discount || 0) || 0;
    var txNote = tx.Note || tx.note || '';
    var txReceipt = tx.ReceiptURL || tx.receipt_url || tx.receipt || '';
    var txCreated = tx.CreatedAt || tx.created_at || '';

    transactions.push({
      id: String(txId),
      TxID: String(txId),
      txId: String(txId),
      Username: rowUser || 'user',
      username: rowUser || 'user',
      type: txType,
      Type: txType,
      date: String(txDate),
      Date: String(txDate),
      category: txCategory,
      Category: txCategory,
      payment_method: txMethod,
      Method: txMethod,
      account_name: txSource,
      account_id: txSource,
      Source: txSource,
      source: txSource,
      amount: txAmount,
      Amount: txAmount,
      discount: txDiscount,
      Discount: txDiscount,
      note: txNote,
      Note: txNote,
      receipt_url: txReceipt,
      ReceiptURL: txReceipt,
      created_at: txCreated,
      CreatedAt: txCreated
    });
  }

  return { status: 'success', data: transactions, transactions: transactions };
}

function handleAddTransaction(tx) {
  if (!tx || (tx.amount === undefined && tx.Amount === undefined)) {
    return { status: 'error', message: 'Jumlah transaksi diperlukan.' };
  }

  var ss = getSpreadsheet();
  var txSheet = getTransactionsSheet(ss);
  var accSheet = getAccountsSheet(ss);

  if (!txSheet) {
    txSheet = ss.insertSheet('Transactions');
    txSheet.appendRow(['TxID', 'Username', 'Type', 'Date', 'Category', 'Method', 'Source', 'Amount', 'Discount', 'Note', 'ReceiptURL', 'CreatedAt']);
  }

  var txId = tx.TxID || tx.id || ('Tx_' + new Date().getTime());
  var txUser = tx.Username || tx.username || 'user';
  var txType = String(tx.Type || tx.type || 'expense').toLowerCase();
  var txDate = tx.Date || tx.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  var txCat = tx.Category || tx.category || 'Lain-lain';
  var txMethod = tx.Method || tx.method || tx.payment_method || 'Online Transfer';
  var txSource = tx.Source || tx.source || tx.account_name || tx.bank || 'Maybank';
  var txAmount = Number(tx.Amount !== undefined ? tx.Amount : tx.amount) || 0;
  var txDisc = Number(tx.Discount !== undefined ? tx.Discount : (tx.discount || 0)) || 0;
  var txNote = tx.Note || tx.note || '';
  var txReceipt = tx.ReceiptURL || tx.receipt_url || tx.receipt || '';
  var nowIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  var data = txSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });

  var newRow = [];
  for (var k = 0; k < headers.length; k++) {
    var hName = headers[k];
    if (hName === 'TxID' || hName === 'id') newRow.push(txId);
    else if (hName === 'Username' || hName === 'username') newRow.push(txUser);
    else if (hName === 'Type' || hName === 'type') newRow.push(txType);
    else if (hName === 'Date' || hName === 'date') newRow.push(txDate);
    else if (hName === 'Category' || hName === 'category') newRow.push(txCat);
    else if (hName === 'Method' || hName === 'method' || hName === 'payment_method') newRow.push(txMethod);
    else if (hName === 'Source' || hName === 'source' || hName === 'account_name' || hName === 'bank') newRow.push(txSource);
    else if (hName === 'Amount' || hName === 'amount') newRow.push(txAmount);
    else if (hName === 'Discount' || hName === 'discount') newRow.push(txDisc);
    else if (hName === 'Note' || hName === 'note') newRow.push(txNote);
    else if (hName === 'ReceiptURL' || hName === 'receipt_url' || hName === 'receipt') newRow.push(txReceipt);
    else if (hName === 'CreatedAt' || hName === 'created_at') newRow.push(nowIso);
    else newRow.push(tx[hName] !== undefined ? tx[hName] : '');
  }

  txSheet.appendRow(newRow);

  // Update Account Balance in Accounts sheet
  if (accSheet) {
    var accData = accSheet.getDataRange().getValues();
    if (accData.length > 1) {
      var accHeaders = accData[0].map(function(h) { return String(h || '').trim(); });
      var idIdx = accHeaders.indexOf('AccountID');
      if (idIdx === -1) idIdx = accHeaders.indexOf('id');
      var nameIdx = accHeaders.indexOf('AccountName');
      if (nameIdx === -1) nameIdx = accHeaders.indexOf('account_name');
      var balIdx = accHeaders.indexOf('InitialBalance');
      if (balIdx === -1) balIdx = accHeaders.indexOf('balance');

      for (var a = 1; a < accData.length; a++) {
        var existingAccId = String(accData[a][idIdx] || '').trim();
        var existingAccName = nameIdx !== -1 ? String(accData[a][nameIdx] || '').trim().toLowerCase() : '';
        var searchSource = String(txSource).trim().toLowerCase();

        if (existingAccId === txSource || (existingAccName && (existingAccName === searchSource || searchSource.indexOf(existingAccName) !== -1))) {
          var curBal = Number(accData[a][balIdx]) || 0;
          var updatedBal = curBal;
          if (txType === 'income') {
            updatedBal = curBal + txAmount;
          } else if (txType === 'expense') {
            updatedBal = curBal - txAmount;
          }
          accSheet.getRange(a + 1, balIdx + 1).setValue(updatedBal);
          break;
        }
      }
    }
  }

  addAuditLog('ADD_TRANSACTION', 'Transaksi baru ' + txType.toUpperCase() + ' RM ' + txAmount + ' (' + txCat + ')', txUser);
  return { status: 'success', message: 'Transaksi berjaya direkodkan ke Google Sheets.', data: tx };
}

function handleTransferMoney(transferData) {
  var fromId = transferData.from_account_id || transferData.from_account || transferData.from || transferData.from_account_name;
  var toId = transferData.to_account_id || transferData.to_account || transferData.to || transferData.to_account_name;
  var fromName = transferData.from_account_name || transferData.from_bank || fromId;
  var toName = transferData.to_account_name || transferData.to_bank || toId;
  var amount = Number(transferData.amount);

  if (!fromId || !toId || !amount || amount <= 0) {
    return { status: 'error', message: 'Maklumat pindahan tidak lengkap atau jumlah tidak sah.' };
  }

  var today = transferData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  var user = transferData.username || transferData.Username || 'user';
  
  // 1. Record Outflow from Sender
  handleAddTransaction({
    Username: user,
    Type: 'expense',
    Date: today,
    Category: 'Pindahan Keluar',
    Method: 'Online Transfer',
    Source: fromName || fromId,
    Amount: amount,
    Note: transferData.note || ('Pindahan dana ke ' + (toName || toId))
  });

  // 2. Record Inflow to Receiver
  handleAddTransaction({
    Username: user,
    Type: 'income',
    Date: today,
    Category: 'Pindahan Masuk',
    Method: 'Online Transfer',
    Source: toName || toId,
    Amount: amount,
    Note: transferData.note || ('Pindahan dana dari ' + (fromName || fromId))
  });

  addAuditLog('TRANSFER_FUNDS', 'Pindahan dana RM ' + amount + ' dari ' + (fromName || fromId) + ' ke ' + (toName || toId), user);
  return { status: 'success', message: 'Pindahan dana RM ' + amount + ' berjaya diproses dan direkodkan ke Google Sheets.' };
}

function handleUpdateTransaction(tx) {
  if (!tx || (!tx.id && !tx.TxID)) {
    return { status: 'error', message: 'ID transaksi diperlukan.' };
  }

  var txId = String(tx.TxID || tx.id).trim();
  var ss = getSpreadsheet();
  var txSheet = getTransactionsSheet(ss);
  if (!txSheet) return { status: 'error', message: 'Sheet Transactions tidak dijumpai.' };

  var data = txSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('TxID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === txId) {
      var rowNum = i + 1;
      for (var h = 0; h < headers.length; h++) {
        var key = headers[h];
        var val = tx[key];
        if (val === undefined) {
          if (key === 'Amount') val = tx.amount;
          if (key === 'Type') val = tx.type;
          if (key === 'Date') val = tx.date;
          if (key === 'Category') val = tx.category;
          if (key === 'Method') val = tx.payment_method || tx.method;
          if (key === 'Source') val = tx.account_name || tx.source;
          if (key === 'Note') val = tx.note;
        }
        if (val !== undefined) {
          txSheet.getRange(rowNum, h + 1).setValue(val);
        }
      }
      addAuditLog('UPDATE_TRANSACTION', 'Kemaskini transaksi: ' + txId);
      return { status: 'success', message: 'Transaksi berjaya dikemaskini.', data: tx };
    }
  }

  return { status: 'error', message: 'Transaksi tidak dijumpai.' };
}

function handleDeleteTransaction(txId) {
  if (!txId) return { status: 'error', message: 'ID transaksi diperlukan.' };

  var ss = getSpreadsheet();
  var txSheet = getTransactionsSheet(ss);
  if (!txSheet) return { status: 'error', message: 'Sheet Transactions tidak dijumpai.' };

  var data = txSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('TxID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  var targetId = String(txId).trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === targetId) {
      txSheet.deleteRow(i + 1);
      addAuditLog('DELETE_TRANSACTION', 'Padam transaksi ID: ' + targetId);
      return { status: 'success', message: 'Transaksi berjaya dipadam dari Google Sheets.' };
    }
  }

  return { status: 'error', message: 'Transaksi tidak dijumpai dalam Google Sheets.' };
}

// ==========================================
// 6. AUTHENTICATION MODULE
// ==========================================

function handleUserLogin(username, password) {
  if (!username) return { status: 'error', message: 'Sila masukkan username.' };
  
  return {
    status: 'success',
    token: 'token_' + username + '_' + new Date().getTime(),
    user: {
      username: username,
      full_name: username === 'admin' ? 'Pentadbir SakuTrack' : username,
      role: username === 'admin' ? 'Owner' : 'Member'
    }
  };
}
