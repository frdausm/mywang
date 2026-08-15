// Vercel Serverless Function for Backend Persistence
let memoryCache: any = null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    if (memoryCache) {
      return res.status(200).json({ status: 'success', data: memoryCache });
    }
    return res.status(200).json({ status: 'empty', message: 'Tiada data tersimpan di backend pelayan.' });
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body;
      if (payload && typeof payload === 'object') {
        memoryCache = {
          ...memoryCache,
          ...payload,
          last_saved_at: new Date().toISOString(),
        };
        return res.status(200).json({ status: 'success', message: 'Data berjaya disimpan di backend!' });
      }
      return res.status(400).json({ status: 'error', message: 'Payload tidak sah.' });
    } catch (e: any) {
      return res.status(500).json({ status: 'error', message: e.message });
    }
  }

  return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
}
