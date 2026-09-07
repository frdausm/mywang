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
  var limit = (params && params.limit) ? Number(params.limit) : 25;

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

function findAccountRowIndex(accData, headers, searchKey) {
  if (!searchKey || accData.length <= 1) return -1;
  var target = String(searchKey).trim().toLowerCase();
  var idIdx = headers.indexOf('AccountID');
  if (idIdx === -1) idIdx = headers.indexOf('id');
  var nameIdx = headers.indexOf('AccountName');
  if (nameIdx === -1) nameIdx = headers.indexOf('account_name');
  if (nameIdx === -1) nameIdx = headers.indexOf('bank');

  for (var i = 1; i < accData.length; i++) {
    var aId = idIdx !== -1 ? String(accData[i][idIdx] || '').trim().toLowerCase() : '';
    var aName = nameIdx !== -1 ? String(accData[i][nameIdx] || '').trim().toLowerCase() : '';
    if (aId === target || aName === target || target === (aName + ' - ' + aName)) {
      return i;
    }
  }

  var isGoPlus = target.indexOf('go+') !== -1 || target.indexOf('goplus') !== -1 || target.indexOf('pelaburan') !== -1 || target.indexOf('acc_1786841487737') !== -1;
  for (var i = 1; i < accData.length; i++) {
    var aId = idIdx !== -1 ? String(accData[i][idIdx] || '').trim().toLowerCase() : '';
    var aName = nameIdx !== -1 ? String(accData[i][nameIdx] || '').trim().toLowerCase() : '';
    var isAccGoPlus = aName.indexOf('go+') !== -1 || aName.indexOf('goplus') !== -1 || aName.indexOf('pelaburan') !== -1 || aId === 'acc_1786841487737';
    if (isGoPlus && isAccGoPlus) return i;
    if (!isGoPlus && !isAccGoPlus && (target.indexOf(aName) !== -1 || aName.indexOf(target) !== -1 || target.indexOf(aId) !== -1)) {
      return i;
    }
  }
  return -1;
}

function handleTransferMoney(transferData) {
  if (!transferData) return { status: 'error', message: 'Maklumat pindahan diperlukan.' };

  var amount = Number(transferData.amount) || 0;
  if (amount <= 0) {
    return { status: 'error', message: 'Jumlah pindahan tidak sah.' };
  }

  var fromName = String(transferData.from_account_name || transferData.from_bank || transferData.from_account || transferData.from || 'Maybank').trim();
  var fromId = String(transferData.from_account_id || transferData.from || '').trim();
  var toName = String(transferData.to_account_name || transferData.to_bank || transferData.to_account || transferData.to || 'Touch \'n Go eWallet').trim();
  var toId = String(transferData.to_account_id || transferData.to || '').trim();
  var userNote = String(transferData.note || '').trim();

  var txId = String(transferData.TxID || transferData.id || transferData.txId || ('tf_' + new Date().getTime())).trim();
  var user = transferData.username || 'user';
  var date = transferData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');

  var ss = getSpreadsheet();
  var txSheet = getTransactionsSheet(ss);
  var accSheet = getAccountsSheet(ss);

  // 1. Update Accounts sheet atomically
  if (accSheet) {
    var accData = accSheet.getDataRange().getValues();
    var accHeaders = accData[0].map(function(h) { return String(h || '').trim(); });
    var balIdx = accHeaders.indexOf('InitialBalance');
    if (balIdx === -1) balIdx = accHeaders.indexOf('balance');
    if (balIdx === -1) balIdx = accHeaders.indexOf('Balance');

    if (balIdx !== -1) {
      var fromRow = findAccountRowIndex(accData, accHeaders, fromId);
      if (fromRow === -1) fromRow = findAccountRowIndex(accData, accHeaders, fromName);

      var toRow = findAccountRowIndex(accData, accHeaders, toId);
      if (toRow === -1) toRow = findAccountRowIndex(accData, accHeaders, toName);

      if (fromRow !== -1) {
        var curFrom = Number(accData[fromRow][balIdx]) || 0;
        var newFrom = (transferData.from_balance !== undefined && !isNaN(Number(transferData.from_balance)))
          ? Number(transferData.from_balance)
          : (Math.round((curFrom - amount) * 100) / 100);
        accSheet.getRange(fromRow + 1, balIdx + 1).setValue(newFrom);
      }

      if (toRow !== -1) {
        var curTo = Number(accData[toRow][balIdx]) || 0;
        var newTo = (transferData.to_balance !== undefined && !isNaN(Number(transferData.to_balance)))
          ? Number(transferData.to_balance)
          : (Math.round((curTo + amount) * 100) / 100);
        accSheet.getRange(toRow + 1, balIdx + 1).setValue(newTo);
      }
    }
  }

  // 2. Write SINGLE transfer record to Transactions sheet
  var txData = txSheet.getDataRange().getValues();
  var txHeaders = txData[0].map(function(h) { return String(h || '').trim(); });
  var idCol = txHeaders.indexOf('TxID');
  if (idCol === -1) idCol = txHeaders.indexOf('id');

  var existingTxRow = -1;
  if (idCol !== -1 && txData.length > 1) {
    for (var r = 1; r < txData.length; r++) {
      if (String(txData[r][idCol]).trim() === txId) {
        existingTxRow = r + 1;
        break;
      }
    }
  }

  var formattedNote = userNote;
  if (formattedNote.indexOf('[Ke:') === -1) {
    formattedNote = '[Ke: ' + toName + '] ' + (userNote || ('Pindahan dari ' + fromName));
  }

  var rowMap = {
    'TxID': txId,
    'id': txId,
    'Username': user,
    'username': user,
    'Type': 'transfer',
    'type': 'transfer',
    'Date': date,
    'date': date,
    'Category': 'Pindahan Dana',
    'category': 'Pindahan Dana',
    'Method': 'Online Transfer',
    'method': 'Online Transfer',
    'Source': fromName,
    'source': fromName,
    'ToAccount': toName,
    'to_account': toName,
    'Amount': amount,
    'amount': amount,
    'Discount': 0,
    'discount': 0,
    'Note': formattedNote,
    'note': formattedNote,
    'ReceiptURL': '',
    'receipt_url': '',
    'CreatedAt': new Date().toISOString(),
    'created_at': new Date().toISOString()
  };

  if (existingTxRow !== -1) {
    for (var h = 0; h < txHeaders.length; h++) {
      var colName = txHeaders[h];
      if (rowMap[colName] !== undefined) {
        txSheet.getRange(existingTxRow, h + 1).setValue(rowMap[colName]);
      }
    }
  } else {
    var newRow = [];
    for (var h = 0; h < txHeaders.length; h++) {
      var colName = txHeaders[h];
      newRow.push(rowMap[colName] !== undefined ? rowMap[colName] : '');
    }
    txSheet.appendRow(newRow);
  }

  addAuditLog('TRANSFER', 'Pindahan RM ' + amount.toFixed(2) + ' dari ' + fromName + ' ke ' + toName);

  return {
    status: 'success',
    message: 'Pindahan dana RM ' + amount.toFixed(2) + ' berjaya.',
    id: txId,
    txId: txId,
    data: {
      id: txId,
      type: 'transfer',
      category: 'Pindahan Dana',
      from_account_name: fromName,
      to_account_name: toName,
      amount: amount,
      date: date,
      note: formattedNote
    }
  };
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

  var txData = txSheet.getDataRange().getValues();
  var txHeaders = txData[0].map(function(h) { return String(h || '').trim(); });
  var idIdx = txHeaders.indexOf('TxID');
  if (idIdx === -1) idIdx = txHeaders.indexOf('id');
  if (idIdx === -1) return { status: 'error', message: 'Kolum TxID tidak dijumpai.' };

  var typeIdx = txHeaders.indexOf('Type');
  if (typeIdx === -1) typeIdx = txHeaders.indexOf('type');
  var amtIdx = txHeaders.indexOf('Amount');
  if (amtIdx === -1) amtIdx = txHeaders.indexOf('amount');
  var srcIdx = txHeaders.indexOf('Source');
  if (srcIdx === -1) srcIdx = txHeaders.indexOf('source');
  var noteIdx = txHeaders.indexOf('Note');
  if (noteIdx === -1) noteIdx = txHeaders.indexOf('note');

  var accSheet = getAccountsSheet(ss);
  var targetId = String(txId).trim();

  for (var i = 1; i < txData.length; i++) {
    if (String(txData[i][idIdx]).trim() === targetId) {
      var row = txData[i];
      var txType = typeIdx !== -1 ? String(row[typeIdx] || '').toLowerCase() : 'expense';
      var txAmt = amtIdx !== -1 ? (Number(row[amtIdx]) || 0) : 0;
      var txSrc = srcIdx !== -1 ? String(row[srcIdx] || '').trim() : '';
      var txNote = noteIdx !== -1 ? String(row[noteIdx] || '').trim() : '';

      // Revert balances
      if (accSheet && txAmt > 0) {
        var accData = accSheet.getDataRange().getValues();
        var accHeaders = accData[0].map(function(h) { return String(h || '').trim(); });
        var balIdx = accHeaders.indexOf('InitialBalance');
        if (balIdx === -1) balIdx = accHeaders.indexOf('balance');
        if (balIdx === -1) balIdx = accHeaders.indexOf('Balance');

        if (balIdx !== -1) {
          if (txType === 'transfer') {
            var fromRow = findAccountRowIndex(accData, accHeaders, txSrc);
            if (fromRow !== -1) {
              var curFrom = Number(accData[fromRow][balIdx]) || 0;
              accSheet.getRange(fromRow + 1, balIdx + 1).setValue(Math.round((curFrom + txAmt) * 100) / 100);
            }

            var toAccName = '';
            var toIdx = txHeaders.indexOf('ToAccount');
            if (toIdx !== -1 && row[toIdx]) toAccName = String(row[toIdx]).trim();
            if (!toAccName && txNote.indexOf('[Ke:') !== -1) {
              var m = txNote.match(/\[Ke:\s*([^\]]+)\]/);
              if (m && m[1]) toAccName = m[1].trim();
            }

            if (toAccName) {
              var toRow = findAccountRowIndex(accData, accHeaders, toAccName);
              if (toRow !== -1) {
                var curTo = Number(accData[toRow][balIdx]) || 0;
                accSheet.getRange(toRow + 1, balIdx + 1).setValue(Math.round((curTo - txAmt) * 100) / 100);
              }
            }
          } else if (txType === 'expense') {
            var srcRow = findAccountRowIndex(accData, accHeaders, txSrc);
            if (srcRow !== -1) {
              var cur = Number(accData[srcRow][balIdx]) || 0;
              accSheet.getRange(srcRow + 1, balIdx + 1).setValue(Math.round((cur + txAmt) * 100) / 100);
            }
          } else if (txType === 'income') {
            var srcRow = findAccountRowIndex(accData, accHeaders, txSrc);
            if (srcRow !== -1) {
              var cur = Number(accData[srcRow][balIdx]) || 0;
              accSheet.getRange(srcRow + 1, balIdx + 1).setValue(Math.round((cur - txAmt) * 100) / 100);
            }
          }
        }
      }

      txSheet.deleteRow(i + 1);
      addAuditLog('DELETE_TRANSACTION', 'Padam transaksi ID: ' + targetId + ' & baki diselaraskan.');
      return { status: 'success', message: 'Transaksi berjaya dipadam dari Google Sheets.' };
    }
  }

  return { status: 'error', message: 'Transaksi tidak dijumpai dalam Google Sheets.' };
}

