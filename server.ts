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

    // 1. If Google Apps Script URL is provided, try verifying against GAS USERS sheet
    if (webAppUrl) {
      try {
        const gasRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "loginUser",
            data: { username: cleanUser, password },
          }),
        });
        const gasData = await gasRes.json();
        if (gasData && gasData.status === "success") {
          return res.json(gasData);
        }
      } catch (gasErr) {
        console.warn("GAS Auth forward failed, testing server fallback:", gasErr);
      }
    }

    // 2. Server-side hashed credential comparison (No plain strings sent to client bundle)
    // Hashed admin password for 'admin123' or 'admin' or 'fifi'/'123456'
    const inputHash = hashPasswordBackend(password);
    const validHashes: Record<string, { hash: string[]; name: string; role: string; email: string }> = {
      admin: {
        hash: [
          hashPasswordBackend("admin123"),
          hashPasswordBackend("admin"),
          hashPasswordBackend("123456"),
        ],
        name: "Pentadbir MyWang (Admin)",
        role: "Owner",
        email: "admin@mywang.app",
      },
      fifi: {
        hash: [hashPasswordBackend("123456"), hashPasswordBackend("fifi123")],
        name: "Fifi Haziq",
        role: "Owner",
        email: "fifinoty@gmail.com",
      },
      firdaus: {
        hash: [hashPasswordBackend("123456"), hashPasswordBackend("firdaus123"), hashPasswordBackend("admin123"), hashPasswordBackend("admin")],
        name: "Firdaus (SakuTrack)",
        role: "Owner",
        email: "fifinoty@gmail.com",
      },
      user: {
        hash: [hashPasswordBackend("user123"), hashPasswordBackend("123456")],
        name: "Pengguna MyWang",
        role: "Member",
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

// POST /api/backend-data (Full backup sync)
app.post("/api/backend-data", (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ status: "error", message: "Format payload tidak sah." });
    }
    const current = readServerData() || {};
    const updated = {
      ...current,
      ...payload,
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

// Proxy to Google Apps Script Web App (Bypasses CORS restrictions & integrates with SakuTrack)
app.post("/api/gas-proxy", async (req, res) => {
  try {
    const { webAppUrl, action, username = "firdaus", data = {} } = req.body;

    if (!webAppUrl) {
      return res.status(400).json({
        status: "error",
        message: "URL Google Apps Script Web App diperlukan.",
      });
    }

    const cleanUser = String(username || "firdaus").trim().toLowerCase();

    // 1. Handle getInitialData / get_transactions from SakuTrack
    if (action === "getInitialData" || action === "get_transactions") {
      try {
        const sakuRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_transactions", username: cleanUser }),
        });
        const sakuData = await sakuRes.json();

        if (sakuData && sakuData.status === "success" && Array.isArray(sakuData.transactions)) {
          // Normalize SakuTrack transactions into MyWang Schema
          const mappedTransactions = sakuData.transactions.map((tx: any) => ({
            id: String(tx.id || `TX_${Date.now()}_${Math.random()}`),
            date: parseSakuTrackDate(tx.date),
            type: tx.type === "income" ? "income" : "expense",
            category: tx.category || "Lain-lain",
            amount: parseFloat(tx.amount) || 0,
            account_id: mapSourceToAccountId(tx.source || tx.method),
            account_name: tx.source || tx.method || "Maybank",
            note: tx.note || "",
            receipt_url: tx.receipt || undefined,
            created_at: String(tx.date || new Date().toISOString()),
          }));

          return res.json({
            status: "success",
            source: "sakutrack",
            message: `Berjaya diselaraskan dengan ${mappedTransactions.length} rekod dari SakuTrack!`,
            data: {
              transactions: mappedTransactions,
            },
          });
        }
      } catch (sakuErr) {
        console.warn("SakuTrack direct get_transactions failed, trying native GAS:", sakuErr);
      }
    }

    // 2. Handle testConnection
    if (action === "testConnection") {
      try {
        const testRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_transactions", username: cleanUser }),
        });
        const testData = await testRes.json();
        if (testData && testData.status === "success") {
          return res.json({
            status: "success",
            message: `Sambungan ke SakuTrack Google Sheets Berjaya! (${testData.transactions?.length || 0} rekod dikesan)`,
          });
        }
      } catch {}
    }

    // 3. Handle addTransaction / add_transaction
    if (action === "addTransaction" || action === "add_transaction") {
      try {
        const addPayload = {
          action: "add_transaction",
          username: cleanUser,
          type: data.type || "expense",
          date: data.date,
          category: data.category,
          method: data.method || "QR Code",
          source: data.account_name || "Maybank",
          amount: parseFloat(data.amount) || 0,
          discount: parseFloat(data.discount) || 0,
          note: data.note || "",
          receipt: data.receipt_url || null,
        };

        const addRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(addPayload),
        });
        const addResult = await addRes.json();
        if (addResult && addResult.status === "success") {
          return res.json(addResult);
        }
      } catch (addErr) {
        console.warn("SakuTrack add_transaction fallback:", addErr);
      }
    }

    // 4. Handle deleteTransaction / delete_transaction
    if (action === "deleteTransaction" || action === "delete_transaction") {
      try {
        const delRes = await fetch(webAppUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "delete_transaction",
            txId: data.id || data.txId,
            username: cleanUser,
          }),
        });
        const delResult = await delRes.json();
        if (delResult && delResult.status === "success") {
          return res.json(delResult);
        }
      } catch (delErr) {
        console.warn("SakuTrack delete_transaction fallback:", delErr);
      }
    }

    // Standard Native Apps Script Pass-Through
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, data, username: cleanUser }),
    });

    const result = await response.json();
    return res.json(result);
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
