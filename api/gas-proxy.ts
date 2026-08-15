export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { webAppUrl, action, username = 'user', data = {} } = req.body || {};

    if (!webAppUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'URL Google Apps Script Web App diperlukan.',
      });
    }

    const cleanUser = String(username || 'user').trim().toLowerCase();

    const fetchGas = async (act: string, customPayload: any = null) => {
      const payload = customPayload || { action: act, data, username: cleanUser, ...data };
      const r = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        return { status: 'raw', text };
      }
    };

    // 1. Fetch data actions
    if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions' || action === 'getTransactions') {
      let result: any = null;

      // Try 1: SakuTrack get_transactions
      try {
        const sakuRes = await fetchGas('get_transactions', { action: 'get_transactions', username: cleanUser });
        if (sakuRes && sakuRes.status === 'success' && Array.isArray(sakuRes.transactions)) {
          result = sakuRes;
        }
      } catch {}

      // Try 2: getDashboard
      if (!result) {
        try {
          const dashRes = await fetchGas('getDashboard', { action: 'getDashboard', username: cleanUser, token: cleanUser });
          if (dashRes && (dashRes.status === 'success' || dashRes.transactions || dashRes.accounts || dashRes.data)) {
            result = dashRes;
          }
        } catch {}
      }

      // Try 3: getTransactions
      if (!result) {
        try {
          const txRes = await fetchGas('getTransactions', { action: 'getTransactions', username: cleanUser });
          if (txRes && (txRes.status === 'success' || Array.isArray(txRes.data) || Array.isArray(txRes.transactions))) {
            result = txRes;
          }
        } catch {}
      }

      // Fetch accounts if needed
      let accountsList: any[] = [];
      try {
        const accRes = await fetchGas('get_accounts', { action: 'get_accounts', username: cleanUser });
        if (accRes && accRes.status === 'success' && Array.isArray(accRes.accounts)) {
          accountsList = accRes.accounts;
        } else if (accRes && Array.isArray(accRes.data)) {
          accountsList = accRes.data;
        }
      } catch {}

      if (accountsList.length === 0) {
        try {
          const accRes2 = await fetchGas('getAccounts', { action: 'getAccounts' });
          if (accRes2 && (accRes2.status === 'success' || Array.isArray(accRes2.data))) {
            accountsList = accRes2.data || accRes2.accounts || [];
          }
        } catch {}
      }

      if (result) {
        const rawTxs = result.transactions || result.data?.recentTransactions || result.data?.transactions || (Array.isArray(result.data) ? result.data : []) || [];
        return res.status(200).json({
          status: 'success',
          transactions: rawTxs,
          accounts: accountsList.length > 0 ? accountsList : result.accounts || result.data?.accounts,
          data: result.data || result,
        });
      }

      return res.status(200).json({
        status: 'success',
        transactions: [],
        accounts: accountsList,
      });
    }

    // 2. Generic actions (addTransaction, saveAccount, deleteTransaction, etc.)
    const directRes = await fetchGas(action, { action, username: cleanUser, data, ...data });
    return res.status(200).json(directRes);
  } catch (err: any) {
    console.error('Vercel serverless GAS proxy error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Ralat pelayan proksi Google Apps Script: ' + (err.message || String(err)),
    });
  }
}
