import React, { useState, useRef, useEffect } from 'react';
import { Account, Transaction, SummaryStats, User } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Utensils,
  Wallet,
  HelpCircle,
  RefreshCw,
  Lightbulb,
  MessageSquareQuote,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface MyWangAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  stats: SummaryStats;
  user: User | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  highlightStats?: Array<{ label: string; value: string; change?: string; type?: 'positive' | 'negative' | 'neutral' }>;
  suggestedQuestions?: string[];
}

export const MyWangAIModal: React.FC<MyWangAIModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions,
  stats,
  user,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Suggested prompt chips
  const quickPrompts = [
    { label: '🍴 Belanja Makan Bulan Ini', query: 'Berapa aku belanja makan bulan ni?' },
    { label: '🛒 Perbelanjaan Terbanyak', query: 'Mana paling banyak duit aku keluar bulan ni?' },
    { label: '💰 Status Tunai & Simpanan', query: 'Berapa baki tunai cair dan simpanan bersih aku?' },
    { label: '💡 Nasihat Penjimatan', query: 'Bagi 3 cadangan penjimatan bulanan berdasarkan corak belanja aku' },
    { label: '📈 Perbandingan Bulan Lepas', query: 'Bandingkan perbelanjaan aku bulan ini dengan bulan lepas' },
  ];

  // Initialize initial greeting when modal opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialGreeting: ChatMessage = {
        id: 'msg_welcome',
        sender: 'ai',
        text: `Hai **${user?.full_name || user?.username || 'Firdaus'}**! 👋 Saya ialah **MyWang AI**, penasihat kewangan peribadi anda.\n\nSaya sedia menganalisis keseluruhan **${accounts.length} akaun** dan **${transactions.length} rekod transaksi** anda secara langsung.\n\nAnda boleh tanya saya apa sahaja tentang perbelanjaan, simpanan, atau aliran wang anda!`,
        timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: [
          'Berapa aku belanja makan bulan ni?',
          'Mana paling banyak duit aku keluar?',
          'Berapa baki simpanan & tunai sedia ada?',
        ],
      };
      setMessages([initialGreeting]);
    }
  }, [isOpen, user, accounts.length, transactions.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (queryToSend?: string) => {
    const text = queryToSend || inputQuery;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-financial-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text.trim(),
          accounts,
          transactions,
          stats,
          user,
        }),
      });

      const resData = await response.json();

      if (resData && resData.status === 'success' && resData.data) {
        const aiMsg: ChatMessage = {
          id: 'msg_ai_' + Date.now(),
          sender: 'ai',
          text: resData.data.answer || 'Maaf, saya tidak dapat memproses maklumat tersebut.',
          timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
          highlightStats: resData.data.highlightStats || [],
          suggestedQuestions: resData.data.suggestedQuestions || [],
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(resData?.message || 'Ralat komunikasi.');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'ai',
        text: `Maaf, saya mengalami ralat semasa menganalisis data anda: ${err.message || 'Sila cuba lagi sebentar lagi.'}`,
        timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col h-[88vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">MyWang AI</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                    Gemini 3.7 Intelligence
                  </span>
                </div>
                <p className="text-xs text-white/80">
                  Penasihat Kewangan Peribadi & Analisis Aliran Wang Real-Time
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Soalan Pantas:
            </span>
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.query)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all active:scale-95 shadow-xs disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Chat Messages List */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {isAi && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[78%] space-y-2.5`}>
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isAi
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm'
                          : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 rounded-br-xs'
                      }`}
                    >
                      {isAi ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-xs sm:text-sm">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}

                      <span
                        className={`text-[10px] block mt-2 text-right ${
                          isAi ? 'text-slate-400' : 'text-emerald-100'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* AI Highlight Stats Cards if returned */}
                    {isAi && msg.highlightStats && msg.highlightStats.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {msg.highlightStats.map((st, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{st.label}</span>
                            <span className="font-black text-slate-900 dark:text-white block mt-0.5">{st.value}</span>
                            {st.change && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                                {st.change}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Follow-up question chips */}
                    {isAi && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            disabled={isLoading}
                            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                          >
                            <span>{q}</span>
                            <ChevronRight className="w-3 h-3 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isAi && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    MyWang AI sedang menganalisis data kewangan anda...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="Tanya soalan kewangan (cth: 'Berapa aku belanja makan bulan ni?')..."
                className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputQuery.trim() || isLoading}
                className="absolute right-2 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              MyWang AI menganalisis data secara selamat dalam backend. Maklumat peribadi tidak dikongsi ke luar.
            </p>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
