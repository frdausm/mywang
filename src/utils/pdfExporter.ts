import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, SummaryStats } from '../types';
import { formatCurrency, formatDateMalay } from './formatters';

export function exportTransactionsToPDF(transactions: Transaction[], stats?: SummaryStats, title = 'Laporan Kewangan MyWang') {
  const doc = new jsPDF();

  // Header styling
  doc.setFillColor(16, 185, 129); // Emerald green
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('MyWang', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('One Dashboard. Every Ringgit. | Malaysian Personal Finance', 14, 26);

  const todayStr = formatDateMalay(new Date());
  doc.text(`Tarikh: ${todayStr}`, 196, 26, { align: 'right' });

  // Summary box if provided
  if (stats) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Ringkasan Kewangan Semasa:', 14, 45);

    const summaryData = [
      ['Total Money', formatCurrency(stats.totalMoney), 'Duit Masuk Bulan Ini', formatCurrency(stats.incomeThisMonth)],
      ['Cash Available', formatCurrency(stats.cashAvailable), 'Duit Keluar Bulan Ini', formatCurrency(stats.expenseThisMonth)],
      ['Credit Used (Hutang)', formatCurrency(stats.creditUsed), 'Net Worth (Aset Bersih)', formatCurrency(stats.netWorth)],
    ];

    autoTable(doc, {
      startY: 48,
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129] },
    });
  }

  // Transactions Table
  const startY = stats ? (doc as any).lastAutoTable.finalY + 12 : 45;

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Senarai Lejar Transaksi', 14, startY);

  const tableRows = transactions.map((t) => [
    t.date,
    t.account_name || t.account_id,
    t.type === 'income' ? 'Duit Masuk' : t.type === 'expense' ? 'Duit Keluar' : t.type === 'transfer' ? 'Transfer' : 'Pelarasan',
    t.category,
    t.note || '-',
    (t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '') + formatCurrency(t.amount, true),
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head: [['Tarikh', 'Akaun', 'Jenis', 'Kategori', 'Nota', 'Jumlah']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 42 },
      2: { cellWidth: 26 },
      3: { cellWidth: 32 },
      4: { cellWidth: 45 },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Dijana secara automatik oleh MyWang • Halaman ${i} daripada ${pageCount}`, 105, 290, { align: 'center' });
  }

  doc.save('MyWang_Laporan_Kewangan.pdf');
}
