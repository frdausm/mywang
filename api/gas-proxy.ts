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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const { webAppUrl, action, username = 'user', data = {} } = body || {};

    if (!webAppUrl || typeof webAppUrl !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'URL Google Apps Script Web App diperlukan.',
      });
    }

    const cleanUser = String(username || 'user').trim().toLowerCase();

    const fetchGas = async (act: string, customPayload: any = null) => {
      try {
        const payload = customPayload || { action: act, data, username: cleanUser, ...data };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const r = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          return { status: 'raw', text };
        }
      } catch (e: any) {
        console.warn(`[Vercel GAS Proxy] fetchGas error on action ${act}:`, e?.message);
        return null;
      }
    };

    // 1. Fetch data actions
    if (action === 'getInitialData' || action === 'getDashboard' || action === 'syncDashboard' || action === 'get_transactions' || action === 'getTransactions') {
      let allRawTxs: any[] = [];
      let accountsList: any[] = [];

      const usernamesToTry = ['', cleanUser, 'user', 'admin', 'firdaus'].filter(
        (v, i, a) => a.indexOf(v) === i
      );

      // Try fetching transactions with different parameters to guarantee all rows are collected
      for (const u of usernamesToTry) {
        const sakuRes = await fetchGas('get_transactions', {
          action: 'get_transactions',
          username: u || undefined,
          all: true,
        });
        if (sakuRes && sakuRes.status === 'success') {
          if (Array.isArray(sakuRes.transactions) && sakuRes.transactions.length > 0) {
            allRawTxs.push(...sakuRes.transactions);
          }
          if (Array.isArray(sakuRes.accounts) && sakuRes.accounts.length > 0 && accountsList.length === 0) {
            accountsList = sakuRes.accounts;
          }
        }
      }

      // Try getDashboard
      const dashRes = await fetchGas('getDashboard', {
        action: 'getDashboard',
        username: cleanUser,
        token: cleanUser,
      });
      if (dashRes) {
        const dashTxs = dashRes.transactions || dashRes.data?.transactions || dashRes.data?.recentTransactions;
        if (Array.isArray(dashTxs) && dashTxs.length > 0) {
          allRawTxs.push(...dashTxs);
        }
        if (Array.isArray(dashRes.accounts) && dashRes.accounts.length > 0 && accountsList.length === 0) {
          accountsList = dashRes.accounts;
        } else if (Array.isArray(dashRes.data?.accounts) && dashRes.data.accounts.length > 0 && accountsList.length === 0) {
          accountsList = dashRes.data.accounts;
        }
      }

      // Fetch accounts if still needed
      if (accountsList.length === 0) {
        for (const u of usernamesToTry) {
          const accRes = await fetchGas('get_accounts', { action: 'get_accounts', username: u || undefined });
          if (accRes && accRes.status === 'success' && Array.isArray(accRes.accounts) && accRes.accounts.length > 0) {
            accountsList = accRes.accounts;
            break;
          } else if (accRes && Array.isArray(accRes.data) && accRes.data.length > 0) {
            accountsList = accRes.data;
            break;
          }
        }
      }

      if (accountsList.length === 0) {
        const accRes2 = await fetchGas('getAccounts', { action: 'getAccounts' });
        if (accRes2 && (accRes2.status === 'success' || Array.isArray(accRes2.data))) {
          accountsList = accRes2.data || accRes2.accounts || [];
        }
      }

      // Deduplicate raw transactions by ID/TxID/content
      const seenTxIds = new Set<string>();
      const uniqueRawTxs: any[] = [];
      allRawTxs.forEach((tx) => {
        if (!tx) return;
        const tid = String(tx.id || tx.TxID || `${tx.date}_${tx.amount}_${tx.category}_${tx.note}`);
        if (!seenTxIds.has(tid)) {
          seenTxIds.add(tid);
          uniqueRawTxs.push(tx);
        }
      });

      return res.status(200).json({
        status: 'success',
        transactions: uniqueRawTxs,
        accounts: accountsList,
      });
    }

    // 2. Generic actions (addTransaction, saveAccount, deleteTransaction, etc.)
    const directRes = await fetchGas(action, { action, username: cleanUser, data, ...data });
    if (directRes) {
      return res.status(200).json(directRes);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Permintaan diproses oleh pelayan proksi.',
    });
  } catch (err: any) {
    console.error('Vercel serverless GAS proxy error:', err);
    return res.status(200).json({
      status: 'error',
      message: 'Ralat pelayan proksi Google Apps Script: ' + (err.message || String(err)),
      transactions: [],
      accounts: [],
    });
  }
}
