import React from 'react';
import { SummaryStats } from '../types';
import { formatCurrency } from '../utils/formatters';
import { 
  Coins, 
  Wallet, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck 
} from 'lucide-react';
import { motion } from 'motion/react';

interface SummaryCardsProps {
  stats: SummaryStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const cards = [
    {
      id: 'card_total_money',
      title: 'Total Money',
      subtitle: 'Semua baki akaun positif',
      amount: stats.totalMoney,
      icon: Coins,
      gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    },
    {
      id: 'card_cash_available',
      title: 'Cash Available',
      subtitle: 'Baki Bank & e-Wallet cair',
      amount: stats.cashAvailable,
      icon: Wallet,
      gradient: 'from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-500/20 dark:via-indigo-500/10',
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-500/20 dark:border-blue-500/30',
    },
    {
      id: 'card_credit_used',
      title: 'Credit Used',
      subtitle: 'Hutang Kad & PayLater semasa',
      amount: stats.creditUsed,
      icon: CreditCard,
      gradient: 'from-rose-500/10 via-red-500/5 to-transparent dark:from-rose-500/20 dark:via-red-500/10',
      iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      textColor: 'text-rose-700 dark:text-rose-400',
      borderColor: 'border-rose-500/20 dark:border-rose-500/30',
    },
    {
      id: 'card_income_month',
      title: 'Duit Masuk Bulan Ini',
      subtitle: 'Gaji, Sales, Dividen & Inflow',
      amount: stats.incomeThisMonth,
      icon: ArrowDownLeft,
      gradient: 'from-teal-500/10 via-cyan-500/5 to-transparent dark:from-teal-500/20 dark:via-cyan-500/10',
      iconBg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
      textColor: 'text-teal-700 dark:text-teal-300',
      borderColor: 'border-teal-500/20 dark:border-teal-500/30',
      prefix: '+ ',
    },
    {
      id: 'card_expense_month',
      title: 'Duit Keluar Bulan Ini',
      subtitle: 'Belanja, Bil, Komitmen & Outflow',
      amount: stats.expenseThisMonth,
      icon: ArrowUpRight,
      gradient: 'from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/20 dark:via-orange-500/10',
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      textColor: 'text-amber-700 dark:text-amber-300',
      borderColor: 'border-amber-500/20 dark:border-amber-500/30',
      prefix: '- ',
    },
    {
      id: 'card_net_worth',
      title: 'Net Worth',
      subtitle: 'Nilai Aset Bersih (Aset - Liabiliti)',
      amount: stats.netWorth,
      icon: Scale,
      gradient: 'from-purple-500/10 via-indigo-500/5 to-transparent dark:from-purple-500/20 dark:via-indigo-500/10',
      iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      textColor: 'text-purple-700 dark:text-purple-300',
      borderColor: 'border-purple-500/20 dark:border-purple-500/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.05 }}
            className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border ${card.borderColor} p-5 shadow-sm hover:shadow-md transition-all duration-200`}
          >
            {/* Subtle Gradient Accent */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 font-medium">
                  {card.subtitle}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl border ${card.iconBg}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="relative z-10 mt-4">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-black tracking-tight ${card.textColor}`}>
                  {card.prefix ? card.prefix : ''}{formatCurrency(card.amount)}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
