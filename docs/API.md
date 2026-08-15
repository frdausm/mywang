# Dokumentasi API Google Apps Script — MyWang

API ini dibina di atas Google Apps Script Web App untuk menyediakan komunikasi JSON API selamat antara frontend MyWang dan Google Sheets.

Base URL: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

---

## 1. GET Requests (`doGet`)

Semua endpoint GET dipanggil melalui parameter query `?action={ACTION_NAME}`.

### `GET ?action=ping`
Menguji status sambungan Google Apps Script API.

### `GET ?action=getDashboard`
Mengambil semua data ringkasan kad, baki akaun, transaksi terkini, dan statistik carta.

---

## 2. POST Requests (`doPost`)

Semua permintaan dihantar dengan payload JSON:
```json
{
  "action": "ACTION_NAME",
  "data": { ... }
}
```

### `POST loginUser`
Membuat validasi pengguna dan memeriksa hash kata laluan dari sheet `USERS`.

```json
{
  "action": "loginUser",
  "data": {
    "username": "admin",
    "password": "your_password"
  }
}
```

### `POST saveAccount` / `updateBalance`
Mengemaskini nama akaun, baki semasa, atau nota.

```json
{
  "action": "saveAccount",
  "data": {
    "id": "acc_mb_sav",
    "bank": "Maybank",
    "account_name": "Savings Account",
    "balance": 5420.50,
    "notes": "Simpanan utama"
  }
}
```

### `POST addAccount`
Menambah akaun bank / e-wallet / credit card baru.

```json
{
  "action": "addAccount",
  "data": {
    "bank": "CIMB",
    "account_name": "AirAsia Savers",
    "type": "bank",
    "balance": 1500.00,
    "color": "from-red-500 to-red-700",
    "icon": "Landmark"
  }
}
```

### `POST transferMoney`
Melakukan pindahan dana antara akaun dengan dual-entry auto balance update.

```json
{
  "action": "transferMoney",
  "data": {
    "from_account_id": "acc_mb_sav",
    "to_account_id": "acc_tng",
    "amount": 100.00,
    "date": "2026-08-14",
    "note": "Topup TNG eWallet"
  }
}
```

### `POST addIncome` & `addExpense`
Merekod transaksi duit masuk atau duit keluar.

```json
{
  "action": "addIncome",
  "data": {
    "date": "2026-08-14",
    "account_id": "acc_mb_sav",
    "category": "Gaji",
    "amount": 4500.00,
    "note": "Gaji Ogos 2026"
  }
}
```

### `POST extractReceiptData`
Mengekstrak maklumat resit (merchant, jumlah RM, tarikh, kategori).
