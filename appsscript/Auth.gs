/**
 * MyWang - Auth Module (Google Apps Script)
 * Secure authentication against USERS sheet
 */

function handleUserLogin(username, password) {
  if (!username || !password) {
    return { status: 'error', message: 'Sila masukkan username dan kata laluan.' };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('USERS');
  
  if (!sheet) {
    // If USERS sheet doesn't exist, create it with default admin
    initializeDatabaseSheets();
    sheet = ss.getSheetByName('USERS');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { status: 'error', message: 'Tiada pengguna dijumpai dalam sistem.' };
  }

  var headers = data[0];
  var idxUser = headers.indexOf('username');
  var idxPass = headers.indexOf('password_hash');
  var idxName = headers.indexOf('full_name');
  var idxEmail = headers.indexOf('email');
  var idxRole = headers.indexOf('role');

  var cleanUsername = String(username).trim().toLowerCase();
  var hashedInput = hashPassword(password);

  for (var i = 1; i < data.length; i++) {
    var rowUser = String(data[i][idxUser] || '').trim().toLowerCase();
    var rowPass = String(data[i][idxPass] || '').trim();

    if (rowUser === cleanUsername) {
      if (rowPass === hashedInput || rowPass === password) {
        var token = generateSessionToken(cleanUsername);
        
        // Log successful login
        addAuditLog('LOGIN', 'Pengguna ' + cleanUsername + ' berjaya log masuk.', cleanUsername);

        return {
          status: 'success',
          token: token,
          user: {
            id: 'usr_' + i,
            username: cleanUsername,
            full_name: data[i][idxName] || cleanUsername,
            email: data[i][idxEmail] || '',
            role: data[i][idxRole] || 'Member',
            currency: 'MYR'
          }
        };
      } else {
        addAuditLog('LOGIN_FAILED', 'Percubaan log masuk gagal untuk: ' + cleanUsername, cleanUsername);
        return { status: 'error', message: 'Kata laluan tidak tepat. Sila cuba lagi.' };
      }
    }
  }

  return { status: 'error', message: 'Username tidak dijumpai dalam pengkalan data.' };
}

function hashPassword(str) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str + "_MYWANG_SALT_2026", Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    var byteString = hashVal.toString(16);
    if (byteString.length == 1) byteString = '0' + byteString;
    txtHash += byteString;
  }
  return txtHash;
}

function generateSessionToken(username) {
  var payload = username + ':' + new Date().getTime() + ':' + Math.random().toString(36).substring(2);
  return Utilities.base64Encode(payload);
}
