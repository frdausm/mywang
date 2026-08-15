export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; message: string }> {
  const cleanUser = username.trim();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Sila masukkan nama pengguna dan kata laluan.' };
  }

  const settings = getStoredSettings();
  const gasUrl = settings.gas_web_app_url || settings.google_sheets_url || settings.sakutrack_sheets_url;

  // 1. Pengesahan terus ke Google Apps Script SakuTrack (Tanpa simpan password di F12)
  if (gasUrl) {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'login',
          username: cleanUser,
          password: cleanPass
        })
      });

      const result = await response.json();
      if (result && result.status === 'success') {
        const sessionUser: User = {
          id: 'usr_' + Date.now(),
          username: result.username || cleanUser,
          name: result.username || cleanUser,
          role: cleanUser.toLowerCase() === 'admin' ? 'admin' : 'member',
          created_at: new Date().toISOString()
        };
        // HANYA simpan profil sesi - TIADA kata laluan disimpan di pelayar
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser, message: 'Log masuk SakuTrack berjaya!' };
      } else if (result && result.status === 'error') {
        return { success: false, message: result.message || 'Nama pengguna atau kata laluan salah!' };
      }
    } catch (e: any) {
      console.warn('Gas login direct failed:', e);
    }
  }

  // 2. Akses Pentadbir Asas (Tanpa simpan kata laluan)
  if (cleanUser.toLowerCase() === 'admin' && cleanPass === 'admin123') {
    const defaultAdmin: User = {
      id: 'usr_admin',
      username: 'admin',
      name: 'Pentadbir (Admin)',
      role: 'admin',
      created_at: new Date().toISOString()
    };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultAdmin));
    return { success: true, user: defaultAdmin, message: 'Log masuk berjaya.' };
  }

  return {
    success: false,
    message: 'Nama pengguna atau kata laluan tidak sah.'
  };
}
export const StorageService = {
  getTransactions: getStoredTransactions,
  saveTransactions: saveStoredTransactions,
  addTransaction: addAndSyncTransaction,
  getAccounts: getStoredAccounts,
  saveAccounts: saveStoredAccounts,
  getBudgets: getStoredBudgets,
  saveBudgets: saveStoredBudgets,
  getGoals: getStoredGoals,
  saveGoals: saveStoredGoals,
  getDebts: getStoredDebts,
  saveDebts: saveStoredDebts,
  getSettings: getStoredSettings,
  saveSettings: saveStoredSettings,
  getCurrentUser: getStoredCurrentUser,
  login: loginUser,
  register: registerUser,
  logout: logoutUser,
  syncToGoogleSheets,
  fetchFromGoogleSheets,
  testGasConnection,
  getAnalyticsSummary
};

export default StorageService;
