/**
 * Format currency to Malaysian Ringgit (MYR / RM)
 */
export function formatCurrency(amount: number, showSymbol = true): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = absAmount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (showSymbol) {
    return isNegative ? `-RM ${formatted}` : `RM ${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format Date to Malay friendly string
 * e.g. 14 Ogos 2026
 */
export function formatDateMalay(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);

  const monthsMalay = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const day = d.getDate();
  const month = monthsMalay[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Get Bank/Institution Brand Colors & Badges
 */
export function getBankVisuals(bankName: string): { bgGradient: string; badgeColor: string; textColor: string } {
  const name = (bankName || '').toLowerCase();

  if (name.includes('maybank')) {
    return {
      bgGradient: 'from-amber-500 via-amber-600 to-yellow-600',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      textColor: 'text-amber-600 dark:text-amber-400'
    };
  }
  if (name.includes('rhb')) {
    return {
      bgGradient: 'from-blue-600 via-blue-700 to-cyan-800',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800',
      textColor: 'text-blue-600 dark:text-blue-400'
    };
  }
  if (name.includes('cimb')) {
    return {
      bgGradient: 'from-red-600 via-rose-700 to-red-900',
      badgeColor: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
      textColor: 'text-rose-600 dark:text-rose-400'
    };
  }
  if (name.includes('touch') || name.includes('tng')) {
    return {
      bgGradient: 'from-blue-500 via-indigo-600 to-blue-700',
      badgeColor: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800',
      textColor: 'text-sky-600 dark:text-sky-400'
    };
  }
  if (name.includes('boost')) {
    return {
      bgGradient: 'from-red-500 via-orange-600 to-red-700',
      badgeColor: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800',
      textColor: 'text-red-600 dark:text-red-400'
    };
  }
  if (name.includes('setel')) {
    return {
      bgGradient: 'from-emerald-500 via-teal-600 to-emerald-800',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    };
  }
  if (name.includes('shopee')) {
    return {
      bgGradient: 'from-orange-500 via-amber-600 to-orange-700',
      badgeColor: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-800',
      textColor: 'text-orange-600 dark:text-orange-400'
    };
  }
  if (name.includes('aeon')) {
    return {
      bgGradient: 'from-fuchsia-600 via-pink-600 to-rose-700',
      badgeColor: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-950/80 dark:text-fuchsia-300 dark:border-fuchsia-800',
      textColor: 'text-fuchsia-600 dark:text-fuchsia-400'
    };
  }
  if (name.includes('gx') || name.includes('gxbank')) {
    return {
      bgGradient: 'from-violet-600 via-purple-700 to-indigo-800',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
      textColor: 'text-purple-600 dark:text-purple-400'
    };
  }
  if (name.includes('bsn') || name.includes('ssp')) {
    return {
      bgGradient: 'from-teal-600 via-emerald-700 to-teal-900',
      badgeColor: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-800',
      textColor: 'text-teal-600 dark:text-teal-400'
    };
  }
  if (name.includes('asnb') || name.includes('asb') || name.includes('asn')) {
    return {
      bgGradient: 'from-blue-700 via-sky-800 to-indigo-900',
      badgeColor: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800',
      textColor: 'text-sky-600 dark:text-sky-400'
    };
  }
  if (name.includes('cash') || name.includes('tunai')) {
    return {
      bgGradient: 'from-emerald-600 via-green-600 to-teal-700',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    };
  }
  if (name.includes('atome')) {
    return {
      bgGradient: 'from-lime-500 via-emerald-600 to-yellow-600',
      badgeColor: 'bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-950/80 dark:text-lime-300 dark:border-lime-800',
      textColor: 'text-lime-600 dark:text-lime-400'
    };
  }

  return {
    bgGradient: 'from-slate-700 via-gray-800 to-zinc-900',
    badgeColor: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    textColor: 'text-slate-600 dark:text-slate-400'
  };
}
