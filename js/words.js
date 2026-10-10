/* invoice-maker-bd — number-to-words module.
 * Converts an amount in POISHA (integer) to words in English and Bangla,
 * using the lakh/crore (South Asian) grouping that Bangladeshi invoices use.
 * E.g. 1250000 poisha (৳12,500.00):
 *   EN → "Twelve thousand five hundred taka only"
 *   BN → "বারো হাজার পাঁচশত টাকা মাত্র"
 * Supported range: 0 .. 9,999,999,999 poisha (just under ৳10 crore).
 * Money math elsewhere in the app is done in integer poisha so the
 * words always match the printed total exactly.
 */
(function (root) {
  'use strict';

  var MAX_POISHA = 9999999999;

  // ---------- English ----------
  var EN_ONES = ['zero','one','two','three','four','five','six','seven','eight','nine',
    'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
    'eighteen','nineteen'];
  var EN_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

  // words for 0..999
  function enUnder1000(n) {
    var parts = [];
    var h = Math.floor(n / 100), r = n % 100;
    if (h > 0) {
      parts.push(EN_ONES[h] + ' hundred');
      if (r > 0) parts.push(enUnder100(r));
    } else if (r > 0 || n === 0) {
      parts.push(enUnder100(r === 0 && n === 0 ? 0 : r));
    }
    return parts.join(' ');
  }
  function enUnder100(n) {
    if (n < 20) return EN_ONES[n];
    var t = Math.floor(n / 10), o = n % 10;
    return EN_TENS[t] + (o > 0 ? '-' + EN_ONES[o] : '');
  }
  // Lakh/crore decomposition: crore | lakh | thousand | rest(<1000)
  function enInt(n) {
    if (n === 0) return 'zero';
    var parts = [];
    var crore = Math.floor(n / 10000000);
    var lakh = Math.floor((n % 10000000) / 100000);
    var thou = Math.floor((n % 100000) / 1000);
    var rest = n % 1000;
    if (crore > 0) parts.push(enUnder1000(crore) + ' crore');
    if (lakh > 0) parts.push(enUnder100(lakh) + ' lakh');
    if (thou > 0) parts.push(enUnder100(thou) + ' thousand');
    if (rest > 0) parts.push(enUnder1000(rest));
    return parts.join(' ');
  }

  function enAmount(poisha) {
    if (!Number.isInteger(poisha) || poisha < 0 || poisha > MAX_POISHA) return '';
    var taka = Math.floor(poisha / 100), p = poisha % 100;
    var s = enInt(taka) + ' taka';
    s += (p > 0) ? ' and ' + enInt(p) + ' poisha' : ' only';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Bangla ----------
  // 0..99 — standard spellings
  var BN = ['শূন্য','এক','দুই','তিন','চার','পাঁচ','ছয়','সাত','আট','নয়',
    'দশ','এগারো','বারো','তেরো','চৌদ্দ','পনেরো','ষোলো','সতেরো','আঠারো','ঊনিশ',
    'বিশ','একুশ','বাইশ','তেইশ','চব্বিশ','পঁচিশ','ছাব্বিশ','সাতাশ','আঠাশ','ঊনত্রিশ',
    'ত্রিশ','একত্রিশ','বত্রিশ','তেত্রিশ','চৌত্রিশ','পঁয়ত্রিশ','ছত্রিশ','সাঁইত্রিশ','আটত্রিশ','ঊনচল্লিশ',
    'চল্লিশ','একচল্লিশ','বিয়াল্লিশ','তেতাল্লিশ','চুয়াল্লিশ','পঁয়তাল্লিশ','ছেচল্লিশ','সাতচল্লিশ','আটচল্লিশ','ঊনপঞ্চাশ',
    'পঞ্চাশ','একান্ন','বাহান্ন','তিপ্পান্ন','চুয়ান্ন','পঞ্চান্ন','ছাপ্পান্ন','সাতান্ন','আটান্ন','ঊনষাট',
    'ষাট','একষট্টি','বাষট্টি','তেষট্টি','চৌষট্টি','পঁয়ষট্টি','ছেষট্টি','সাতষট্টি','আটষট্টি','ঊনসত্তর',
    'সত্তর','একাত্তর','বাহাত্তর','তিয়াত্তর','চুয়াত্তর','পঁচাত্তর','ছিয়াত্তর','সাতাত্তর','আটাত্তর','ঊনআশি',
    'আশি','একাশি','বিরাশি','তিরাশি','চুরাশি','পঁচাশি','ছিয়াশি','সাতাশি','আটাশি','ঊননব্বই',
    'নব্বই','একানব্বই','বিরানব্বই','তিরানব্বই','চুরানব্বই','পঁচানব্বই','ছিয়ানব্বই','সাতানব্বই','আটানব্বই','নিরানব্বই'];

  // words for 0..999: e.g. 500 → পাঁচশত, 685 → ছয়শত পঁচাশি
  function bnUnder1000(n) {
    var h = Math.floor(n / 100), r = n % 100, parts = [];
    if (h > 0) parts.push(BN[h] + 'শত');
    if (r > 0) parts.push(BN[r]);
    if (n === 0) parts.push(BN[0]);
    return parts.join(' ');
  }
  function bnInt(n) {
    if (n === 0) return BN[0];
    var parts = [];
    var crore = Math.floor(n / 10000000);
    var lakh = Math.floor((n % 10000000) / 100000);
    var thou = Math.floor((n % 100000) / 1000);
    var rest = n % 1000;
    if (crore > 0) parts.push(bnUnder1000(crore) + ' কোটি');
    if (lakh > 0) parts.push(bnUnder1000(lakh) + ' লাখ');
    if (thou > 0) parts.push(bnUnder1000(thou) + ' হাজার');
    if (rest > 0) parts.push(bnUnder1000(rest));
    return parts.join(' ');
  }

  function bnAmount(poisha) {
    if (!Number.isInteger(poisha) || poisha < 0 || poisha > MAX_POISHA) return '';
    var taka = Math.floor(poisha / 100), p = poisha % 100;
    var s = bnInt(taka) + ' টাকা';
    s += (p > 0) ? ' ' + bnInt(p) + ' পয়সা' : ' মাত্র';
    return s;
  }

  root.InvoiceWords = {
    en: enAmount,      // en(poishaInt) -> "Twelve thousand five hundred taka only"
    bn: bnAmount,      // bn(poishaInt) -> "বারো হাজার পাঁচশত টাকা মাত্র"
    MAX_POISHA: MAX_POISHA
  };
})(typeof window !== 'undefined' ? window : globalThis);
