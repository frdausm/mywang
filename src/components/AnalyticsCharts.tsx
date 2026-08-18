import React, { useState, useMemo } from 'react';
import { Account, Transaction } from '../types';
import { formatCurrency, getMalaysiaDateString } from '../utils/formatters';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { PieChart, BarChart3, TrendingUp, DollarSign } from 'lucide-react';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler
);

interface AnalyticsChartsProps {
  accounts: Account[];
  transactions: Transaction[];
  darkMode: boolean;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  accounts,
  transactions,
  darkMode,
}) => {
  const [timeframe, setTimeframe] = useState<'all' | 'this_month'>('this_month');

  const textColor = darkMode ? '#94A3B8' : '#475569';
  const gridColor = darkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

  // 1. Account Distribution Data (Doughnut)
  const positiveAccounts = useMemo(() => {
    return accounts.filter((a) => a.balance > 0);
  }, [accounts]);

  const doughnutData = useMemo(() => {
    return {
      labels: positiveAccounts.map((a) => `${a.bank} - ${a.account_name}`),
      datasets: [
        {
          data: positiveAccounts.map((a) => a.balance),
          backgroundColor: [
            '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899',
            '#14B8A6', '#F97316', '#06B6D4', '#6366F1', '#84CC16',
            '#A855F7', '#E11D48',
          ],
          borderWidth: 2,
          borderColor: darkMode ? '#0F172A' : '#FFFFFF',
        },
      ],
    };
  }, [positiveAccounts, darkMode]);

  // 2. Income vs Expense Data (6 Months)
  const barData = useMemo(() => {
    const myDateStr = getMalaysiaDateString();
    const [currentYear, currentMonthNum] = myDateStr.split('-').map(Number);
    const now = new Date(currentYear, currentMonthNum - 1, 1);
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    
    const monthlyData: { [key: string]: { income: number; expense: number } } = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { income: 0, expense: 0 };
    }

    transactions.forEach((tx) => {
      if (tx.date) {
        const ym = tx.date.slice(0, 7);
        if (monthlyData[ym]) {
          if (tx.type === 'income') {
            monthlyData[ym].income += Number(tx.amount) || 0;
          } else if (tx.type === 'expense') {
            monthlyData[ym].expense += Number(tx.amount) || 0;
          }
        }
      }
    });

    const barLabels = Object.keys(monthlyData).map((ym) => {
      const [y, m] = ym.split('-');
      return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
    });

    return {
      labels: barLabels,
      datasets: [
        {
          label: 'Duit Masuk (RM)',
          data: Object.values(monthlyData).map((m) => m.income),
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 8,
        },
        {
          label: 'Duit Keluar (RM)',
          data: Object.values(monthlyData).map((m) => m.expense),
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          borderRadius: 8,
        },
      ],
    };
  }, [transactions]);

  // 3. Expense Categories Breakdown
  const sortedCategories = useMemo(() => {
    const expenseByCategory: { [cat: string]: number } = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const c = t.category || 'Lain-lain';
        expenseByCategory[c] = (expenseByCategory[c] || 0) + (Number(t.amount) || 0);
      });

    return Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [transactions]);

  const categoryBarData = useMemo(() => {
    return {
      labels: sortedCategories.map((s) => s[0]),
      datasets: [
        {
          label: 'Jumlah Belanja (RM)',
          data: sortedCategories.map((s) => s[1]),
          backgroundColor: [
            '#F43F5E', '#FB923C', '#FBBF24', '#A855F7', '#38BDF8', '#4ADE80'
          ],
          borderRadius: 6,
        },
      ],
    };
  }, [sortedCategories]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Analisis & Visualisasi Kewangan</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Carta taburan dana akaun, perbandingan masuk vs keluar dan kategori perbelanjaan tertinggi.
          </p>
        </div>
      </div>

      {/* Grid of 3 Analytical Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Doughnut: Taburan Wang Akaun */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-500" />
                Taburan Wang Mengikut Akaun
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Peratusan pecahan simpanan pada bank & e-wallet.
            </p>
          </div>

          <div className="relative h-64 flex items-center justify-center">
            {positiveAccounts.length > 0 ? (
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: textColor,
                        boxWidth: 12,
                        font: { size: 10, weight: 600 },
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` RM ${ctx.parsed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
                      },
                    },
                  },
                  cutout: '65%',
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">Tiada baki positif untuk dipaparkan.</p>
            )}
          </div>
        </div>

        {/* Bar: Inflow vs Outflow */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Duit Masuk vs Duit Keluar (6 Bulan)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Perbandingan trend bulanan untuk melihat simpanan bersih.
            </p>
          </div>

          <div className="relative h-64">
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { color: textColor, font: { size: 11, weight: 600 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => ` ${ctx.dataset.label}: RM ${ctx.parsed.y.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 10 } },
                  },
                  y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Expense Category Top 6 */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-500" />
              Kategori Perbelanjaan Tertinggi
            </h3>
            <span className="text-xs text-slate-400">Top 6 Kategori</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Ketahui ke mana wang anda paling banyak mengalir.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortedCategories.map(([catName, amt], idx) => (
              <div
                key={catName}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {catName}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Jumlah kumulatif</p>
                </div>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                  {formatCurrency(amt)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
