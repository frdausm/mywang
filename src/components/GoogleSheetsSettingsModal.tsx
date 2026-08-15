import React, { useState, useEffect } from 'react';
import { GoogleSheetsConfig } from '../types';
import { StorageService } from '../services/storage';
import { generateGoogleSheetTemplateXlsx } from '../utils/excelExporter';
import { 
  X, 
  Database, 
  Download, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleSheetsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
  onResetAllAmounts?: () => void;
}

export const GoogleSheetsSettingsModal: React.FC<GoogleSheetsSettingsModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  onResetAllAmounts,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig>(StorageService.getGoogleSheetsConfig());
  const [webAppUrl, setWebAppUrl] = useState(config.webAppUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'guide'>('settings');

  useEffect(() => {
    const current = StorageService.getGoogleSheetsConfig();
    setConfig(current);
    setWebAppUrl(current.webAppUrl || '');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const updated: GoogleSheetsConfig = {
      ...config,
      webAppUrl: webAppUrl.trim(),
    };
    StorageService.saveGoogleSheetsConfig(updated);
    setConfig(updated);
    setTestResult({ success: true, message: 'URL Google Apps Script disimpan dengan jayanya.' });
  };

  const handleTestConnection = async () => {
    if (!webAppUrl.trim()) {
      setTestResult({ success: false, message: 'Sila masukkan URL Web App Google Apps Script anda.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    // Save temporarily
    StorageService.saveGoogleSheetsConfig({ ...config, webAppUrl: webAppUrl.trim() });

    const res = await StorageService.syncWithGAS('testConnection');
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      onSyncComplete();
    }
  };

  const handleDownloadTemplate = () => {
    generateGoogleSheetTemplateXlsx();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Penyambungan Google Sheets & Apps Script
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Jadikan spreadsheet Google Sheets anda sebagai pangkalan data masa nyata percuma.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 pt-3 bg-slate-50/50 dark:bg-slate-850/50">
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Tetapan & Sambungan
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'guide'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Panduan Langkah Demi Langkah (Setup)
            </button>
          </div>

          <div className="p-6 space-y-5">
            {activeTab === 'settings' ? (
              <div className="space-y-4">
                
                {/* Download Template Banner */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Templat Google Sheets MyWang (10 Sheets Lengkap)
                    </span>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Muat turun templat rasmi sedia-guna dengan semua tab, formula & skema.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    id="btn_download_template"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Muat Turun .xlsx</span>
                  </button>
                </div>

                {/* Status Message Alert */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                {/* Web App URL Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    URL Google Apps Script Web App (Deployment URL)
                  </label>
                  <input
                    type="url"
                    id="input_gas_url"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dapatkan URL ini selepas melakukan "New Deployment" &gt; "Web App" di Apps Script.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    id="btn_test_gas_connection"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Menguji Sambungan...' : 'Uji Sambungan API'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan URL</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  3 Langkah Mudah Sambungkan Google Sheets:
                </h3>
                
                <ol className="list-decimal list-inside space-y-3 font-medium">
                  <li className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">Langkah 1:</strong> Buka Google Drive, buat spreadsheet baru bernama <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">MyWang_Database</code> atau muat naik fail templat <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.xlsx</code> di atas.
                  </li>
                  <li className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">Langkah 2:</strong> Dalam Google Sheets, klik menu <strong>Extensions &gt; Apps Script</strong>. Salin kod dari folder <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">/appsscript/</code> ke dalam editor Apps Script.
                  </li>
                  <li className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">Langkah 3:</strong> Klik butang biru <strong>Deploy &gt; New deployment &gt; Web app</strong>. Tetapkan <em>"Who has access"</em> kepada <strong>Anyone</strong>. Salin <strong>Web App URL</strong> dan tampal dalam tab "Tetapan" tadi.
                  </li>
                </ol>

                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[11px]">
                  💡 <strong>Nota Keselamatan:</strong> Semua data anda disimpan 100% pada akaun Google Sheets peribadi anda sendiri. Aplikasi ini menggunakan proxy selamat dan enkripsi SHA-256 untuk kata laluan.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {onResetAllAmounts ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Adakah anda pasti ingin mengosongkan semua jumlah baki akaun kepada RM 0.00 dan membuang semua rekod transaksi dummy? (Data senarai akaun & kategori anda akan dikekalkan)')) {
                    onResetAllAmounts();
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kosongkan Semua Jumlah (RM 0.00)</span>
              </button>
            ) : <div />}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
