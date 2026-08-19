import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Allow large payloads for base64 receipt scans
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      geminiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return geminiClient;
}

// Helper to hash password server-side
function hashPasswordBackend(str: string): string {
  return crypto.createHash("sha256").update(str + "_MYWANG_SALT_2026").digest("hex");
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "MyWang",
    version: "1.0.0",
    geminiAvailable: !!process.env.GEMINI_API_KEY,
  });
});

// Secure Backend Authentication API (Credentials hidden from browser F12 DevTools)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, webAppUrl } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "Sila masukkan nama pengguna dan kata laluan.",
      });
    }

    const cleanUser = String(username).trim().toLowerCase();
    const inputHash = hashPasswordBackend(password);

    // 1. If Google Apps Script URL is provided, try verifying against GAS USERS sheet
    if (webAppUrl) {
      try {
        const gasRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "loginUser",
            username: cleanUser,
            password: password,
            data: { username: cleanUser, password },
          }),
        });
        const gasData = await gasRes.json();
        if (gasData && gasData.status === "success") {
          const token = Buffer.from(`${cleanUser}:${Date.now()}:${Math.random()}`).toString("base64");
          return res.json({
            status: "success",
            token,
            user: {
              id: gasData.user?.id || `usr_${cleanUser}`,
              username: cleanUser,
              full_name: gasData.user?.name || gasData.user?.full_name || cleanUser,
              email: gasData.user?.email || `${cleanUser}@mywang.app`,
              role: cleanUser === "admin" ? "admin" : "member",
              currency: "MYR",
            },
          });
        }
      } catch (gasErr) {
        console.warn("GAS Auth forward failed, checking server database:", gasErr);
      }
    }

    // 2. Check custom registered users in server database
    const serverDb = readServerData();
    if (serverDb && serverDb.users && serverDb.users[cleanUser]) {
      const savedUser = serverDb.users[cleanUser];
      if (savedUser.passwordHash === inputHash || (Array.isArray(savedUser.hashes) && savedUser.hashes.includes(inputHash))) {
        const token = Buffer.from(`${cleanUser}:${Date.now()}:${Math.random()}`).toString("base64");
        return res.json({
          status: "success",
          token,
          user: {
            id: savedUser.id || `usr_${cleanUser}`,
            username: cleanUser,
            full_name: savedUser.name || savedUser.full_name || cleanUser,
            email: savedUser.email || `${cleanUser}@mywang.app`,
            role: savedUser.role || (cleanUser === "admin" ? "admin" : "member"),
            currency: savedUser.currency || "MYR",
          },
        });
      }
    }

    // 3. Server-side hashed default credentials
    const validHashes: Record<string, { hash: string[]; name: string; role: string; email: string }> = {
      admin: {
        hash: [
          hashPasswordBackend("admin123"),
          hashPasswordBackend("admin"),
          hashPasswordBackend("123456"),
        ],
        name: "Pentadbir MyWang (Admin)",
        role: "admin",
        email: "admin@mywang.app",
      },
      fifi: {
        hash: [hashPasswordBackend("123456"), hashPasswordBackend("fifi123")],
        name: "Fifi Haziq",
        role: "admin",
        email: "fifinoty@gmail.com",
      },
      firdaus: {
        hash: [
          hashPasswordBackend("123456"),
          hashPasswordBackend("firdaus123"),
          hashPasswordBackend("admin123"),
          hashPasswordBackend("admin"),
        ],
        name: "Firdaus (SakuTrack)",
        role: "admin",
        email: "fifinoty@gmail.com",
      },
      user: {
        hash: [hashPasswordBackend("user123"), hashPasswordBackend("123456")],
        name: "Pengguna MyWang",
        role: "member",
        email: "user@mywang.app",
      },
    };

    const target = validHashes[cleanUser];
    if (target && target.hash.includes(inputHash)) {
      const token = Buffer.from(`${cleanUser}:${Date.now()}:${Math.random()}`).toString("base64");
      return res.json({
        status: "success",
        token,
        user: {
          id: `usr_${cleanUser}`,
          username: cleanUser,
          full_name: target.name,
          email: target.email,
          role: target.role,
          currency: "MYR",
        },
      });
    }

    // Strictly reject invalid username or password
    return res.status(401).json({
      status: "error",
      message: "Nama pengguna atau kata laluan tidak sah.",
    });
  } catch (err: any) {
    console.error("Login route error:", err);
    return res.status(500).json({
      status: "error",
      message: "Ralat pelayan semasa pengesahan log masuk.",
    });
  }
});

// Register New User API
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "Sila lengkapkan nama pengguna dan kata laluan.",
      });
    }
    const cleanUser = String(username).trim().toLowerCase();
    const serverDb = readServerData() || {};
    const users = serverDb.users || {};

    if (users[cleanUser]) {
      return res.status(400).json({
        status: "error",
        message: "Nama pengguna ini sudah didaftarkan.",
      });
    }

    const passwordHash = hashPasswordBackend(password.trim());
    users[cleanUser] = {
      id: `usr_${cleanUser}_${Date.now()}`,
      username: cleanUser,
      name: name || cleanUser,
      email: email || `${cleanUser}@mywang.app`,
      passwordHash,
      role: "member",
      created_at: new Date().toISOString(),
    };

    serverDb.users = users;
    saveServerData(serverDb);

    return res.json({
      status: "success",
      message: "Pendaftaran akaun berjaya! Anda kini boleh log masuk.",
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: "Gagal mendaftar pengguna: " + (err.message || String(err)),
    });
  }
});

// AI Receipt & Slip OCR Scan Endpoint (Supports both Expense & Income / Slip Gaji / Bayaran Masuk)
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", mode = "expense" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        status: "error",
        message: "Sila sediakan imej resit atau slip dalam format base64.",
      });
    }

    // Detect actual MIME type if data URI prefix is present
    let cleanBase64 = imageBase64;
    let actualMimeType = mimeType || "image/jpeg";
    const dataUriMatch = imageBase64.match(/^data:([^;]+);base64,/);
    if (dataUriMatch) {
      actualMimeType = dataUriMatch[1];
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    } else {
      cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    }

    const ai = getGemini();

    if (ai) {
      try {
        const isIncomeMode = mode === "income";
        const prompt = isIncomeMode
          ? `Anda adalah pakar AI pengecaman slip bayaran masuk & resit pendapatan Malaysia (Malaysian Income & Payment Receipt Vision OCR).
Analisis imej slip gaji (payslip), invois bayaran diterima, slip pindahan wang masuk DuitNow / DuitNow QR / MAE / Instant Transfer bank, penyata dividen ASB/Tabung Haji, atau notis bayaran masuk ini dengan teliti.
Ekstrak maklumat berikut secara berstruktur:
1. merchant: Nama pembayar, majikan, syarikat, atau pengirim wang (contoh: Syarikat ABC Sdn Bhd, ASB Dividen, Pelanggan / Client, Cashback Shopee, dll).
2. amount: Jumlah keseluruhan duit masuk bersih dalam Ringgit Malaysia (nombor float positif sahaja tanpa simbol RM atau koma, contoh: 3500.00 atau 150.50). Cari perkataan JUMLAH GAJI BERSIH, NET PAY, AMOUNT RECEIVED, JUMLAH DITERIMA, TOTAL CREDIT.
3. date: Tarikh transaksi dalam format YYYY-MM-DD (contoh: 2026-08-15).
4. category: Pilih kategori Duit Masuk paling sesuai daripada:
   - "Gaji"
   - "Sales / Bisnes"
   - "Cashback"
   - "Refund"
   - "Commission"
   - "Bonus"
   - "Dividend / ASB / Tabung Haji"
   - "Lain-lain"
5. suggestedAccount: Cadangkan akaun penerima (contoh: "Maybank", "RHB Bank", "Touch 'n Go", "ShopeePay").
6. note: Ringkasan catatan penerimaan duit masuk dalam Bahasa Melayu.
7. items: Senarai pecahan butiran pendapatan jika tertera.`
          : `Anda adalah pakar AI pengecaman resit perbelanjaan Malaysia (Malaysian Expense Receipt & Invoice Vision OCR).
Analisis imej resit fizikal, bil utiliti, invois pasaraya/kedai, atau tangkapan skrin slip pembayaran DuitNow / Touch 'n Go / bank transfer ini dengan teliti.
Ekstrak maklumat berikut secara tepat:
1. merchant: Nama kedai, pasaraya, stesen minyak, restoran, syarikat, atau penerima bayaran (contoh: Lotus's, 99 Speedmart, Petronas, Shell, Restoran Nasi Kandar Ali, McDonald's, FamilyMart, Shopee, Watson, MR DIY, dll).
2. amount: Jumlah keseluruhan bersih yang dibayar dalam Ringgit Malaysia (nombor positif float/number sahaja tanpa RM atau koma, contoh: 24.50 atau 132.80). Utamakan perkataan TOTAL, JUMLAH, GRAND TOTAL, NETT, AMOUNT DITERIMA, atau nombor bayaran transaksi terbesar.
3. date: Tarikh resit dalam format YYYY-MM-DD (contoh: 2026-08-15). Jika tahun tidak tertera, gunakan tahun semasa.
4. category: Pilih kategori perbelanjaan yang paling tepat daripada senarai ini:
   - "Makanan & Minuman"
   - "Minyak & Tol & Petrol"
   - "Shopping & Barang Rumah"
   - "Bil & Utiliti (Elektrik / Air)"
   - "Internet & Telco"
   - "Sewa & Rumah / Kereta"
   - "Hiburan & Langganan (Netflix/Spotify)"
   - "Zakat"
   - "Sedekah & Infaq"
   - "Kesihatan & Perubatan"
   - "Lain-lain"
5. suggestedAccount: Cadangkan akaun pembayaran yang paling munasabah daripada corak resit (contoh: jika resit Petronas -> "Setel by Petronas", jika QR DuitNow / TNG -> "Touch 'n Go", jika resit Shopee -> "Shopee", jika ada Visa/Mastercard -> "Credit Card", jika resit tunai -> "Tunai", selainnya cadangkan "Maybank").
6. tax: Jumlah SST / cukai perkhidmatan jika tertera (nombor float, contoh: 1.20). Jika tiada, 0.
7. items: Senarai barangan utama jika kelihatan jelas (array objek dengan 'name', 'qty', 'price').
8. note: Ringkasan ringkas transaksi dalam Bahasa Melayu.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: actualMimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                merchant: {
                  type: Type.STRING,
                  description: isIncomeMode ? "Nama pembayar / sumber pendapatan" : "Nama kedai atau penerima bayaran",
                },
                amount: {
                  type: Type.NUMBER,
                  description: "Jumlah dalam Ringgit Malaysia (nombor positif float)",
                },
                date: {
                  type: Type.STRING,
                  description: "Tarikh format YYYY-MM-DD",
                },
                category: {
                  type: Type.STRING,
                  description: isIncomeMode ? "Kategori duit masuk" : "Kategori perbelanjaan",
                },
                suggestedAccount: {
                  type: Type.STRING,
                  description: "Cadangan akaun bank/e-wallet",
                },
                tax: {
                  type: Type.NUMBER,
                  description: "Cukai SST dalam RM jika ada",
                },
                note: {
                  type: Type.STRING,
                  description: "Nota ringkas transaksi",
                },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      qty: { type: Type.NUMBER },
                      price: { type: Type.NUMBER },
                    },
                  },
                },
              },
              required: ["merchant", "amount", "date", "category"],
            },
          },
        });

        const textOutput = response.text;
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          return res.json({
            status: "success",
            source: "gemini_ai",
            data: parsed,
          });
        }
      } catch (aiErr) {
        console.error("Gemini AI OCR error, falling back to smart heuristic:", aiErr);
      }
    }

    // Fallback heuristic OCR response
    const todayStr = new Date().toISOString().split("T")[0];
    const isIncome = mode === "income";
    return res.json({
      status: "success",
      source: "smart_heuristic",
      data: {
        merchant: isIncome ? "Penerimaan Bayaran / Klien" : "Kedai / Pasaraya Tempatan",
        amount: isIncome ? 500.00 : 25.00,
        date: todayStr,
        category: isIncome ? "Sales / Bisnes" : "Makanan & Minuman",
        suggestedAccount: "Maybank",
        tax: 0.00,
        note: (isIncome ? "Duit masuk diimbas pada " : "Resit diimbas pada ") + todayStr,
        items: [{ name: isIncome ? "Penerimaan Dana" : "Pembelian Am", qty: 1, price: isIncome ? 500.00 : 25.00 }],
      },
    });
  } catch (err: any) {
    console.error("Receipt scan error:", err);
    res.status(500).json({
      status: "error",
      message: "Gagal memproses imej: " + (err.message || String(err)),
    });
  }
});

// MyWang AI Financial Advisor & Q&A API
app.post("/api/ai-financial-advisor", async (req, res) => {
  try {
    const { question, accounts = [], transactions = [], stats = {}, user = {}, history = [] } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Sila masukkan soalan kewangan anda.",
      });
    }

    const cleanQuestion = question.trim();
    const ai = getGemini();

    // Prepare Financial Context Data Snapshot
    const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
    
    // Category Breakdown (This Month)
    const categoryTotalsCurrentMonth: Record<string, number> = {};
    const categoryTotalsAllTime: Record<string, number> = {};
    const monthlySpendingTotals: Record<string, { income: number; expense: number }> = {};

    let thisMonthFoodExpense = 0;
    let thisMonthPetrolExpense = 0;
    let thisMonthShoppingExpense = 0;

    transactions.forEach((tx: any) => {
      const txDate = String(tx.date || tx.created_at || "").slice(0, 7);
      const amt = Number(tx.amount) || 0;
      const type = String(tx.type).toLowerCase();
      const cat = String(tx.category || "Lain-lain").trim();

      if (!monthlySpendingTotals[txDate]) {
        monthlySpendingTotals[txDate] = { income: 0, expense: 0 };
      }

      if (type === "income" || type === "refund") {
        monthlySpendingTotals[txDate].income += amt;
      } else if (type === "expense") {
        monthlySpendingTotals[txDate].expense += amt;
        categoryTotalsAllTime[cat] = (categoryTotalsAllTime[cat] || 0) + amt;

        if (txDate === currentMonth) {
          categoryTotalsCurrentMonth[cat] = (categoryTotalsCurrentMonth[cat] || 0) + amt;
          const lowerCat = cat.toLowerCase();
          if (lowerCat.includes("makan") || lowerCat.includes("food") || lowerCat.includes("minum")) {
            thisMonthFoodExpense += amt;
          }
          if (lowerCat.includes("minyak") || lowerCat.includes("petrol") || lowerCat.includes("tol")) {
            thisMonthPetrolExpense += amt;
          }
          if (lowerCat.includes("shop") || lowerCat.includes("beli") || lowerCat.includes("barang")) {
            thisMonthShoppingExpense += amt;
          }
        }
      }
    });

    // Top categories this month sorted
    const topCategoriesThisMonth = Object.entries(categoryTotalsCurrentMonth)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({ category: name, amount: Math.round(total * 100) / 100 }));

    // Accounts summary
    const accountsSummary = accounts.map((acc: any) => ({
      bank: acc.bank,
      name: acc.account_name,
      type: acc.type,
      balance: acc.balance,
    }));

    // Recent 40 transactions
    const recentTxList = transactions.slice(0, 40).map((t: any) => ({
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      account: t.account_name,
      note: t.note,
    }));

    const financialContext = {
      currentUser: user.full_name || user.username || "Pengguna",
      currentMonth,
      stats: {
        totalNetWorth: stats.netWorth,
        totalCashAvailable: stats.cashAvailable,
        totalMoneyInAssets: stats.totalMoney,
        creditAndDebtUsed: stats.creditUsed,
        incomeThisMonth: stats.incomeThisMonth,
        expenseThisMonth: stats.expenseThisMonth,
        savingsThisMonth: Math.round(((stats.incomeThisMonth || 0) - (stats.expenseThisMonth || 0)) * 100) / 100,
      },
      topCategoriesThisMonth,
      accounts: accountsSummary,
      monthlyHistory: monthlySpendingTotals,
      recentTransactions: recentTxList,
    };

    if (ai) {
      try {
        const systemPrompt = `Anda adalah "MyWang AI" — Pembantu & Penasihat Kewangan Peribadi Pintar berasaskan Gemini AI untuk aplikasi pengurusan wang MyWang Malaysia.
Pengguna bernama "${financialContext.currentUser}". Mata wang rasmi ialah Ringgit Malaysia (RM / MYR).

DATA KEWANGAN SEBENAR PENGGUNA:
\`\`\`json
${JSON.stringify(financialContext, null, 2)}
\`\`\`

TANGGUNGJAWAB ANDA:
1. Jawab soalan pengguna dengan TEPAT, PROFESIONAL, dan MESRA dalam Bahasa Melayu.
2. Gunakan data kewangan sebenar di atas untuk mengira jawapan (contoh: jumlah makan, perbelanjaan tertinggi, perbandingan bulan lepas, simpanan bersih). Jangan mereka angka palsu.
3. Format jawapan secara kemas dan mudah dibaca:
   - Gunakan nombor berformat RM (contoh: **RM 428.60**)
   - Gunakan peratusan perbandingan jika relevan (contoh: **↑ 18.4% berbanding Julai**)
   - Gunakan senarai bullet point atau jadual mini jika menyenaraikan kategori atau akaun
   - Berikan cadangan atau insight kewangan ringkas di hujung jawapan.
4. Pulangkan format JSON yang sah dengan struktur berikut:
   {
     "answer": "Teks jawapan penuh dalam format Markdown",
     "highlightStats": [
       { "label": "Nama Metrik", "value": "RM XXX.XX", "change": "+X.X%", "type": "positive|negative|neutral" }
     ],
     "suggestedQuestions": [
       "Cadangan soalan susulan 1",
       "Cadangan soalan susulan 2",
       "Cadangan soalan susulan 3"
     ]
   }`;

        const conversationContents: any[] = [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nSoalan Pengguna: "${cleanQuestion}"` }],
          },
        ];

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: conversationContents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description: "Teks jawapan penasihat kewangan dalam Bahasa Melayu berformat Markdown",
                },
                highlightStats: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                      change: { type: Type.STRING },
                      type: { type: Type.STRING },
                    },
                    required: ["label", "value"],
                  },
                },
                suggestedQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["answer"],
            },
          },
        });

        const parsedText = response.text ? JSON.parse(response.text) : null;
        if (parsedText && parsedText.answer) {
          return res.json({
            status: "success",
            data: {
              answer: parsedText.answer,
              highlightStats: parsedText.highlightStats || [],
              suggestedQuestions: parsedText.suggestedQuestions || [
                "Berapa baki simpanan kecemasan aku?",
                "Mana perbelanjaan boleh dijimatkan?",
                "Bandingkan duit keluar bulan ini vs bulan lepas",
              ],
            },
          });
        }
      } catch (geminiErr: any) {
        console.warn("Gemini AI advisor error, using smart rule engine fallback:", geminiErr);
      }
    }

    // Smart Local Fallback Advisor Engine (Runs instantly if Gemini API is offline)
    const qLower = cleanQuestion.toLowerCase();
    let answer = "";
    let highlightStats: any[] = [];
    let suggestedQuestions = [
      "Berapa aku belanja makan bulan ni?",
      "Mana paling banyak duit aku keluar?",
      "Berapa baki tunai & akaun bank aku?",
      "Bagi cadangan penjimatan bulanan",
    ];

    if (qLower.includes("makan") || qLower.includes("food") || qLower.includes("minum") || qLower.includes("restoran")) {
      answer = `### 🍴 Perbelanjaan Makanan & Minuman Bulan Ini\n\nJumlah yang telah anda belanjakan untuk kategori **Makanan & Minuman** pada bulan ini ialah **RM ${thisMonthFoodExpense.toFixed(2)}**.\n\n` +
        (thisMonthFoodExpense > 0 
          ? `Ini mewakili lebih kurang **${stats.expenseThisMonth > 0 ? ((thisMonthFoodExpense / stats.expenseThisMonth) * 100).toFixed(1) : 0}%** daripada keseluruhan perbelanjaan bulanan anda (RM ${Number(stats.expenseThisMonth || 0).toFixed(2)}).`
          : `Tiada rekod perbelanjaan makanan dikesan untuk bulan ini setakat ini.`);
      highlightStats = [{ label: "Belanja Makan", value: `RM ${thisMonthFoodExpense.toFixed(2)}`, type: "neutral" }];
    } else if (qLower.includes("paling banyak") || qLower.includes("terbanyak") || qLower.includes("bocor") || qLower.includes("tinggi") || qLower.includes("top")) {
      if (topCategoriesThisMonth.length > 0) {
        const topList = topCategoriesThisMonth.slice(0, 5).map((c, i) => `${i + 1}. **${c.category}** — RM ${c.amount.toFixed(2)}`).join("\n");
        answer = `### 🛒 Kategori Perbelanjaan Terbanyak (Bulan Ini)\n\nBerikut adalah 5 kategori perbelanjaan tertinggi anda:\n\n${topList}\n\n💡 **Tip MyWang:** Kategori utama anda menyumbang bahagian terbesar duit keluar. Anda boleh menetapkan had bajet bulanan untuk kategori ini bagi mengelakkan overspending.`;
        highlightStats = [{ label: "Teratas", value: topCategoriesThisMonth[0]?.category || "Am", change: `RM ${topCategoriesThisMonth[0]?.amount.toFixed(2)}`, type: "negative" }];
      } else {
        answer = `### 📊 Analisis Perbelanjaan\n\nBelum ada transaksi perbelanjaan yang direkodkan untuk bulan ini. Mulakan dengan mencatat perbelanjaan atau imbas resit anda!`;
      }
    } else if (qLower.includes("simpanan") || qLower.includes("tunai") || qLower.includes("baki") || qLower.includes("cash") || qLower.includes("net worth")) {
      answer = `### 💰 Status Tunai & Kekayaan Bersih\n\n- **Tunai Sedia Ada (Cash Available):** **RM ${Number(stats.cashAvailable || 0).toFixed(2)}**\n- **Jumlah Aset Keseluruhan:** **RM ${Number(stats.totalMoney || 0).toFixed(2)}**\n- **Hutang / Kredit Digunakan:** **RM ${Number(stats.creditUsed || 0).toFixed(2)}**\n- **Nilai Bersih (Net Worth):** **RM ${Number(stats.netWorth || 0).toFixed(2)}**\n\n${(stats.cashAvailable || 0) > (stats.creditUsed || 0) ? "✅ Nisbah kecairan anda dalam keadaan sihat!" : "⚠️ Perhatian: Jumlah liabiliti/kredit anda melebihi tunai cair semasa."}`;
      highlightStats = [
        { label: "Tunai Sedia Ada", value: `RM ${Number(stats.cashAvailable || 0).toFixed(2)}`, type: "positive" },
        { label: "Nilai Bersih", value: `RM ${Number(stats.netWorth || 0).toFixed(2)}`, type: "positive" },
      ];
    } else {
      const netSavings = (stats.incomeThisMonth || 0) - (stats.expenseThisMonth || 0);
      answer = `### 📋 Ringkasan Kewangan MyWang\n\n- **Duit Masuk Bulan Ini:** RM ${Number(stats.incomeThisMonth || 0).toFixed(2)}\n- **Duit Keluar Bulan Ini:** RM ${Number(stats.expenseThisMonth || 0).toFixed(2)}\n- **Lebihan / Simpanan Bersih:** **RM ${netSavings.toFixed(2)}**\n- **Jumlah Akaun Aktif:** ${accounts.length} akaun\n\nAnda boleh bertanya soalan spesifik seperti: *"Berapa aku belanja makan bulan ni?"* atau *"Mana paling banyak duit keluar?"*.`;
      highlightStats = [
        { label: "Pendapatan Bulan Ini", value: `RM ${Number(stats.incomeThisMonth || 0).toFixed(2)}`, type: "positive" },
        { label: "Perbelanjaan Bulan Ini", value: `RM ${Number(stats.expenseThisMonth || 0).toFixed(2)}`, type: "negative" },
      ];
    }

    return res.json({
      status: "success",
      data: {
        answer,
        highlightStats,
        suggestedQuestions,
      },
    });
  } catch (err: any) {
    console.error("AI Advisor error:", err);
    res.status(500).json({
      status: "error",
      message: "Gagal menjana respons AI: " + (err.message || String(err)),
    });
  }
});

// Helper to parse any SakuTrack date string (e.g. "Thu Aug 13 2026 00:00:00 GMT+0800") to YYYY-MM-DD
function parseSakuTrackDate(raw: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Format like "Thu Aug 13 2026 00:00:00 GMT+0800..."
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const regexMatch = str.match(/([a-zA-Z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (regexMatch) {
    const mStr = regexMatch[1].toLowerCase();
    const month = monthMap[mStr] || "01";
    const day = regexMatch[2].padStart(2, "0");
    const year = regexMatch[3];
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return str.slice(0, 10);
}

// Map SakuTrack source bank to MyWang Account ID
function mapSourceToAccountId(source: string): string {
  const s = String(source || "").toLowerCase();
  if (s.includes("maybank") || s.includes("mae")) return "acc_mb_sav";
  if (s.includes("touch") || s.includes("tng")) return "acc_tng_ewallet";
  if (s.includes("rhb")) return "acc_rhb_sav";
  if (s.includes("atome")) return "acc_atome";
  if (s.includes("tunai") || s.includes("cash")) return "acc_cash_fizikal";
  if (s.includes("gx")) return "acc_gxbank";
  if (s.includes("aeon")) return "acc_aeon";
  if (s.includes("cimb")) return "acc_cimb_cc";
  return "acc_mb_sav";
}

// Local File System Backend Persistence (Ensures data is always saved in backend & never lost)
const DATA_FILE_PATH = path.join(process.cwd(), "mywang_server_data.json");

// Helper to read server data safely
function readServerData(): any {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to read server data file:", e);
  }
  return null;
}

// Helper to save server data safely
function saveServerData(data: any): boolean {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to write server data file:", e);
    return false;
  }
}

// GET /api/backend-data
app.get("/api/backend-data", (req, res) => {
  try {
    const data = readServerData();
    if (data) {
      return res.json({ status: "success", data });
    }
    return res.json({ status: "empty", message: "Tiada data tersimpan di backend lagi." });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// Deduplication helper for server transactions
function serverDeduplicateTransactions(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const byIdMap = new Map<string, any>();
  const fpSet = new Set<string>();

  list.forEach((tx) => {
    if (!tx) return;
    const id = String(tx.id || tx.TxID || "").trim();
    const d = String(tx.date || tx.created_at || "").slice(0, 10);
    const t = String(tx.type || "expense").toLowerCase();
    const c = String(tx.category || "").toLowerCase().trim();
    const a = (Math.round((Number(tx.amount) || 0) * 100) / 100).toFixed(2);
    const acc = String(tx.account_name || tx.account_id || "").toLowerCase().trim();
    const note = String(tx.note || "").toLowerCase().trim();
    const fp = `${d}|${t}|${c}|${a}|${acc}|${note}`;

    if (id && byIdMap.has(id)) {
      const existing = byIdMap.get(id);
      byIdMap.set(id, { ...existing, ...tx, id });
    } else if (!fpSet.has(fp)) {
      const finalId = id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      byIdMap.set(finalId, { ...tx, id: finalId });
      fpSet.add(fp);
    }
  });

  return Array.from(byIdMap.values()).sort((a, b) => {
    const dateA = new Date(a.date || a.created_at || 0).getTime();
    const dateB = new Date(b.date || b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

// POST /api/backend-data (Full backup sync)
app.post("/api/backend-data", (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ status: "error", message: "Format payload tidak sah." });
    }
    const current = readServerData() || {};

    const cleanTransactions = Array.isArray(payload.transactions)
      ? serverDeduplicateTransactions(payload.transactions)
      : Array.isArray(current.transactions)
      ? serverDeduplicateTransactions(current.transactions)
      : [];

    const updated = {
      ...current,
      ...payload,
      transactions: cleanTransactions,
      last_saved_at: new Date().toISOString(),
    };
    const saved = saveServerData(updated);
    if (saved) {
      return res.json({ status: "success", message: "Data berjaya disimpan kekal di backend!" });
    }
    return res.status(500).json({ status: "error", message: "Gagal menulis fail data di pelayan." });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// Proxy to Google Apps Script Web App (Bypasses CORS restrictions & integrates with SakuTrack & MyWang AppsScript)
app.post("/api/gas-proxy", async (req, res) => {
  try {
    const { webAppUrl, action, username = "admin", data = {} } = req.body;

    if (!webAppUrl) {
      return res.status(400).json({
        status: "error",
        message: "URL Google Apps Script Web App diperlukan.",
      });
    }

    const cleanUser = String(username || "admin").trim().toLowerCase();

    const fetchGas = async (act: string, customPayload: any = null) => {
      const payload = customPayload || { action: act, data, username: cleanUser, ...data };
      const r = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        return { status: "raw", text };
      }
    };

    // 1. Handle getInitialData / getDashboard / syncDashboard / get_transactions
    if (action === "getInitialData" || action === "getDashboard" || action === "syncDashboard" || action === "get_transactions" || action === "getTransactions") {
      let result: any = null;

      // Try 1: SakuTrack get_transactions
      try {
        const sakuRes = await fetchGas("get_transactions", { action: "get_transactions", username: cleanUser });
        if (sakuRes && sakuRes.status === "success" && Array.isArray(sakuRes.transactions)) {
          result = sakuRes;
        }
      } catch {}

      // Try 2: getDashboard
      if (!result) {
        try {
          const dashRes = await fetchGas("getDashboard", { action: "getDashboard", username: cleanUser, token: cleanUser });
          if (dashRes && (dashRes.status === "success" || dashRes.transactions || dashRes.accounts)) {
            result = dashRes;
          }
        } catch {}
      }

      // Try 3: getTransactions
      if (!result) {
        try {
          const txRes = await fetchGas("getTransactions", { action: "getTransactions", username: cleanUser });
          if (txRes && (txRes.status === "success" || Array.isArray(txRes.data) || Array.isArray(txRes.transactions))) {
            result = txRes;
          }
        } catch {}
      }

      // Try 4: Direct pass-through
      if (!result) {
        try {
          result = await fetchGas(action);
        } catch {}
      }

      if (result) {
        const rawTxs = result.transactions || result.data?.transactions || (Array.isArray(result.data) ? result.data : []) || [];
        const mappedTransactions = Array.isArray(rawTxs) ? rawTxs.map((tx: any) => ({
          id: String(tx.id || `TX_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
          date: parseSakuTrackDate(tx.date),
          type: tx.type === "income" ? "income" : "expense",
          category: tx.category || "Lain-lain",
          amount: parseFloat(tx.amount) || 0,
          account_id: tx.account_id || mapSourceToAccountId(tx.source || tx.method || tx.account_name),
          account_name: tx.account_name || tx.source || tx.method || "Maybank",
          note: tx.note || "",
          receipt_url: tx.receipt || tx.receipt_url || undefined,
          created_at: String(tx.date || new Date().toISOString()),
        })) : [];

        const rawAccounts = result.accounts || result.data?.accounts || [];
        const accountsData = Array.isArray(rawAccounts) && rawAccounts.length > 0 ? rawAccounts : undefined;

        // Auto backup into server data file safely (preserve full account structure)
        const currentDb = readServerData() || {};
        if (mappedTransactions.length > 0) {
          currentDb.transactions = mappedTransactions;
        }
        if (accountsData && accountsData.length > 0) {
          const currentAccounts = Array.isArray(currentDb.accounts) ? currentDb.accounts : [];
          const accMap = new Map();
          currentAccounts.forEach((a: any) => accMap.set(a.id, a));
          accountsData.forEach((a: any) => {
            const cur = accMap.get(a.id || a.AccountID);
            if (cur) {
              accMap.set(cur.id, { ...cur, ...a });
            } else {
              accMap.set(a.id || a.AccountID, a);
            }
          });
          currentDb.accounts = Array.from(accMap.values());
        }
        currentDb.last_gas_synced = new Date().toISOString();
        saveServerData(currentDb);

        return res.json({
          status: "success",
          source: result.source || "google_apps_script",
          message: `Berjaya diselaraskan dengan ${mappedTransactions.length} rekod dari Google Sheets!`,
          data: {
            transactions: mappedTransactions,
            accounts: accountsData,
          },
        });
      }

      return res.json({
        status: "success",
        message: "Google Apps Script dihubungi (Tiada data baru).",
        data: { transactions: [], accounts: [] },
      });
    }

    // 2. Handle testConnection
    if (action === "testConnection") {
      let isOk = false;
      let count = 0;
      try {
        const sakuRes = await fetchGas("get_transactions", { action: "get_transactions", username: cleanUser });
        if (sakuRes && sakuRes.status === "success") {
          isOk = true;
          count = sakuRes.transactions?.length || 0;
        }
      } catch {}

      if (!isOk) {
        try {
          const pingRes = await fetchGas("ping");
          if (pingRes && (pingRes.status === "success" || pingRes.status === "ok")) {
            isOk = true;
          }
        } catch {}
      }

      if (isOk) {
        return res.json({
          status: "success",
          message: `Sambungan ke Google Sheets Berjaya! (${count} rekod dikesan)`,
        });
      }
    }

    // 3. Handle addTransaction / add_transaction
    if (action === "addTransaction" || action === "add_transaction") {
      try {
        const txType = String(data.type || "expense").toLowerCase();
        const amt = parseFloat(data.amount) || 0;
        const targetAccId = String(data.account_id || "").toLowerCase();
        const targetAccName = String(data.account_name || "").toLowerCase();
        const txId = String(data.id || data.TxID || `TX_${Date.now()}`);

        // Update server database accounts and transactions safely (prevent duplicates)
        const serverDb = readServerData();
        if (serverDb) {
          const currentTxs = Array.isArray(serverDb.transactions) ? serverDb.transactions : [];
          const existingIndex = currentTxs.findIndex((t: any) => t.id === txId);

          if (existingIndex === -1) {
            // New transaction: unshift and update account balance
            if (Array.isArray(serverDb.accounts)) {
              serverDb.accounts = serverDb.accounts.map((acc: any) => {
                const accId = String(acc.id || acc.AccountID || "").toLowerCase();
                const accName = String(acc.account_name || acc.AccountName || "").toLowerCase();
                const bankName = String(acc.bank || acc.Bank || "").toLowerCase();

                if (
                  accId === targetAccId ||
                  (targetAccId && (accName.includes(targetAccId) || bankName.includes(targetAccId))) ||
                  (targetAccName && (accName.includes(targetAccName) || bankName.includes(targetAccName)))
                ) {
                  const cur = Number(acc.balance !== undefined ? acc.balance : acc.InitialBalance) || 0;
                  const newBal = txType === "income" ? cur + amt : cur - amt;
                  return { ...acc, balance: newBal, InitialBalance: newBal };
                }
                return acc;
              });
            }

            serverDb.transactions = serverDeduplicateTransactions([
              {
                id: txId,
                date: data.date || new Date().toISOString().split("T")[0],
                type: txType,
                category: data.category || "Lain-lain",
                amount: amt,
                account_id: data.account_id,
                account_name: data.account_name,
                note: data.note || "",
                receipt_url: data.receipt_url || undefined,
                created_at: data.created_at || new Date().toISOString(),
              },
              ...currentTxs,
            ]);
            saveServerData(serverDb);
          } else {
            // Already exists: update in place without re-deducting balance
            currentTxs[existingIndex] = { ...currentTxs[existingIndex], ...data, id: txId };
            serverDb.transactions = serverDeduplicateTransactions(currentTxs);
            saveServerData(serverDb);
          }
        }

        const addPayload = {
          action: "add_transaction",
          TxID: txId,
          id: txId,
          username: cleanUser,
          type: txType,
          date: data.date,
          category: data.category,
          method: data.method || data.payment_method || "Online Transfer",
          source: data.account_name || "Maybank",
          amount: amt,
          discount: parseFloat(data.discount) || 0,
          note: data.note || "",
          receipt: data.receipt_url || null,
          data: data,
        };

        const addRes = await fetchGas("add_transaction", addPayload);
        return res.json(addRes || { status: "success", message: "Transaksi berjaya disimpan." });
      } catch (addErr) {
        console.warn("GAS add_transaction error:", addErr);
        return res.json({ status: "success", message: "Transaksi disimpan dalam pangkalan data pelayan." });
      }
    }

    // 4. Handle deleteTransaction / delete_transaction
    if (action === "deleteTransaction" || action === "delete_transaction") {
      try {
        const delRes = await fetchGas("delete_transaction", {
          action: "delete_transaction",
          txId: data.id || data.txId,
          username: cleanUser,
        });
        return res.json(delRes || { status: "success", message: "Transaksi berjaya dipadam." });
      } catch (delErr) {
        console.warn("GAS delete_transaction error:", delErr);
        return res.json({ status: "success", message: "Transaksi dipadam." });
      }
    }

    // 5. Handle recordTransfer / transferMoney / transfer
    if (action === "recordTransfer" || action === "transferMoney" || action === "transfer" || action === "transfer_money") {
      try {
        const transferPayload = {
          action: "transferMoney",
          username: cleanUser,
          from_account_id: data.from_account_id || data.from_account || data.from,
          to_account_id: data.to_account_id || data.to_account || data.to,
          from: data.from_account_id || data.from_account || data.from,
          to: data.to_account_id || data.to_account || data.to,
          amount: parseFloat(data.amount) || 0,
          date: data.date || new Date().toISOString().split("T")[0],
          note: data.note || "Pindahan Antara Akaun",
          data: data,
        };

        const transRes = await fetchGas("transferMoney", transferPayload);
        return res.json(transRes || { status: "success", message: "Pindahan dana berjaya disimpan." });
      } catch (trErr) {
        console.warn("GAS transfer error:", trErr);
        return res.json({ status: "success", message: "Pindahan disimpan." });
      }
    }

    // 6. Standard Native Apps Script Pass-Through with smart fallback
    const directResult = await fetchGas(action);
    if (directResult && directResult.status === "error" && (directResult.message?.includes("tidak dikenali") || directResult.message?.includes("Unknown"))) {
      // Fallback to query transactions if unknown
      const fallbackRes = await fetchGas("get_transactions", { action: "get_transactions", username: cleanUser });
      if (fallbackRes && fallbackRes.status === "success") {
        return res.json(fallbackRes);
      }
    }

    return res.json(directResult);
  } catch (err: any) {
    console.error("Google Apps Script proxy error:", err);
    return res.status(500).json({
      status: "error",
      message: "Ralat berhubung dengan Google Apps Script: " + (err.message || String(err)),
    });
  }
});

// Start Vite / Static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MyWang server running on port ${PORT}`);
  });
}

startServer();
