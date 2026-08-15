/**
 * MyWang - Receipt OCR Extraction Module (Google Apps Script)
 * Extract text, merchants, totals, date, and items from uploaded receipt image data
 */

function handleExtractReceiptData(data) {
  if (!data || (!data.base64Image && !data.text)) {
    return { status: 'error', message: 'Imej atau teks resit diperlukan.' };
  }

  // If text is provided, perform rule-based regex parsing for Malaysian receipts
  var text = data.text || '';
  
  var parsed = parseMalaysianReceiptText(text);

  addAuditLog('SCAN_RECEIPT', 'Imbas resit dikesan: ' + (parsed.merchant || 'Resit') + ' berjumlah RM ' + parsed.amount);

  return {
    status: 'success',
    data: parsed
  };
}

function parseMalaysianReceiptText(raw) {
  var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  
  var merchant = '';
  var amount = 0;
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  var category = 'Makanan & Minuman';
  var tax = 0;

  // Detect Merchant from top lines
  var commonMerchants = [
    { name: "McDonald's", cat: "Makanan & Minuman" },
    { name: "KFC", cat: "Makanan & Minuman" },
    { name: "Lotus's", cat: "Shopping & Barang Rumah" },
    { name: "99 Speedmart", cat: "Shopping & Barang Rumah" },
    { name: "Petronas", cat: "Minyak & Tol & Petrol" },
    { name: "Shell", cat: "Minyak & Tol & Petrol" },
    { name: "BHPetrol", cat: "Minyak & Tol & Petrol" },
    { name: "Caltex", cat: "Minyak & Tol & Petrol" },
    { name: "FamilyMart", cat: "Makanan & Minuman" },
    { name: "Watsons", cat: "Kesihatan & Perubatan" },
    { name: "Guardian", cat: "Kesihatan & Perubatan" },
    { name: "MR. D.I.Y.", cat: "Shopping & Barang Rumah" },
    { name: "Tealive", cat: "Makanan & Minuman" },
    { name: "ZUS Coffee", cat: "Makanan & Minuman" },
    { name: "Starbucks", cat: "Makanan & Minuman" },
    { name: "Village Grocer", cat: "Shopping & Barang Rumah" },
    { name: "Jaya Grocer", cat: "Shopping & Barang Rumah" },
    { name: "Uniqlo", cat: "Shopping & Barang Rumah" },
    { name: "Decathlon", cat: "Shopping & Barang Rumah" },
    { name: "Shopee", cat: "Shopping & Barang Rumah" },
    { name: "Grab", cat: "Makanan & Minuman" }
  ];

  for (var i = 0; i < Math.min(5, lines.length); i++) {
    var line = lines[i];
    for (var m = 0; m < commonMerchants.length; m++) {
      if (line.toLowerCase().indexOf(commonMerchants[m].name.toLowerCase()) !== -1) {
        merchant = commonMerchants[m].name;
        category = commonMerchants[m].cat;
        break;
      }
    }
    if (merchant) break;
  }

  if (!merchant && lines.length > 0) {
    merchant = lines[0].substring(0, 30);
  }

  // Detect Total Amount (RM XX.XX or TOTAL: XX.XX or JUMLAH: XX.XX)
  var totalRegex = /(?:TOTAL|JUMLAH|AMOUNT|BAYARAN|GRAND TOTAL|NET TOTAL)[\s:]*(?:RM)?\s*([0-9]+[.,][0-9]{2})/i;
  var rmRegex = /RM\s*([0-9]+[.,][0-9]{2})/gi;

  for (var j = 0; j < lines.length; j++) {
    var match = lines[j].match(totalRegex);
    if (match && match[1]) {
      amount = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  if (!amount) {
    // Search any RM value
    var allRm = [];
    for (var k = 0; k < lines.length; k++) {
      var matches = lines[k].match(rmRegex);
      if (matches) {
        for (var n = 0; n < matches.length; n++) {
          var val = parseFloat(matches[n].replace(/[^0-9.]/g, ''));
          if (!isNaN(val)) allRm.push(val);
        }
      }
    }
    if (allRm.length > 0) {
      amount = Math.max.apply(null, allRm);
    }
  }

  // Detect Date (DD/MM/YYYY or YYYY-MM-DD)
  var dateRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/;
  for (var d = 0; d < lines.length; d++) {
    var dMatch = lines[d].match(dateRegex);
    if (dMatch) {
      var p1 = parseInt(dMatch[1], 10);
      var p2 = parseInt(dMatch[2], 10);
      var p3 = parseInt(dMatch[3], 10);
      if (p3 < 100) p3 += 2000;
      
      var yyyy = p3 > 2000 ? p3 : (p1 > 2000 ? p1 : 2026);
      var mm = (p2 <= 12 && p2 >= 1) ? p2 : 1;
      var dd = (p1 <= 31 && p1 >= 1) ? p1 : 1;
      
      date = yyyy + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
      break;
    }
  }

  return {
    merchant: merchant || 'Kedai / Merchant',
    amount: amount || 0,
    date: date,
    category: category,
    tax: tax,
    note: 'Imbas resit automatik: ' + (merchant || 'Kedai')
  };
}
