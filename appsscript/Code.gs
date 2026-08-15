/**
 * MyWang - Google Apps Script Backend API
 * One Dashboard. Every Ringgit.
 * 
 * Main Entry Point: Handles GET & POST requests from MyWang Web App
 */

function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || 'ping';

  try {
    var responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'success', message: 'MyWang Google Apps Script API is online!', timestamp: new Date().toISOString() };
        break;

      case 'getDashboard':
        responseData = getDashboardData(params.token);
        break;

      case 'getAccounts':
        responseData = getAccountsList();
        break;

      case 'getTransactions':
        responseData = getTransactionsList(params);
        break;

      case 'getCharts':
        responseData = getChartsData();
        break;

      case 'getCategories':
        responseData = getCategoriesData();
        break;

      case 'getUsers':
        responseData = getUsersList();
        break;

      case 'getLogs':
        responseData = getAuditLogsList();
        break;

      default:
        responseData = { status: 'error', message: 'Unknown GET action: ' + action };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : '{}';
    var payload = JSON.parse(contents);
    var action = payload.action;
    var data = payload.data || {};
    var responseData = {};

    switch (action) {
      case 'loginUser':
        responseData = handleUserLogin(data.username, data.password);
        break;

      case 'syncDashboard':
        responseData = handleSyncDashboard(data);
        break;

      case 'saveAccount':
      case 'updateBalance':
        responseData = handleSaveAccount(data);
        break;

      case 'addAccount':
        responseData = handleAddAccount(data);
        break;

      case 'deleteAccount':
        responseData = handleDeleteAccount(data.id);
        break;

      case 'addTransaction':
        responseData = handleAddTransaction(data);
        break;

      case 'updateTransaction':
        responseData = handleUpdateTransaction(data);
        break;

      case 'deleteTransaction':
        responseData = handleDeleteTransaction(data.id);
        break;

      case 'saveUser':
        responseData = handleSaveUser(data);
        break;

      case 'deleteUser':
        responseData = handleDeleteUser(data.id);
        break;

      case 'addIncome':
        data.type = 'income';
        responseData = handleAddTransaction(data);
        break;

      case 'addExpense':
        data.type = 'expense';
        responseData = handleAddTransaction(data);
        break;

      case 'transferMoney':
        responseData = handleTransferMoney(data);
        break;

      case 'saveCategory':
        responseData = handleSaveCategory(data);
        break;

      case 'deleteCategory':
        responseData = handleDeleteCategory(data.id, data.type);
        break;

      case 'extractReceiptData':
        responseData = handleExtractReceiptData(data);
        break;

      case 'setupDatabase':
        responseData = initializeDatabaseSheets();
        break;

      default:
        responseData = { status: 'error', message: 'Unknown POST action: ' + action };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
