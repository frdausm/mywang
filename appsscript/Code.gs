/**
 * SAKUTRACK & MYWANG - BACKEND SCRIPT TERKINI (STANDALONE Code.gs)
 * Dilengkapi:
 *  1. Anti-Duplicate TxID (Elak baris & baki berganda)
 *  2. Padanan Pintar TNG GO+ (Pelaburan) vs Touch 'n Go eWallet biasa
 *  3. Sokongan transaksi lama & baru (Backward Compatible)
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getDashboard';
    var payload = {};

    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
        if (payload.action) action = payload.action;
      } catch (err) {
        payload = params;
      }
    } else {
      payload = params;
    }

    var data = payload.data || payload;

    switch (action) {
      case 'ping':
        return createJsonResponse({ status: 'success', message: 'SakuTrack API is online!', timestamp: new Date().toISOString() });

      case 'login':
        return createJsonResponse(handleUserLogin(data.username || payload.username, data.password || payload.password));

      case 'getDashboard':
      case 'get_dashboard':
      case 'getInitialData':
      case 'getSyncData':
      case 'sync':
      case 'read':
        var limit = Number(data.limit || payload.limit || params.limit || 25);
        var accs = getAccountsList().data || [];
        var txs = getTransactionsList({ limit: limit, username: data.username || payload.username || params.username }).data || [];
        var balancesMap = {};
        for (var b = 0; b < accs.length; b++) {
          balancesMap[accs[b].id || accs[b].AccountID || accs[b].name] = accs[b].balance;
        }
        return createJsonResponse({
          status: 'success',
          version: '2.0',
          serverTime: new Date().toISOString(),
          accounts: accs,
          transactions: txs,
          balances: balancesMap,
          data: { accounts: accs, transactions: txs, balances: balancesMap }
        });

      case 'getAccounts':
      case 'get_accounts':
        return createJsonResponse(getAccountsList());

      case 'getTransactions':
      case 'get_transactions':
        var txLimit = Number(data.limit || payload.limit || params.limit || 25);
        return createJsonResponse(getTransactionsList({ limit: txLimit, username: data.username || payload.username || params.username }));

      case 'saveAccount':
      case 'updateAccount':
      case 'addAccount':
      case 'save_account':
        return createJsonResponse(handleSaveAccount(data));

      case 'deleteAccount':
      case 'delete_account':
        return createJsonResponse(handleDeleteAccount(data.AccountID || data.id || payload.AccountID || payload.id));

      case 'addTransaction':
      case 'append_transaction':
      case 'add_transaction':
        return createJsonResponse(handleAddTransaction(data));

      case 'updateTransaction':
      case 'update_transaction':
        return createJsonResponse(handleUpdateTransaction(data));

      case 'deleteTransaction':
      case 'delete_transaction':
        return createJsonResponse(handleDeleteTransaction(data.TxID || data.id || payload.TxID || payload.id));

      case 'transferMoney':
      case 'transfer_funds':
        return createJsonResponse(handleTransferMoney(data));

      default:
        var defAccs = getAccountsList().data || [];
        var defTxs = getTransactionsList().data || [];
        return createJsonResponse({ status: 'success', accounts: defAccs, transactions: defTxs });
    }
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAccountsSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Accounts') || ss.getSheetByName('ACCOUNTS') || ss.getSheetByName('accounts');
}

function getTransactionsSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Transactions') || ss.getSheetByName('TRANSACTIONS') || ss.getSheetByName('transactions');
}

function getAccountsList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getAccountsSheet(ss);
  if (!sheet || sheet.getLastRow() <= 1) return { status: 'success', data: [], accounts: [] };

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var accounts = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[2]) continue;
    
    var acc = {};
    for (var h = 0; h < headers.length; h++) acc[headers[h]] = row[h];

    var id = acc.AccountID || acc.id || acc.account_id || ('ACC_' + i);
    var name = acc.AccountName || acc.account_name || acc.bank || acc.name || ('Akaun ' + i);
    var type = acc.AccountType || acc.type || 'Bank';
    var bal = Number(acc.InitialBalance !== undefined ? acc.InitialBalance : (acc.balance !== undefined ? acc.balance : acc.Balance)) || 0;

    accounts.push({
      id: String(id),
      AccountID: String(id),
      account_id: String(id),
      Username: acc.Username || acc.username || 'user',
      bank: acc.Bank || acc.bank || name,
      account_name: name,
      AccountName: name,
      name: name,
      type: type,
      AccountType: type,
      balance: bal,
      InitialBalance: bal,
      notes: acc.Notes || acc.notes || '',
      account_number: String(acc.AccountNumber || acc.account_number || ''),
      created_at: acc.CreatedAt || acc.created_at || ''
    });
  }

  return { status: 'success', data: accounts, accounts: accounts };
}

function handleSaveAccount(accountData) {
  if (!accountData) return { status: 'error', message: 'Data akaun diperlukan.' };
  var accId = String(accountData.AccountID || accountData.id || accountData.account_id || ('ACC_' + new Date().getTime()));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getAccountsSheet(ss) || ss.insertSheet('Accounts');

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('AccountID');
  if (idIdx === -1) idIdx = headers.indexOf('id');
  if (idIdx === -1) idIdx = 0;

  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === accId) {
      foundRow = i + 1;
      break;
    }
  }

  var accName = accountData.AccountName || accountData.account_name || accountData.name || 'Akaun';
  var accBal = Number(accountData.InitialBalance !== undefined ? accountData.InitialBalance : (accountData.balance !== undefined ? accountData.balance : 0));
  var accType = accountData.AccountType || accountData.type || 'Bank';
  var accNotes = accountData.Notes || accountData.notes || '';
  var accNum = accountData.AccountNumber || accountData.account_number || '';
  var nowIso = new Date().toISOString();

  if (foundRow > 0) {
    for (var h = 0; h < headers.length; h++) {
      var k = headers[h];
      if (k === 'AccountName' || k === 'account_name') sheet.getRange(foundRow, h + 1).setValue(accName);
      else if (k === 'InitialBalance' || k === 'balance') sheet.getRange(foundRow, h + 1).setValue(accBal);
      else if (k === 'AccountType' || k === 'type') sheet.getRange(foundRow, h + 1).setValue(accType);
      else if (k === 'Notes' || k === 'notes') sheet.getRange(foundRow, h + 1).setValue(accNotes);
      else if (k === 'AccountNumber' || k === 'account_number') sheet.getRange(foundRow, h + 1).setValue(accNum);
    }
  } else {
    sheet.appendRow([accId, accountData.username || 'user', accName, accType, accBal, accNum, accNotes, nowIso]);
  }

  return { status: 'success', message: 'Akaun berjaya disimpan.', id: accId };
}

function handleDeleteAccount(accountId) {
  if (!accountId) return { status: 'error', message: 'ID akaun diperlukan.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getAccountsSheet(ss);
  if (!sheet) return { status: 'error', message: 'Sheet Accounts tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('AccountID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === String(accountId).trim()) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Akaun berjaya dipadam.' };
    }
  }
  return { status: 'error', message: 'Akaun tidak dijumpai.' };
}

function getTransactionsList(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTransactionsSheet(ss);
  if (!sheet) return { status: 'success', data: [], transactions: [] };
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status: 'success', data: [], transactions: [] };

  var limit = (params && params.limit) ? Number(params.limit) : 25;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
  
  // Read only the necessary row range (last 25 to 50 rows) for optimal speed
  var rowsToFetch = Math.min(lastRow - 1, limit * 2);
  var startRow = Math.max(2, lastRow - rowsToFetch + 1);
  var data = sheet.getRange(startRow, 1, rowsToFetch, headers.length).getValues();

  var transactions = [];
  var seenIds = {};

  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    if (!row[0] && !row[7]) continue;
    var tx = {};
    for (var h = 0; h < headers.length; h++) tx[headers[h]] = row[h];

    var txId = String(tx.TxID || tx.id || ('Tx_' + (startRow + i))).trim();
    if (seenIds[txId]) continue;
    seenIds[txId] = true;

    transactions.push({
      id: String(txId),
      TxID: String(txId),
      username: tx.Username || tx.username || 'user',
      type: String(tx.Type || tx.type || 'expense').toLowerCase(),
      date: String(tx.Date || tx.date || ''),
      category: tx.Category || tx.category || 'Lain-lain',
      payment_method: tx.Method || tx.method || tx.payment_method || 'Online Transfer',
      account_name: tx.Source || tx.source || tx.account_name || 'Tunai',
      amount: Number(tx.Amount !== undefined ? tx.Amount : (tx.amount || 0)) || 0,
      note: tx.Note || tx.note || '',
      created_at: tx.CreatedAt || tx.created_at || ''
    });

    if (transactions.length >= limit) {
      break;
    }
  }

  return { status: 'success', data: transactions, transactions: transactions };
}

function handleAddTransaction(tx) {
  if (!tx || (tx.amount === undefined && tx.Amount === undefined)) {
    return { status: 'error', message: 'Jumlah transaksi diperlukan.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var txSheet = getTransactionsSheet(ss) || ss.insertSheet('Transactions');
  var accSheet = getAccountsSheet(ss);

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
  var txReceipt = tx.ReceiptURL || tx.receipt_url || '';
  var nowIso = new Date().toISOString();

  var data = txSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });

  // 1. DEDUPLICATION CHECK: Elakkan duplikasi TxID
  var txIdCol = headers.indexOf('TxID');
  if (txIdCol === -1) txIdCol = headers.indexOf('id');
  if (txIdCol !== -1 && data.length > 1) {
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][txIdCol]).trim() === String(txId).trim()) {
        return { status: 'success', message: 'Transaksi dengan ID ini sudah direkodkan (tiada duplikasi).', id: txId };
      }
    }
  }

  // 2. Tambah baris baru
  txSheet.appendRow([txId, txUser, txType, txDate, txCat, txMethod, txSource, txAmount, txDisc, txNote, txReceipt, nowIso]);

  // 3. Kemaskini Baki Akaun Secara Automatik
  if (accSheet && accSheet.getLastRow() > 1) {
    var accData = accSheet.getDataRange().getValues();
    var accHeaders = accData[0].map(function(h) { return String(h || '').trim(); });
    var idIdx = accHeaders.indexOf('AccountID');
    if (idIdx === -1) idIdx = accHeaders.indexOf('id');
    var nameIdx = accHeaders.indexOf('AccountName');
    if (nameIdx === -1) nameIdx = accHeaders.indexOf('account_name');
    var balIdx = accHeaders.indexOf('InitialBalance');
    if (balIdx === -1) balIdx = accHeaders.indexOf('balance');

    var matchedRow = -1;
    var searchSource = String(txSource).trim().toLowerCase();
    
    // Pengesanan khusus GO+
    var isGoPlusTx = searchSource.indexOf('go+') !== -1 || 
                     searchSource.indexOf('goplus') !== -1 || 
                     searchSource.indexOf('pelaburan') !== -1 ||
                     searchSource.indexOf('acc_1786841487737') !== -1 ||
                     searchSource.indexOf('tng go') !== -1;

    // Pass 1: Padanan Tepat ID atau Nama
    for (var a = 1; a < accData.length; a++) {
      var existingAccId = String(accData[a][idIdx] || '').trim().toLowerCase();
      var existingAccName = nameIdx !== -1 ? String(accData[a][nameIdx] || '').trim().toLowerCase() : '';

      if (existingAccId === searchSource || existingAccName === searchSource) {
        matchedRow = a;
        break;
      }
      if (searchSource === (existingAccName + ' - ' + existingAccName)) {
        matchedRow = a;
        break;
      }
    }

    // Pass 2: Padanan Pintar TNG GO+ (Pelaburan) vs Touch 'n Go eWallet
    if (matchedRow === -1) {
      for (var a = 1; a < accData.length; a++) {
        var existingAccId = String(accData[a][idIdx] || '').trim().toLowerCase();
        var existingAccName = nameIdx !== -1 ? String(accData[a][nameIdx] || '').trim().toLowerCase() : '';
        
        var isGoPlusAcc = existingAccName.indexOf('go+') !== -1 || 
                          existingAccName.indexOf('goplus') !== -1 || 
                          existingAccName.indexOf('pelaburan') !== -1 || 
                          existingAccId === 'acc_1786841487737';

        if (isGoPlusTx) {
          if (isGoPlusAcc) {
            matchedRow = a;
            break;
          }
        } else {
          // Transaksi TNG biasa (bukan GO+)
          if (!isGoPlusAcc && (existingAccName && (searchSource.indexOf(existingAccName) !== -1 || existingAccName.indexOf(searchSource) !== -1))) {
            matchedRow = a;
            break;
          }
        }
      }
    }

    if (matchedRow !== -1 && balIdx !== -1) {
      var curBal = Number(accData[matchedRow][balIdx]) || 0;
      var updatedBal = (txType === 'income') ? (curBal + txAmount) : (curBal - txAmount);
      accSheet.getRange(matchedRow + 1, balIdx + 1).setValue(updatedBal);
    }
  }

  return { status: 'success', message: 'Transaksi berjaya ditambah.', id: txId };
}

function handleTransferMoney(transferData) {
  var fromName = transferData.from_account_name || transferData.from_account || 'Maybank';
  var toName = transferData.to_account_name || transferData.to_account || 'TNG GO+ (Pelaburan)';
  var amount = Number(transferData.amount) || 0;
  var user = transferData.username || 'user';
  var date = transferData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');

  if (amount <= 0) return { status: 'error', message: 'Jumlah tidak sah.' };

  handleAddTransaction({
    Username: user,
    Type: 'expense',
    Date: date,
    Category: 'Pindahan Keluar',
    Method: 'Online Transfer',
    Source: fromName,
    Amount: amount,
    Note: transferData.note || ('Pindahan ke ' + toName)
  });

  handleAddTransaction({
    Username: user,
    Type: 'income',
    Date: date,
    Category: 'Pindahan Masuk',
    Method: 'Online Transfer',
    Source: toName,
    Amount: amount,
    Note: transferData.note || ('Pindahan dari ' + fromName)
  });

  return { status: 'success', message: 'Pindahan dana berjaya direkodkan.' };
}

function handleDeleteTransaction(txId) {
  if (!txId) return { status: 'error', message: 'ID transaksi diperlukan.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTransactionsSheet(ss);
  if (!sheet) return { status: 'error', message: 'Sheet Transactions tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('TxID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === String(txId).trim()) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Transaksi berjaya dipadam.' };
    }
  }
  return { status: 'error', message: 'Transaksi tidak dijumpai.' };
}

function handleUserLogin(username, password) {
  return {
    status: 'success',
    token: 'token_' + username + '_' + new Date().getTime(),
    user: {
      username: username || 'user',
      full_name: username === 'admin' ? 'Pentadbir SakuTrack' : (username || 'user'),
      role: 'Owner'
    }
  };
}
