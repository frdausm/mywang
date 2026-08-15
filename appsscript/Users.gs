/**
 * MyWang - Users Management Module (Google Apps Script)
 * Manages user accounts in the USERS tab of Google Sheets
 */

function getUsersList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('USERS');
  if (!sheet) {
    initializeDatabaseSheets();
    sheet = ss.getSheetByName('USERS');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'success', data: [] };

  var headers = data[0];
  var users = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;

    var userObj = {};
    for (var h = 0; h < headers.length; h++) {
      // Exclude password_hash from general user list for security
      if (headers[h] !== 'password_hash') {
        userObj[headers[h]] = row[h];
      }
    }
    users.push(userObj);
  }

  return { status: 'success', data: users };
}

function handleSaveUser(userData) {
  if (!userData || !userData.username) {
    return { status: 'error', message: 'Username diperlukan.' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('USERS');
  if (!sheet) {
    initializeDatabaseSheets();
    sheet = ss.getSheetByName('USERS');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx = headers.indexOf('id');
  var userIdx = headers.indexOf('username');
  var passIdx = headers.indexOf('password_hash');
  var nameIdx = headers.indexOf('full_name');
  var emailIdx = headers.indexOf('email');
  var roleIdx = headers.indexOf('role');

  var cleanUser = String(userData.username).trim().toLowerCase();
  var existingRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][userIdx]).toLowerCase() === cleanUser || (userData.id && String(data[i][idIdx]) === String(userData.id))) {
      existingRow = i + 1;
      break;
    }
  }

  var nowIso = new Date().toISOString();

  if (existingRow > 0) {
    // Update existing user
    if (userData.full_name !== undefined) sheet.getRange(existingRow, nameIdx + 1).setValue(userData.full_name);
    if (userData.email !== undefined) sheet.getRange(existingRow, emailIdx + 1).setValue(userData.email);
    if (userData.role !== undefined) sheet.getRange(existingRow, roleIdx + 1).setValue(userData.role);
    if (userData.password) {
      sheet.getRange(existingRow, passIdx + 1).setValue(hashPassword(userData.password));
    }
    addAuditLog('UPDATE_USER', 'Maklumat pengguna dikemaskini: ' + cleanUser);
    return { status: 'success', message: 'Pengguna berjaya dikemaskini.' };
  } else {
    // Insert new user
    var newId = userData.id || ('usr_' + new Date().getTime());
    var passwordHash = hashPassword(userData.password || 'mywang123');
    var rowData = [
      newId,
      cleanUser,
      passwordHash,
      userData.full_name || cleanUser,
      userData.email || '',
      userData.role || 'Member',
      nowIso
    ];
    sheet.appendRow(rowData);
    addAuditLog('ADD_USER', 'Pengguna baru ditambah: ' + cleanUser);
    return { status: 'success', message: 'Pengguna baru berjaya didaftarkan ke tab USERS.' };
  }
}

function handleDeleteUser(userId) {
  if (!userId) return { status: 'error', message: 'ID pengguna diperlukan.' };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('USERS');
  if (!sheet) return { status: 'error', message: 'Tab USERS tidak dijumpai.' };

  var data = sheet.getDataRange().getValues();
  var idIdx = data[0].indexOf('id');
  var userIdx = data[0].indexOf('username');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(userId)) {
      var username = data[i][userIdx];
      sheet.deleteRow(i + 1);
      addAuditLog('DELETE_USER', 'Pengguna dipadam dari tab USERS: ' + username);
      return { status: 'success', message: 'Pengguna berjaya dipadam dari tab USERS.' };
    }
  }

  return { status: 'error', message: 'Pengguna tidak dijumpai.' };
}
