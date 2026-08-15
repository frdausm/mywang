/**
 * MyWang - Charts & Analytics Module (Google Apps Script)
 * Aggregates financial analytics for Chart.js
 */

function getChartsData() {
  var ss = getSpreadsheet();
  var accSheet = ss.getSheetByName('ACCOUNTS');
  var txSheet = ss.getSheetByName('TRANSACTIONS');

  var accounts = accSheet ? accSheet.getDataRange().getValues() : [];
  var transactions = txSheet ? txSheet.getDataRange().getValues() : [];

  // 1. Money Distribution by Bank
  var bankDistribution = {};
  if (accounts.length > 1) {
    var accHeaders = accounts[0];
    var bankIdx = accHeaders.indexOf('bank');
    var balIdx = accHeaders.indexOf('balance');

    for (var i = 1; i < accounts.length; i++) {
      var bank = accounts[i][bankIdx] || 'Lain-lain';
      var bal = Number(accounts[i][balIdx]) || 0;
      if (bal > 0) {
        bankDistribution[bank] = (bankDistribution[bank] || 0) + bal;
      }
    }
  }

  // 2. Income vs Expense & 30-Day Trend
  var monthlyIncome = 0;
  var monthlyExpense = 0;
  var categoryExpenses = {};
  var dailyCashflow = {};

  if (transactions.length > 1) {
    var txHeaders = transactions[0];
    var typeIdx = txHeaders.indexOf('type');
    var amtIdx = txHeaders.indexOf('amount');
    var catIdx = txHeaders.indexOf('category');
    var dateIdx = txHeaders.indexOf('date');

    var now = new Date();
    var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM');

    for (var j = 1; j < transactions.length; j++) {
      var row = transactions[j];
      var type = String(row[typeIdx]).toLowerCase();
      var amt = Number(row[amtIdx]) || 0;
      var cat = row[catIdx] || 'Lain-lain';
      var dateStr = String(row[dateIdx]);

      if (dateStr.indexOf(currentMonth) === 0) {
        if (type === 'income') monthlyIncome += amt;
        if (type === 'expense') {
          monthlyExpense += amt;
          categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;
        }
      }

      if (dateStr) {
        if (!dailyCashflow[dateStr]) dailyCashflow[dateStr] = { income: 0, expense: 0 };
        if (type === 'income') dailyCashflow[dateStr].income += amt;
        if (type === 'expense') dailyCashflow[dateStr].expense += amt;
      }
    }
  }

  return {
    status: 'success',
    data: {
      bankDistribution: bankDistribution,
      monthlySummary: {
        income: monthlyIncome,
        expense: monthlyExpense,
        net: monthlyIncome - monthlyExpense
      },
      categoryExpenses: categoryExpenses,
      dailyCashflow: dailyCashflow
    }
  };
}

function getDashboardData(token) {
  var accountsRes = getAccountsList();
  var transactionsRes = getTransactionsList({ limit: 15 });
  var chartsRes = getChartsData();
  var categoriesRes = getCategoriesData();
  var logsRes = getAuditLogsList();

  var accounts = accountsRes.data || [];
  
  // Calculate summary cards
  var totalMoney = 0;
  var cashAvailable = 0;
  var creditUsed = 0;
  var netWorth = 0;

  for (var i = 0; i < accounts.length; i++) {
    var acc = accounts[i];
    var bal = Number(acc.balance) || 0;
    
    if (bal > 0) {
      totalMoney += bal;
    }
    
    if (acc.type === 'bank' || acc.type === 'ewallet' || acc.type === 'cash') {
      if (bal > 0) cashAvailable += bal;
    }

    if (acc.type === 'credit_card' || acc.type === 'paylater') {
      if (bal < 0) {
        creditUsed += Math.abs(bal);
      }
    }

    netWorth += bal;
  }

  var chartsData = chartsRes.data || {};
  var monthlySummary = chartsData.monthlySummary || { income: 0, expense: 0 };

  return {
    status: 'success',
    data: {
      stats: {
        totalMoney: totalMoney,
        cashAvailable: cashAvailable,
        creditUsed: creditUsed,
        incomeThisMonth: monthlySummary.income,
        expenseThisMonth: monthlySummary.expense,
        netWorth: netWorth
      },
      accounts: accounts,
      recentTransactions: transactionsRes.data || [],
      charts: chartsData,
      categories: categoriesRes.data || {},
      logs: logsRes.data || []
    }
  };
}
