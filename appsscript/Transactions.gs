/**
 * SakuTrack & MyWang - Transactions Module (Google Apps Script)
 * Manages income, expenses, dual-entry transfers, and transactions
 * Preserves 100% compatibility with original SakuTrack sheet structure
 */

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
  var seenIds = {};
  var seenFp = {};

  var filterUser = params ? (params.username || params.token || '') : '';
  if (filterUser) filterUser = String(filterUser).trim().toLowerCase();

  for (var i = data.length - 1; i >= 1; i--) { // Reverse order (newest first)
    var row = data[i];
    if (!row[0] && !row[7]) continue;
    
    var tx = {};
    for (var h = 0; h < headers.length; h++) {
      tx[headers[h]] = row[h];
    }

    var rowUser = String(tx.Username || tx.username || '').trim().toLowerCase();
    if (filterUser && rowUser && rowUser !== filterUser && rowUser !== 'user' && rowUser !== 'admin') {
      // Still include if general
    }

    var txId = String(tx.TxID || tx.id || tx.txId || ('Tx_' + i)).trim();
    var txType = String(tx.Type || tx.type || 'expense').toLowerCase();
    var txDate = String(tx.Date || tx.date || '');
    var txCategory = String(tx.Category || tx.category || 'Lain-lain');
    var txMethod = String(tx.Method || tx.method || tx.payment_method || 'Online Transfer');
    var txSource = String(tx.Source || tx.source || tx.account_name || tx.bank || 'Tunai');
    var txAmount = Number(tx.Amount !== undefined ? tx.Amount : (tx.amount !== undefined ? tx.amount : 0)) || 0;
    var txDiscount = Number(tx.Discount || tx.discount || 0) || 0;
    var txNote = String(tx.Note || tx.note || '');
    var txReceipt = String(tx.ReceiptURL || tx.receipt_url || tx.receipt || '');
    var txCreated = String(tx.CreatedAt || tx.created_at || '');

    var fp = (txDate.substring(0, 10)) + '|' + txType + '|' + txCategory + '|' + txAmount.toFixed(2) + '|' + txSource.toLowerCase() + '|' + txNote.toLowerCase();

    // Prevent returning duplicate rows
    if (seenIds[txId] || seenFp[fp]) {
      continue;
    }
    seenIds[txId] = true;
    seenFp[fp] = true;

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
    txSheet.getRange(1, 1, 1, 12).setBackground('#004D40').setFontColor('#FFFFFF').setFontWeight('bold');
  }

  var txId = String(tx.TxID || tx.id || ('Tx_' + new Date().getTime())).trim();
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
  var idIdx = headers.indexOf('TxID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  // Check if this transaction already exists in the sheet to prevent duplicate entries
  if (data.length > 1 && idIdx !== -1) {
    for (var r = 1; r < data.length; r++) {
      var existingId = String(data[r][idIdx] || '').trim();
      if (existingId === txId) {
        // Update the existing row instead of adding duplicate row
        var rowNum = r + 1;
        for (var h = 0; h < headers.length; h++) {
          var hName = headers[h];
          var val = tx[hName];
          if (val === undefined) {
            if (hName === 'TxID' || hName === 'id') val = txId;
            else if (hName === 'Amount' || hName === 'amount') val = txAmount;
            else if (hName === 'Type' || hName === 'type') val = txType;
            else if (hName === 'Date' || hName === 'date') val = txDate;
            else if (hName === 'Category' || hName === 'category') val = txCat;
            else if (hName === 'Method' || hName === 'method' || hName === 'payment_method') val = txMethod;
            else if (hName === 'Source' || hName === 'source' || hName === 'account_name' || hName === 'bank') val = txSource;
            else if (hName === 'Note' || hName === 'note') val = txNote;
            else if (hName === 'ReceiptURL' || hName === 'receipt_url' || hName === 'receipt') val = txReceipt || data[r][h];
          }
          if (val !== undefined) {
            txSheet.getRange(rowNum, h + 1).setValue(val);
          }
        }
        return { status: 'success', message: 'Transaksi sedia ada dikemaskini.', data: tx };
      }
    }
  }

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

  // Update Account in Accounts sheet only once when appending
  if (accSheet) {
    var accData = accSheet.getDataRange().getValues();
    if (accData.length > 1) {
      var accHeaders = accData[0].map(function(h) { return String(h || '').trim(); });
      var aIdIdx = accHeaders.indexOf('AccountID');
      if (aIdIdx === -1) aIdIdx = accHeaders.indexOf('id');
      var nameIdx = accHeaders.indexOf('AccountName');
      if (nameIdx === -1) nameIdx = accHeaders.indexOf('account_name');
      var balIdx = accHeaders.indexOf('InitialBalance');
      if (balIdx === -1) balIdx = accHeaders.indexOf('balance');

      for (var a = 1; a < accData.length; a++) {
        var existingAccId = String(accData[a][aIdIdx] || '').trim();
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

/**
 * Deduplicates transactions in the Google Sheet (removes identical or duplicate TxID rows)
 */
function deduplicateSheetTransactions() {
  var ss = getSpreadsheet();
  var txSheet = getTransactionsSheet(ss);
  if (!txSheet) return { status: 'error', message: 'Transactions sheet tidak ditemui' };

  var data = txSheet.getDataRange().getValues();
  if (data.length <= 2) return { status: 'success', message: 'Tiada data bertindan' };

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = headers.indexOf('TxID');
  if (idIdx === -1) idIdx = headers.indexOf('id');

  var seenIds = {};
  var rowsToDelete = [];

  for (var r = 1; r < data.length; r++) {
    var id = idIdx !== -1 ? String(data[r][idIdx] || '').trim() : '';
    if (id && seenIds[id]) {
      rowsToDelete.push(r + 1);
    } else if (id) {
      seenIds[id] = true;
    }
  }

  // Delete from bottom up
  for (var d = rowsToDelete.length - 1; d >= 0; d--) {
    txSheet.deleteRow(rowsToDelete[d]);
  }

  return { status: 'success', removedCount: rowsToDelete.length };
}

function handleTransferMoney(transferData) {
  var fromId = transferData.from_account_id || transferData.from_account || transferData.from;
  var toId = transferData.to_account_id || transferData.to_account || transferData.to;
  var amount = Number(transferData.amount);

  if (!fromId || !toId || !amount || amount <= 0) {
    return { status: 'error', message: 'Maklumat akaun sumber, sasaran dan jumlah diperlukan.' };
  }

  // Record as 2 transactions or transfer
  var today = transferData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  
  // 1. Outflow from source
  handleAddTransaction({
    Type: 'expense',
    Date: today,
    Category: 'Pindahan Keluar',
    Method: 'Online Transfer',
    Source: fromId,
    Amount: amount,
    Note: transferData.note || ('Pindahan ke ' + toId)
  });

  // 2. Inflow to target
  handleAddTransaction({
    Type: 'income',
    Date: today,
    Category: 'Pindahan Masuk',
    Method: 'Online Transfer',
    Source: toId,
    Amount: amount,
    Note: transferData.note || ('Pindahan dari ' + fromId)
  });

  return { status: 'success', message: 'Pindahan dana RM ' + amount + ' berjaya.' };
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

