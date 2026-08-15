# Skema Struktur Pengkalan Data Google Sheets — MyWang

MyWang menggunakan 10 tab Google Sheets sebagai pangkalan data masa nyata (*Single Source of Truth*).

---

## 1. USERS
Menyimpan data akaun pengguna untuk keselamatan log masuk.

| Nama Kolum | Jenis Data | Penerangan | Contoh |
|---|---|---|---|
| `id` | String | ID Unik Pengguna | `usr_001` |
| `username` | String | Nama Pengguna | `admin` |
| `password_hash` | String | SHA-256 Hash + Salt | `e3b0c44298fc1c1...` |
| `full_name` | String | Nama Penuh | `Fifi Haziq` |
| `email` | String | Alamat Emel | `fifinoty@gmail.com` |
| `role` | String | Peranan Pengguna | `Owner` / `Member` |
| `created_at` | DateTime | Tarikh Didaftarkan | `2026-08-14T08:00:00Z` |

---

## 2. ACCOUNTS
Menyimpan maklumat semua akaun bank, e-wallet, credit card, dan paylater.

| Nama Kolum | Jenis Data | Penerangan | Contoh |
|---|---|---|---|
| `id` | String | ID Akaun | `acc_mb_sav` |
| `bank` | String | Institusi / Bank | `Maybank`, `RHB Bank`, `Touch 'n Go` |
| `account_name` | String | Nama Akaun | `Savings Account`, `MAE Digital Wallet` |
| `type` | String | Kategori Akaun | `bank`, `ewallet`, `credit_card`, `paylater`, `investment`, `cash` |
| `balance` | Number | Baki Semasa (RM) | `5420.50` (atau `-1240.00` untuk hutang kad) |
| `credit_limit` | Number | Had Kredit (jika ada) | `8000.00` |
| `color` | String | Kod Warna / Gradient | `from-amber-500 to-yellow-600` |
| `icon` | String | Ikon Lucide | `Landmark`, `Smartphone`, `CreditCard` |
| `notes` | String | Catatan Tambahan | `Akaun simpanan gaji` |
| `updated_at` | Date | Tarikh Terakhir Dikemaskini | `2026-08-14` |

---

## 3. TRANSACTIONS
Buku lejar utama untuk merekod semua aktiviti keluar masuk dan pindahan dana.

| Nama Kolum | Jenis Data | Penerangan | Contoh |
|---|---|---|---|
| `id` | String | ID Transaksi | `tx_1723618492000` |
| `date` | Date (YYYY-MM-DD) | Tarikh Transaksi | `2026-08-14` |
| `account_id` | String | ID Akaun Sumber | `acc_mb_mae` |
| `account_name` | String | Nama Akaun Sumber | `Maybank - MAE` |
| `to_account_id` | String | ID Akaun Sasaran (jika transfer) | `acc_tng` |
| `to_account_name` | String | Nama Akaun Sasaran | `Touch 'n Go` |
| `type` | String | Jenis Transaksi | `income`, `expense`, `transfer`, `adjustment` |
| `category` | String | Kategori | `Makanan & Minuman`, `Gaji`, `Transfer` |
| `amount` | Number | Jumlah (RM) | `18.50` |
| `note` | String | Nota / Perihal | `Nasi Lemak Ayam Berempah` |
| `created_at` | DateTime | Timestamp ISO | `2026-08-14T08:30:00Z` |

---

## 4. INCOME
Salinan lejar khusus duit masuk bagi tujuan rekod terperinci.

| `id` | `date` | `account` | `income_type` | `amount` | `note` | `created_at` |

---

## 5. EXPENSE
Salinan lejar khusus duit keluar bagi pengurusan bajet bulanan.

| `id` | `date` | `account` | `expense_type` | `amount` | `note` | `created_at` |

---

## 6. TRANSFERS
Rekod pindahan antara akaun secara dual-entry.

| `id` | `date` | `from_account` | `to_account` | `amount` | `note` | `created_at` |

---

## 7. INCOME_TYPES
Jenis-jenis punca pendapatan yang boleh disesuaikan.

| `id` | `name` | `color` | `icon` | `is_default` |
|---|---|---|---|---|
| `inc_gaji` | Gaji | `#10B981` | `Briefcase` | `TRUE` |
| `inc_sales` | Sales / Bisnes | `#3B82F6` | `TrendingUp` | `TRUE` |
| `inc_cashback` | Cashback | `#F59E0B` | `Coins` | `TRUE` |
| `inc_dividend` | Dividend / ASB | `#14B8A6` | `PiggyBank` | `TRUE` |

---

## 8. EXPENSE_TYPES
Kategori perbelanjaan yang boleh ditambah dan diedit sendiri dari frontend.

| `id` | `name` | `color` | `icon` | `is_default` |
|---|---|---|---|---|
| `exp_makan` | Makanan & Minuman | `#EF4444` | `Utensils` | `TRUE` |
| `exp_minyak` | Minyak & Tol & Petrol | `#F97316` | `Fuel` | `TRUE` |
| `exp_shopping` | Shopping & Barang Rumah | `#EC4899` | `ShoppingBag` | `TRUE` |
| `exp_bil` | Bil & Utiliti | `#3B82F6` | `Zap` | `TRUE` |
| `exp_sewa` | Sewa & Rumah / Kereta | `#8B5CF6` | `Home` | `TRUE` |

---

## 9. SETTINGS
Tetapan aplikasi, mata wang, had bajet, dan tarikh penyegerakan.

| `key` | `value` | `updated_at` |
|---|---|---|
| `currency` | `MYR` | `2026-08-14` |
| `dark_mode` | `true` | `2026-08-14` |

---

## 10. LOGS
Jejak audit (*Audit Trail*) untuk memantau semua perubahan yang berlaku pada akaun.

| `id` | `timestamp` | `action` | `details` | `user` |
|---|---|---|---|---|
| `log_001` | `2026-08-14 08:30:00` | `ADD_TRANSACTION` | Merekod Duit Keluar RM18.50 | `admin` |
| `log_002` | `2026-08-14 09:00:00` | `TRANSFER` | Pindahan RM200 Maybank ke TNG | `admin` |
