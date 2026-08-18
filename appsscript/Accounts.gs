/**
 * SakuTrack & MyWang - Accounts Module (Google Apps Script)
 * Manages bank accounts, e-wallets, credit cards, paylater
 * Preserves 100% compatibility with original SakuTrack sheet structure
 */

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
    // If username filtering is provided and doesn't match and not empty, skip
    if (filterUser && rowUser && rowUser !== filterUser && rowUser !== 'user' && rowUser !== 'admin') {
      // Still include if general accounts
    }

    // Support both SakuTrack & MyWang column names
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
    sheet.getRange(1, 1, 1, 8).setBackground('#004D40').setFontColor('#FFFFFF').setFontWeight('bold');
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
      foundRow = i + 1; // 1-indexed
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
    // Update existing row respecting existing header columns
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
    // Append as new row matching the exact sheet header order
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

