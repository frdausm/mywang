import { Account, Transaction } from '../types';

/**
 * Universal Account Matching Utility for MyWang
 * Handles variations in Account IDs, bank names, compound names ("Maybank - Maybank"),
 * and legacy identifiers across Google Apps Script, SakuTrack, and local state.
 */

export function matchAccount(
  txAccId?: string,
  txAccName?: string,
  accountsList: Account[] = [],
  txNote?: string
): Account | undefined {
  if (!accountsList || accountsList.length === 0) return undefined;

  const cleanId = (txAccId || '').toLowerCase().trim();
  const cleanName = (txAccName || '').toLowerCase().trim();
  const cleanNote = (txNote || '').toLowerCase().trim();

  // 1. Direct ID match (e.g. 'ACC_001', 'acc_mb_sav')
  if (cleanId) {
    const direct = accountsList.find((a) => (a.id || '').toLowerCase() === cleanId);
    if (direct) return direct;
  }

  // 2. Exact match against full combo "${bank} - ${account_name}", account_name, or bank
  for (const acc of accountsList) {
    const accBank = (acc.bank || '').toLowerCase().trim();
    const accName = (acc.account_name || '').toLowerCase().trim();
    const fullCombo = `${accBank} - ${accName}`.toLowerCase();

    if (
      cleanId === fullCombo ||
      cleanId === accName ||
      cleanId === accBank ||
      cleanName === fullCombo ||
      cleanName === accName ||
      cleanName === accBank
    ) {
      // Differentiate GO+ vs standard TNG eWallet
      const isTxGoPlus =
        cleanId.includes('go+') ||
        cleanId.includes('goplus') ||
        cleanName.includes('go+') ||
        cleanName.includes('goplus') ||
        cleanNote.includes('go+');
      const isAccGoPlus =
        accName.includes('go+') ||
        accName.includes('goplus') ||
        (acc.id || '').toLowerCase().includes('goplus') ||
        acc.id === 'acc_1786841487737';

      if (
        isTxGoPlus !== isAccGoPlus &&
        (cleanId.includes('touch') ||
          cleanId.includes('tng') ||
          cleanName.includes('touch') ||
          cleanName.includes('tng'))
      ) {
        continue;
      }

      // Differentiate Maybank Credit Card vs Maybank Savings
      const isTxMbCc =
        cleanId.includes('ikhwan') ||
        cleanId.includes('credit') ||
        cleanId.includes('card') ||
        cleanName.includes('ikhwan') ||
        cleanName.includes('credit') ||
        cleanName.includes('card');
      const isAccMbCc =
        acc.type === 'credit_card' ||
        accName.includes('ikhwan') ||
        accName.includes('credit') ||
        accName.includes('card') ||
        acc.id === 'acc_1786843686714';

      if (isTxMbCc !== isAccMbCc && (cleanId.includes('maybank') || cleanName.includes('maybank'))) {
        continue;
      }

      return acc;
    }
  }

  // 3. Smart substring / keyword heuristics
  const combined = `${cleanId} ${cleanName} ${cleanNote}`.toLowerCase();

  // TNG GO+
  if (combined.includes('go+') || combined.includes('goplus') || combined.includes('tng go')) {
    const goAcc = accountsList.find(
      (a) =>
        a.account_name.toLowerCase().includes('go+') ||
        a.id === 'acc_1786841487737' ||
        a.id.includes('goplus')
    );
    if (goAcc) return goAcc;
  }

  // Touch 'n Go standard eWallet
  if (combined.includes('touch') || combined.includes('tng')) {
    const tngAcc = accountsList.find(
      (a) =>
        !a.account_name.toLowerCase().includes('go+') &&
        (a.bank.toLowerCase().includes('touch') ||
          a.account_name.toLowerCase().includes('touch') ||
          a.id === 'ACC_003' ||
          a.id === 'acc_tng_ewallet')
    );
    if (tngAcc) return tngAcc;
  }

  // Maybank
  if (combined.includes('maybank') || combined.includes('mae')) {
    if (
      combined.includes('ikhwan') ||
      combined.includes('credit') ||
      combined.includes('card') ||
      combined.includes('mastercard')
    ) {
      const mbCc = accountsList.find(
        (a) =>
          a.type === 'credit_card' &&
          (a.bank.toLowerCase().includes('maybank') || a.account_name.toLowerCase().includes('maybank'))
      );
      if (mbCc) return mbCc;
    }
    const mbSav = accountsList.find(
      (a) =>
        a.id === 'ACC_001' ||
        (a.type === 'bank' && a.bank.toLowerCase().includes('maybank')) ||
        a.account_name.toLowerCase() === 'maybank'
    );
    if (mbSav) return mbSav;
  }

  // RHB
  if (combined.includes('rhb')) {
    const rhbAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('rhb') ||
        a.account_name.toLowerCase().includes('rhb') ||
        a.id === 'ACC_005' ||
        a.id === 'acc_rhb_cc'
    );
    if (rhbAcc) return rhbAcc;
  }

  // CIMB
  if (combined.includes('cimb')) {
    const cimbAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('cimb') ||
        a.account_name.toLowerCase().includes('cimb') ||
        a.id === 'ACC_002'
    );
    if (cimbAcc) return cimbAcc;
  }

  // Boost
  if (combined.includes('boost')) {
    const boostAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('boost') ||
        a.account_name.toLowerCase().includes('boost') ||
        a.id === 'acc_boost' ||
        a.id === 'acc_1786841549721'
    );
    if (boostAcc) return boostAcc;
  }

  // Setel
  if (combined.includes('setel') || combined.includes('petronas')) {
    const setelAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('setel') ||
        a.account_name.toLowerCase().includes('setel') ||
        a.id === 'acc_setel' ||
        a.id === 'ACC_007'
    );
    if (setelAcc) return setelAcc;
  }

  // Shopee / SPayLater
  if (combined.includes('shopee') || combined.includes('spaylater')) {
    const shopeeAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('shopee') ||
        a.account_name.toLowerCase().includes('shopee') ||
        a.id === 'ACC_008' ||
        a.id === 'acc_shopeepay'
    );
    if (shopeeAcc) return shopeeAcc;
  }

  // Atome
  if (combined.includes('atome')) {
    const atomeAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('atome') ||
        a.account_name.toLowerCase().includes('atome') ||
        a.id === 'acc_atome_card' ||
        a.id === 'acc_1786843729188'
    );
    if (atomeAcc) return atomeAcc;
  }

  // AEON
  if (combined.includes('aeon') || combined.includes('savings pot') || combined.includes('tabung keluarga')) {
    const aeonAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('aeon') ||
        a.account_name.toLowerCase().includes('savings pot') ||
        a.account_name.toLowerCase().includes('aeon') ||
        a.id === 'acc_aeon_pot' ||
        a.id === 'acc_1786843770412'
    );
    if (aeonAcc) return aeonAcc;
  }

  // GXBank
  if (combined.includes('gx') || combined.includes('gxbank')) {
    const gxAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('gx') ||
        a.account_name.toLowerCase().includes('gx') ||
        a.id === 'acc_gx_sav' ||
        a.id === 'acc_1786843812903'
    );
    if (gxAcc) return gxAcc;
  }

  // BSN
  if (combined.includes('bsn') || combined.includes('ssp')) {
    const bsnAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('bsn') ||
        a.account_name.toLowerCase().includes('bsn') ||
        a.id === 'acc_bsn_sav' ||
        a.id === 'acc_1786843854190'
    );
    if (bsnAcc) return bsnAcc;
  }

  // ASNB
  if (combined.includes('asnb') || combined.includes('asb') || combined.includes('asn')) {
    const asnbAcc = accountsList.find(
      (a) =>
        a.bank.toLowerCase().includes('asnb') ||
        a.account_name.toLowerCase().includes('asb') ||
        a.account_name.toLowerCase().includes('asn') ||
        a.id === 'acc_asnb_asb' ||
        a.id === 'acc_1786843890211'
    );
    if (asnbAcc) return asnbAcc;
  }

  // MIGA Gold
  if (combined.includes('miga') || combined.includes('emas') || combined.includes('gold')) {
    const goldAcc = accountsList.find(
      (a) =>
        a.type === 'gold' ||
        a.bank.toLowerCase().includes('miga') ||
        a.account_name.toLowerCase().includes('miga') ||
        a.account_name.toLowerCase().includes('gold') ||
        a.id === 'acc_miga_gold' ||
        a.id === 'acc_1786843930114'
    );
    if (goldAcc) return goldAcc;
  }

  // Tunai / Cash
  if (combined.includes('tunai') || combined.includes('cash') || combined.includes('dompet')) {
    const cashAcc = accountsList.find((a) => a.type === 'cash' || a.id === 'ACC_004');
    if (cashAcc) return cashAcc;
  }

  return undefined;
}

export function matchAccountId(
  txAccId?: string,
  txAccName?: string,
  accountsList: Account[] = [],
  txNote?: string
): string | undefined {
  const matched = matchAccount(txAccId, txAccName, accountsList, txNote);
  return matched?.id;
}

/**
 * Checks if a transaction belongs to a given account (as source or destination transfer)
 */
export function isTransactionForAccount(
  tx: Transaction,
  account: Account,
  accountsList: Account[] = []
): boolean {
  if (!account) return false;

  // Direct ID check
  if (tx.account_id === account.id) return true;
  if (tx.type === 'transfer' && tx.to_account_id === account.id) return true;

  // Source match check
  const list = accountsList.length > 0 ? accountsList : [account];
  const matchedSource = matchAccount(tx.account_id, tx.account_name, list, tx.note);
  if (matchedSource && matchedSource.id === account.id) return true;

  // Destination transfer match check
  if (tx.type === 'transfer') {
    const matchedDest = matchAccount(tx.to_account_id, tx.to_account_name, list, tx.note);
    if (matchedDest && matchedDest.id === account.id) return true;
  }

  return false;
}

/**
 * Checks if a transaction is a source outflow/inflow for a given account
 */
export function isTransactionSourceForAccount(
  tx: Transaction,
  account: Account,
  accountsList: Account[] = []
): boolean {
  if (!account) return false;
  if (tx.account_id === account.id) return true;

  const list = accountsList.length > 0 ? accountsList : [account];
  const matchedSource = matchAccount(tx.account_id, tx.account_name, list, tx.note);
  return !!matchedSource && matchedSource.id === account.id;
}

/**
 * Checks if a transaction is a destination transfer for a given account
 */
export function isTransactionDestinationForAccount(
  tx: Transaction,
  account: Account,
  accountsList: Account[] = []
): boolean {
  if (!account || tx.type !== 'transfer') return false;
  if (tx.to_account_id === account.id) return true;

  const list = accountsList.length > 0 ? accountsList : [account];
  const matchedDest = matchAccount(tx.to_account_id, tx.to_account_name, list, tx.note);
  return !!matchedDest && matchedDest.id === account.id;
}
