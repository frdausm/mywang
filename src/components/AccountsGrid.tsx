import React, { useState } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency, formatDateMalay, getBankVisuals } from '../utils/formatters';
import { 
  Pencil, 
  ArrowLeftRight, 
  Plus, 
  CreditCard, 
  Smartphone, 
  Landmark, 
  Clock, 
  Coins, 
  Wallet,
  Sparkles,
  LayoutGrid,
  Building2,
  RefreshCw,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  TrendingUp,
  TrendingDown,
  Receipt
} from 'lucide-react';
import { motion } from 'motion/react';

interface AccountsGridProps {
  accounts: Account[];
  transactions?: Transaction[];
  onSelectAccount?: (account: Account) => void;
  onEditAccount: (account: Account) => void;
  onQuickTransfer: (sourceAccount: Account) => void;
  onAddAccount: () => void;
  onRefreshData?: () => void;
  onReorderAccounts?: (reorderedAccounts: Account[]) => void;
  isSyncing?: boolean;
}

// Order of priority for known Malaysian banks & institutions
const INSTITUTIONS_ORDER = [
  'Maybank',
  'RHB Bank',
  'CIMB',
  "Touch 'n Go eWallet",
  'Boost',
  'Setel by Petronas',
  'Shopee',
  'Atome',
  'BSN',
  'GXBANK',
  'AEON BANK',
  'ASNB',
];

export const AccountsGrid: React.FC<AccountsGridProps> = ({
  accounts,
  transactions = [],
  onSelectAccount,
  onEditAccount,
  onQuickTransfer,
  onAddAccount,
  onRefreshData,
  onReorderAccounts,
  isSyncing = false,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'by_institution' | 'flat'>('by_institution');
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dragOverAccountId, setDragOverAccountId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  // Precompute monthly stats per account
  const accountStatsMap = React.useMemo(() => {
    const map: Record<string, { netMovement: number; txCount: number }> = {};
    
    accounts.forEach((acc) => {
      map[acc.id] = { netMovement: 0, txCount: 0 };
    });

    transactions.forEach((tx) => {
      const txDate = tx.date || tx.created_at || '';
      if (!txDate.startsWith(currentMonthPrefix)) return;
      const amt = Number(tx.amount) || 0;

      // Source account
      if (map[tx.account_id]) {
        map[tx.account_id].txCount++;
        if (tx.type === 'income' || tx.type === 'refund') {
          map[tx.account_id].netMovement += amt;
        } else if (tx.type === 'expense') {
          map[tx.account_id].netMovement -= amt;
        } else if (tx.type === 'transfer') {
          map[tx.account_id].netMovement -= amt;
        } else if (tx.type === 'adjustment') {
          map[tx.account_id].netMovement += amt;
        }
      }

      // Destination transfer account
      if (tx.type === 'transfer' && tx.to_account_id && map[tx.to_account_id]) {
        map[tx.to_account_id].txCount++;
        map[tx.to_account_id].netMovement += amt;
      }
    });

    return map;
  }, [accounts, transactions, currentMonthPrefix]);

  const filteredAccounts = React.useMemo(() => {
    return accounts.filter((acc) => {
      if (filterType === 'all') return true;
      if (filterType === 'bank') return acc.type === 'bank';
      if (filterType === 'ewallet') return acc.type === 'ewallet';
      if (filterType === 'credit') return acc.type === 'credit_card' || acc.type === 'paylater';
      if (filterType === 'invest') return acc.type === 'investment' || acc.type === 'gold';
      if (filterType === 'cash') return acc.type === 'cash';
      return true;
    });
  }, [accounts, filterType]);

  // Helper to render account type icon
  const renderAccountIcon = (acc: Account) => {
    if (acc.type === 'gold') return <Sparkles className="w-4 h-4 text-amber-500" />;
    if (acc.type === 'investment') return <Coins className="w-4 h-4 text-teal-500" />;
    if (acc.type === 'cash') return <Wallet className="w-4 h-4 text-emerald-500" />;
    if (acc.type === 'bank') return <Landmark className="w-4 h-4" />;
    if (acc.type === 'ewallet') return <Smartphone className="w-4 h-4" />;
    if (acc.type === 'credit_card') return <CreditCard className="w-4 h-4" />;
    if (acc.type === 'paylater') return <Clock className="w-4 h-4" />;
    return <Wallet className="w-4 h-4" />;
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank': return 'Akaun Bank';
      case 'ewallet': return 'e-Wallet';
      case 'credit_card': return 'Kad Kredit';
      case 'paylater': return 'PayLater / BNPL';
      case 'investment': return 'Pelaburan / ASNB';
      case 'gold': return 'Emas Digital (MIGA)';
      case 'cash': return 'Duit Tunai';
      default: return 'Akaun';
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, acc: Account) => {
    setDraggedAccountId(acc.id);
    e.dataTransfer.setData('text/plain', acc.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetAcc: Account) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedAccountId && draggedAccountId !== targetAcc.id) {
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const isAfter = e.clientX > midX;
      
      setDragOverAccountId(targetAcc.id);
      setDropPosition(isAfter ? 'after' : 'before');
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetAcc: Account) => {
    if (dragOverAccountId === targetAcc.id) {
      setDragOverAccountId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetAcc: Account) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedAccountId;
    
    if (!sourceId || sourceId === targetAcc.id) {
      setDraggedAccountId(null);
      setDragOverAccountId(null);
      return;
    }

    const currentAccounts = [...accounts];
    const sourceIdx = currentAccounts.findIndex(a => a.id === sourceId);
    const targetIdx = currentAccounts.findIndex(a => a.id === targetAcc.id);

    if (sourceIdx === -1 || targetIdx === -1) {
      setDraggedAccountId(null);
      setDragOverAccountId(null);
      return;
    }

    // Remove source account
    const [movedItem] = currentAccounts.splice(sourceIdx, 1);

    // Calculate insertion index after removal
    let insertIdx = currentAccounts.findIndex(a => a.id === targetAcc.id);
    if (dropPosition === 'after') {
      insertIdx += 1;
    }

    currentAccounts.splice(insertIdx, 0, movedItem);

    if (onReorderAccounts) {
      onReorderAccounts(currentAccounts);
    }

    setDraggedAccountId(null);
    setDragOverAccountId(null);
  };

  const handleDragEnd = () => {
    setDraggedAccountId(null);
    setDragOverAccountId(null);
  };

  // Quick shift left/right for buttons or touch devices
  const handleShiftAccount = (acc: Account, direction: -1 | 1) => {
    const currentAccounts = [...accounts];
    const idx = currentAccounts.findIndex(a => a.id === acc.id);
    if (idx === -1) return;
    
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= currentAccounts.length) return;

    const [item] = currentAccounts.splice(idx, 1);
    currentAccounts.splice(newIdx, 0, item);

    if (onReorderAccounts) {
      onReorderAccounts(currentAccounts);
    }
  };

  // Group accounts by institution dynamically based on user's actual accounts
  const institutionGroups = React.useMemo(() => {
    const groups: { institution: string; list: Account[]; index: number }[] = [];
    const assignedIds = new Set<string>();

    INSTITUTIONS_ORDER.forEach((instName) => {
      const matched = filteredAccounts.filter(acc => {
        if (assignedIds.has(acc.id)) return false;

        const b = (acc.bank || '').toLowerCase().trim();
        const n = (acc.account_name || '').toLowerCase().trim();
        const notes = (acc.notes || '').toLowerCase().trim();
        const id = (acc.id || '').toLowerCase().trim();
        const target = instName.toLowerCase().trim();
        
        if (target === 'maybank') {
          if (b.includes('cimb') || n.includes('cimb') || id.includes('cimb')) return false;
          return b.includes('maybank') || n.includes('maybank') || b.includes('mae') || n.includes('mae') || id.includes('mb') || id.includes('maybank') || n.includes('miga');
        }

        if (target === 'rhb bank') {
          return b.includes('rhb') || n.includes('rhb') || id.includes('rhb');
        }

        if (target === 'cimb') {
          return b.includes('cimb') || n.includes('cimb') || id.includes('cimb');
        }

        if (target.includes('touch') || target.includes('tng')) {
          return b.includes('touch') || b.includes('tng') || n.includes('touch') || n.includes('tng') || id.includes('tng') || n.includes('go+') || notes.includes('go+');
        }

        if (target === 'boost') {
          return b.includes('boost') || n.includes('boost') || id.includes('boost');
        }

        if (target.includes('setel')) {
          return b.includes('setel') || n.includes('setel') || id.includes('setel');
        }

        if (target === 'shopee') {
          return b.includes('shopee') || b.includes('spaylater') || n.includes('shopee') || n.includes('spaylater') || id.includes('shopee') || id.includes('spaylater');
        }

        if (target === 'atome') {
          return b.includes('atome') || n.includes('atome') || id.includes('atome');
        }

        if (target === 'bsn') {
          return b.includes('bsn') || b.includes('ssp') || n.includes('bsn') || n.includes('ssp') || id.includes('bsn');
        }

        if (target === 'gxbank') {
          return b.includes('gx') || b.includes('gxbank') || n.includes('gx') || n.includes('gxbank') || id.includes('gx');
        }

        if (target === 'aeon bank') {
          return b.includes('aeon') || n.includes('aeon') || n.includes('savings pot') || b.includes('savings pot') || n.includes('tabung keluarga') || n.includes('savings account-i') || notes.includes('aeon') || id.includes('aeon');
        }

        if (target === 'asnb') {
          return b.includes('asnb') || n.includes('asnb') || n.includes('amanah saham') || n.includes('asb') || n.includes('asn') || id.includes('asnb') || notes.includes('asnb');
        }

        return false;
      });

      matched.forEach(m => assignedIds.add(m.id));

      if (matched.length > 0) {
        groups.push({
          institution: instName,
          list: matched,
          index: groups.length + 1
        });
      }
    });

    // Capture any remaining institutions/accounts (e.g. Cash, Custom Banks, etc)
    const others = filteredAccounts.filter(acc => !assignedIds.has(acc.id));
    if (others.length > 0) {
      groups.push({
        institution: 'Lain-lain / Tunai & Pelaburan',
        list: others,
        index: groups.length + 1
      });
    }

    return groups;
  }, [filteredAccounts]);

  const renderSingleCard = (acc: Account, index: number, groupList?: Account[]) => {
    const visuals = getBankVisuals(acc.bank);
    const isDebt = acc.type === 'credit_card' || acc.type === 'paylater';
    const isNegative = acc.balance < 0;
    const isBeingDragged = draggedAccountId === acc.id;
    const isTarget = dragOverAccountId === acc.id;

    // Check index within current group or list for disabling arrows
    const localList = groupList || filteredAccounts;
    const localIdx = localList.findIndex(a => a.id === acc.id);
    const canMoveLeft = localIdx > 0;
    const canMoveRight = localIdx < localList.length - 1;

    // Monthly flow and tx stats for this account
    const accStats = accountStatsMap[acc.id] || { netMovement: 0, txCount: 0 };

    return (
      <div
        key={acc.id}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, acc)}
        onDragOver={(e) => handleDragOver(e, acc)}
        onDragLeave={(e) => handleDragLeave(e, acc)}
        onDrop={(e) => handleDrop(e, acc)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (onSelectAccount) {
            onSelectAccount(acc);
          }
        }}
        className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none ${
          isBeingDragged 
            ? 'opacity-40 border-dashed border-emerald-500 scale-95 shadow-none' 
            : isTarget
              ? 'border-emerald-500 ring-2 ring-emerald-500/40 dark:ring-emerald-400/40 shadow-lg scale-[1.02] bg-emerald-50/40 dark:bg-emerald-950/30'
              : 'border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:border-emerald-500/50 dark:hover:border-emerald-500/50'
        } ${!isBeingDragged && !isTarget ? 'p-4' : 'p-4'}`}
      >
        {/* Drop indicator bar */}
        {isTarget && (
          <div className={`absolute top-0 bottom-0 w-1.5 bg-emerald-500 rounded-full z-20 ${
            dropPosition === 'before' ? 'left-1' : 'right-1'
          }`} />
        )}

        {/* Top Bank Header Strip */}
        <div>
          <div className="flex items-start justify-between gap-1.5 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Drag Handle Icon */}
              <div 
                title="Tarik & Lepas untuk tukar lajur (Drag & Drop)" 
                className="p-1 rounded-md text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              <div className={`px-2 py-0.5 rounded-lg text-xs font-bold border shadow-xs ${visuals.badgeColor}`}>
                {acc.bank}
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                {renderAccountIcon(acc)}
                {getAccountTypeLabel(acc.type)}
              </span>
            </div>

            {/* Actions: Shift Left, Shift Right & Pencil Edit */}
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {/* Quick Shift Left */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShiftAccount(acc, -1);
                }}
                disabled={!canMoveLeft}
                title="Alih kad ke kiri / hadapan"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Quick Shift Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShiftAccount(acc, 1);
                }}
                disabled={!canMoveRight}
                title="Alih kad ke kanan / hujung"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Pencil Edit Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditAccount(acc);
                }}
                id={`btn_edit_acc_${acc.id}`}
                title="Kemaskini Baki (Pencil)"
                className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Account Name */}
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mb-1" title={acc.account_name}>
            {acc.account_name}
          </h3>

          {/* Smart Monthly Trend & Tx Count Badges */}
          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
              accStats.netMovement > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : accStats.netMovement < 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {accStats.netMovement > 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              ) : accStats.netMovement < 0 ? (
                <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              ) : null}
              <span>
                {accStats.netMovement > 0
                  ? `↑ RM ${accStats.netMovement.toFixed(2)} bulan ini`
                  : accStats.netMovement < 0
                  ? `↓ RM ${Math.abs(accStats.netMovement).toFixed(2)} bulan ini`
                  : `— RM 0.00 bulan ini`}
              </span>
            </span>

            {accStats.txCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-slate-400" />
                <span>{accStats.txCount} transaksi</span>
              </span>
            )}
          </div>

          {/* Metadata */}
          {acc.type === 'gold' && acc.weight_grams && (
            <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                ⚖️ {acc.weight_grams} g (Emas 999.9)
              </span>
            </div>
          )}

          {acc.credit_limit && isDebt && (
            <div className="mb-1">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Had Limit: {formatCurrency(acc.credit_limit)}
              </span>
            </div>
          )}

          {acc.notes && (
            <p className="text-[11px] text-slate-400 dark:text-slate-400 line-clamp-1 mb-2">
              {acc.notes}
            </p>
          )}
        </div>

        {/* Balance & Footer */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 mt-2">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isDebt ? 'Baki Digunakan:' : 'Baki Semasa:'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {formatDateMalay(acc.updated_at)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-lg font-black tracking-tight ${
              isNegative 
                ? 'text-rose-600 dark:text-rose-400' 
                : isDebt && acc.balance > 0 
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-emerald-400'
            }`}>
              {formatCurrency(acc.balance)}
            </span>

            {/* Quick Transfer Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickTransfer(acc);
              }}
              title={`Pindah wang dari ${acc.account_name}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Pindah</span>
            </button>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Akaun & Dompet Saya ({accounts.length})</span>
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <MoveHorizontal className="w-3 h-3" />
              <span>Boleh Tarik & Susun (Drag & Drop)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tarik kad akaun untuk susun kedudukan lajur, atau tekan ikon anak panah (◀ / ▶) untuk pindah ke hadapan / hujung.
          </p>
        </div>

        {/* View mode toggle, Filter Pills & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action buttons: Refresh & Add Account */}
          <div className="flex items-center gap-2">
            {onRefreshData && (
              <button
                onClick={onRefreshData}
                disabled={isSyncing}
                id="btn_refresh_accounts_data"
                title="Muat semula data dari storan/cloud"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{isSyncing ? 'Menyegerak...' : 'Muat Semula'}</span>
              </button>
            )}

            <button
              onClick={onAddAccount}
              id="btn_add_account_header"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Akaun</span>
            </button>
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('by_institution')}
              title="Susun mengikut Institusi"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'by_institution'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Institusi</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              title="Semua Kad Sekali Gus"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Semua Grid</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'bank', label: 'Bank' },
              { id: 'ewallet', label: 'e-Wallet' },
              { id: 'credit', label: 'Kad & PL' },
              { id: 'invest', label: 'Pelaburan' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW 1: BY INSTITUTION SECTIONS */}
      {viewMode === 'by_institution' ? (
        <div className="space-y-5">
          {institutionGroups.map((group) => {
            const assetAccounts = group.list.filter(acc => acc.type !== 'credit_card' && acc.type !== 'paylater');
            const debtAccounts = group.list.filter(acc => acc.type === 'credit_card' || acc.type === 'paylater');

            const totalAssetBalance = Math.round(assetAccounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) * 100) / 100;

            const rawDebtSum = Math.round(debtAccounts.reduce((sum, acc) => {
              return sum + (Number(acc.balance) || 0);
            }, 0) * 100) / 100;

            const normalizedDebt = rawDebtSum !== 0 ? (rawDebtSum < 0 ? rawDebtSum : -rawDebtSum) : 0;

            return (
              <div 
                key={group.institution} 
                className="bg-slate-50/70 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800"
              >
                {/* Institution Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-black flex items-center justify-center shadow-xs">
                      {group.index}
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{group.institution}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        ({group.list.length} akaun)
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold">
                    {/* If group ONLY has debt accounts (e.g. CIMB Credit Card with negative balance) */}
                    {assetAccounts.length === 0 && debtAccounts.length > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        Baki: {formatCurrency(normalizedDebt)}
                      </span>
                    ) : (
                      <>
                        <span className={totalAssetBalance < 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                          Baki: {formatCurrency(totalAssetBalance)}
                        </span>
                        {debtAccounts.length > 0 && normalizedDebt !== 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            Kredit/PL: {formatCurrency(normalizedDebt)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Sub Accounts Grid with Drag and Drop Support */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {group.list.map((acc, i) => renderSingleCard(acc, i, group.list))}
                </div>
              </div>
            );
          })}

          {/* Add Account Card at Bottom */}
          <motion.button
            onClick={onAddAccount}
            id="btn_add_account_grid"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 p-5 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block text-slate-900 dark:text-white">
                + Tambah Akaun / e-Wallet Baru
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Daftar akaun simpanan, kad kredit, e-wallet, atau tabung pelaburan baru
              </span>
            </div>
          </motion.button>
        </div>
      ) : (
        /* VIEW 2: FLAT GRID OF ALL ACCOUNTS */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredAccounts.map((acc, index) => renderSingleCard(acc, index, filteredAccounts))}

            {/* Quick Add Card */}
            <motion.button
              onClick={onAddAccount}
              id="btn_add_account_flat_card"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 p-5 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer min-h-[160px] group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-center">
                + Tambah Akaun Baru
              </span>
              <span className="text-[10px] text-slate-400 text-center">
                Bank, Kad, e-Wallet & Pelaburan
              </span>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
};
