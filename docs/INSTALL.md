# Panduan Pemasangan & Integrasi Google Apps Script (MyWang)

Panduan lengkap langkah-demi-langkah untuk menghubungkan **MyWang Web App** dengan **Google Sheets** dan **Google Apps Script**.

---

## Langkah 1: Cipta Google Sheet Baru

1. Buka [Google Sheets](https://sheets.new) di pelayar web anda.
2. Namakan spreadsheet anda sebagai: **`MyWang_Database`**.
3. (Pilihan) Anda boleh klik butang **"Muat Turun Templat Google Sheets (.xlsx)"** di dalam dashboard MyWang untuk terus mendapatkan susunan tab dan formula siap.

---

## Langkah 2: Buka Google Apps Script Editor

1. Di dalam Google Sheets anda, klik pada menu atas: **Extensions (Sambungan)** > **Apps Script**.
2. Namakan projek Apps Script sebagai **`MyWang Backend API`**.

---

## Langkah 3: Salin Kod Apps Script

Salin fail-fail dari folder `appsscript/` ke dalam Apps Script Editor anda:

1. **`Code.gs`** (Utama / Entry Point)
2. **`Auth.gs`** (Pengesahan & Hash Kata Laluan)
3. **`Accounts.gs`** (Pengurusan Akaun Bank & Baki)
4. **`Transactions.gs`** (Duit Masuk, Keluar & Pindahan)
5. **`Charts.gs`** (Analisis Carta & Ringkasan)
6. **`Utils.gs`** (Inisialisasi 10 Sheet Automatik & Audit Log)
7. **`ReceiptOCR.gs`** (Pengekstrakan Resit)

*Tip:* Anda boleh menambah fail `.gs` baru dengan klik ikon **`+`** > **Script** di sidebar kiri Apps Script.

---

## Langkah 4: Jalankan Inisialisasi Database (Sekali Sahaja)

1. Di editor Apps Script, pilih fungsi `initializeDatabaseSheets` di dropdown atas.
2. Klik butang **Run (Jalankan)**.
3. Google akan meminta kebenaran (Review Permissions). Klik akaun anda, klik *Advanced*, dan klik *Go to MyWang Backend API (unsafe)* untuk memberi kebenaran membaca/menulis ke Google Sheet anda.
4. Skrip akan secara automatik mencipta 10 tab Google Sheet:
   - `USERS`
   - `ACCOUNTS`
   - `TRANSACTIONS`
   - `INCOME`
   - `EXPENSE`
   - `TRANSFERS`
   - `INCOME_TYPES`
   - `EXPENSE_TYPES`
   - `SETTINGS`
   - `LOGS`

---

## Langkah 5: Deploy sebagai Web App

1. Klik butang biru **Deploy** (atas kanan) > **New deployment**.
2. Klik ikon gear di sebelah kiri > pilih **Web app**.
3. Isi tetapan berikut:
   - **Description:** `MyWang Production v1.0`
   - **Execute as:** `Me (your_email@gmail.com)`
   - **Who has access:** `Anyone` *(PENTING: Pastikan ini dipilih supaya Web App boleh berhubung secara JSON API)*
4. Klik **Deploy**.
5. Salin URL **Web App URL** yang dihasilkan (contoh: `https://script.google.com/macros/s/AKfycbx.../exec`).

---

## Langkah 6: Masukkan Web App URL ke dalam MyWang

1. Buka aplikasi **MyWang**.
2. Klik ikon **Settings / Google Sheets (⚙️ / 📊)** di bar atas.
3. Tampal URL Web App anda ke dalam ruangan **"Google Apps Script Web App URL"**.
4. Klik butang **"Uji Sambungan & Segerak (Test & Sync)"**.
5. Tahniah! Aplikasi anda kini bersambung secara langsung dengan Google Sheets anda secara masa nyata (*real-time auto-save*).
