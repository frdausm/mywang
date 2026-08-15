/**
 * MyWang - Transactions Module (Google Apps Script)
 * Manages income, expenses, dual-entry transfers, and transactions
 */

function getTransactionsList(params) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('TRANSACTIONS');
  if (!sheet) {
    initializeDatabaseSheets();
    sheet = ss.getSheetByName('TRANSACTIONS');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [] };

  var headers = data[0];
  var transactions = [];

  for (var i = data.length - 1; i >= 1; i--) { // Reverse order (newest first)
    var row = data[i];
    if (!row[0]) continue;
    
    var tx = {};
    for (var h = 0; h < headers.length; h++) {
      tx[headers[h]] = row[h];
    }
    tx.amount = Number(tx.amount) || 0;
    transactions.push(tx);
  }

  return { status: 'success', data: transactions };
}

function handleAddTransaction(tx) {
  if (!tx || !tx.amount) {
    return { status: 'error', message: 'Jumlah transaksi diperlukan.' };
  }

  var ss = getSpreadsheet();
  var txSheet = ss.getSheetByName('TRANSACTIONS');
  var accSheet = ss.getSheetByName('ACCOUNTS');

  if (!tx.id) tx.id = 'tx_' + new Date().getTime();
  if (!tx.date) tx.date = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  if (!tx.created_at) tx.created_at = new Date().toISOString();

  var headers = txSheet.getDataRange().getValues()[0];
  var newRow = headers.map(function(k) {
    return tx[k] !== undefined ? tx[k] : '';
  });

  txSheet.appendRow(newRow);

  // Update Account Balance automatically
  var amount = Number(tx.amount);
  var accData = accSheet.getDataRange().getValues();
  var accHeaders = accData[0];
  var accIdIdx = accHeaders.indexOf('id');
  var balIdx = accHeaders.indexOf('balance');

  for (var i = 1; i < accData.length; i++) {
    if (String(accData[i][accIdIdx]) === String(tx.account_id)) {
      var currentBal = Number(accData[i][balIdx]) || 0;
      var newBal = currentBal;

      if (tx.type === 'income') {
        newBal = currentBal + amount;
      } else if (tx.type === 'expense') {
        newBal = currentBal - amount;
      }

      accSheet.getRange(i + 1, balIdx + 1).setValue(newBal);
      break;
    }
  }

  addAuditLog('ADD_TRANSACTION', 'Transaksi baru ' + tx.type.toUpperCase() + ' RM ' + tx.amount + ' (' + tx.category + ')');

  return { status: 'success', message: 'Transaksi berjaya direkodkan.', data: tx };
}

function handleTransferMoney(transferData) {
  var fromId = transferData.from_account_id;
  var toId = transferData.to_account_id;
  var amount = Number(transferData.amount);

  if (!fromId || !toId || !amount || amount <= 0) {
    return { status: 'error', message: 'Maklumat akaun sumber, sasaran dan jumlah diperlukan.' };
  }

  if (fromId === toId) {
    return { status: 'error', message: 'Akaun sumber dan sasaran tidak boleh sama.' };
  }

  var ss = getSpreadsheet();
  var accSheet = ss.getSheetByName('ACCOUNTS');
  var txSheet = ss.getSheetByName('TRANSACTIONS');
  var tfSheet = ss.getSheetByName('TRANSFERS');

  var accData = accSheet.getDataRange().getValues();
  var accHeaders = accData[0];
  var idIdx = accHeaders.indexOf('id');
  var nameIdx = accHeaders.indexOf('account_name');
  var bankIdx = accHeaders.indexOf('bank');
  var balIdx = accHeaders.indexOf('balance');

  var fromRow = -1;
  var toRow = -1;
  var fromName = '';
  var toName = '';

  for (var i = 1; i < accData.length; i++) {
    if (String(accData[i][idIdx]) === String(fromId)) {
      fromRow = i + 1;
      fromName = (accData[i][bankIdx] + ' - ' + accData[i][nameIdx]);
    }
    if (String(accData[i][idIdx]) === String(toId)) {
      toRow = i + 1;
      toName = (accData[i][bankIdx] + ' - ' + accData[i][nameIdx]);
    }
  }

  if (fromRow === -1 || toRow === -1) {
    return { status: 'error', message: 'Salah satu akaun tidak dijumpai.' };
  }

  // Update Balances
  var fromCurBal = Number(accData[fromRow - 1][balIdx]) || 0;
  var toCurBal = Number(accData[toRow - 1][balIdx]) || 0;

  accSheet.getRange(fromRow, balIdx + 1).setValue(fromCurBal - amount);
  accSheet.getRange(toRow, balIdx + 1).setValue(toCurBal + amount);

  // Record Transaction
  var today = transferData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  var txId = 'tx_tf_' + new Date().getTime();

  var txHeaders = txSheet.getDataRange().getValues()[0];
  var txObj = {
    id: txId,
    date: today,
    account_id: fromId,
    account_name: fromName,
    to_account_id: toId,
    to_account_name: toName,
    type: 'transfer',
    category: 'Transfer',
    amount: amount,
    note: transferData.note || ('Pindahan dari ' + fromName + ' ke ' + toName),
    created_at: new Date().toISOString()
  };

  var newTxRow = txHeaders.map(function(k) { return txObj[k] !== undefined ? txObj[k] : ''; });
  txSheet.appendRow(newTxRow);

  if (tfSheet) {
    var tfHeaders = tfSheet.getDataRange().getValues()[0];
    var tfObj = {
      id: 'tf_' + new Date().getTime(),
      date: today,
      from_account: fromName,
      to_account: toName,
      amount: amount,
      note: transferData.note || '',
      created_at: new Date().toISOString()
    };
    var newTfRow = tfHeaders.map(function(k) { return tfObj[k] !== undefined ? tfObj[k] : ''; });
    tfSheet.appendRow(newTfRow);
  }

  addAuditLog('TRANSFER', 'Pindahan RM ' + amount + ' dari ' + fromName + ' ke ' + toName);

  return { status: 'success', message: 'Pindahan dana RM ' + amount + ' berjaya.', transaction: txObj };
}

function handleUpdateTransaction(tx) {
  if (!tx || !tx.id) {
    return { status: 'error', message: 'ID transaksi diperlukan.' };
  }

  var ss = getSpreadsheet();
  var txSheet = ss.getSheetByName('TRANSACTIONS');
  var data = txSheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(tx.id)) {
      var rowNum = i + 1;
      for (var h = 0; h < headers.length; h++) {
        var key = headers[h];
        if (tx[key] !== undefined && key !== 'id') {
          txSheet.getRange(rowNum, h + 1).setValue(tx[key]);
        }
      }
      addAuditLog('UPDATE_TRANSACTION', 'Kemaskini transaksi: ' + (tx.category || '') + ' RM ' + (tx.amount || ''));
      return { status: 'success', message: 'Transaksi berjaya dikemaskini.', data: tx };
    }
  }

  return { status: 'error', message: 'Transaksi tidak dijumpai.' };
}

function handleDeleteTransaction(txId) {
  if (!txId) return { status: 'error', message: 'ID transaksi diperlukan.' };

  var ss = getSpreadsheet();
  var txSheet = ss.getSheetByName('TRANSACTIONS');
  var data = txSheet.getDataRange().getValues();
  var idIdx = data[0].indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(txId)) {
      txSheet.deleteRow(i + 1);
      addAuditLog('DELETE_TRANSACTION', 'Padam transaksi ID: ' + txId);
      return { status: 'success', message: 'Transaksi berjaya dipadam.' };
    }
  }

  return { status: 'error', message: 'Transaksi tidak dijumpai.' };
}
