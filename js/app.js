/* invoice-maker-bd — app logic. All money math in integer POISHA to stay exact. */
(function () {
  'use strict';

  var LS_PROFILE = 'imbd_profile_v1';
  var LS_HISTORY = 'imbd_history_v1';
  var LS_DRAFT = 'imbd_draft_v1';
  var LS_LANG = 'imbd_lang_v1';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- money helpers (poisha integers) ----
  // "1250.50" -> 125050 ; returns null when invalid
  function toPoisha(str) {
    if (str === '' || str == null) return null;
    var n = Number(String(str).trim());
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }
  // 368550 -> "3,685.50" (lakh-style grouping)
  function fmtPoisha(p) {
    var neg = p < 0; p = Math.abs(Math.round(p));
    var taka = Math.floor(p / 100), ps = p % 100;
    var s = String(taka), out = '';
    if (s.length > 3) {
      out = ',' + s.slice(-3);
      s = s.slice(0, -3);
      while (s.length > 2) { out = ',' + s.slice(-2) + out; s = s.slice(0, -2); }
      out = s + out;
    } else out = s;
    return (neg ? '-' : '') + out + '.' + String(ps).padStart(2, '0');
  }

  // ---- state ----
  function blankItem() { return { desc: '', qty: '1', unit: '', price: '' }; }
  function defaultState() {
    var today = new Date().toISOString().slice(0, 10);
    return {
      biz: { name: '', addr: '', phone: '', email: '', prefix: 'INV-', logo: '' },
      client: { name: '', addr: '', phone: '' },
      meta: { no: '', issue: today, due: '', status: 'unpaid' },
      items: [blankItem()],
      discountPct: '0', vatPct: '0', notes: '',
      counter: 1
    };
  }
  var S = defaultState();
  var lang = localStorage.getItem(LS_LANG) || 'en';
  var history = [];

  function t(key) { return (window.InvoiceI18n[lang] && window.InvoiceI18n[lang][key]) || window.InvoiceI18n.en[key] || key; }

  // ---- totals (pure, exact integer math) ----
  // discount % on subtotal, then VAT % on (subtotal - discount); each rounded to poisha.
  function computeTotals(items, discountPct, vatPct) {
    var sub = 0;
    items.forEach(function (it) {
      var q = Number(it.qty), pr = toPoisha(it.price);
      if (it.desc && it.desc.trim() && q > 0 && pr !== null) sub += Math.round(q * pr);
    });
    var d = Math.min(100, Math.max(0, Number(discountPct) || 0));
    var v = Math.min(100, Math.max(0, Number(vatPct) || 0));
    var disc = Math.round(sub * d / 100);
    var vat = Math.round((sub - disc) * v / 100);
    return { subtotal: sub, discount: disc, vat: vat, grand: sub - disc + vat };
  }

  // ---- persistence ----
  function saveDraft() {
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(S)); } catch (e) {}
  }
  function loadAll() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_PROFILE) || 'null');
      if (p && p.biz) S.biz = Object.assign(S.biz, p.biz);
      if (p && typeof p.counter === 'number') S.counter = p.counter;
    } catch (e) {}
    try { history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]') || []; } catch (e) { history = []; }
    try {
      var d = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null');
      if (d && d.items) { var biz = S.biz, counter = S.counter; S = Object.assign(defaultState(), d); S.biz = Object.assign(biz, d.biz || {}); S.counter = counter; }
    } catch (e) {}
  }
  function persistProfile() {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify({ biz: S.biz, counter: S.counter })); } catch (e) {}
  }
  function persistHistory() {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch (e) {}
  }

  // ---- invoice number ----
  function nextInvNo() {
    return (S.biz.prefix || 'INV-') + String(S.counter).padStart(4, '0');
  }

  // ---- validation ----
  function validateItems() {
    for (var i = 0; i < S.items.length; i++) {
      var it = S.items[i];
      if (!it.desc || !it.desc.trim()) return t('errItemDesc');
      if (!(Number(it.qty) > 0)) return t('errQty');
      if (toPoisha(it.price) === null) return t('errPrice');
    }
    return null;
  }

  // ---- rendering ----
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(el._h); el._h = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function applyI18n() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    $('invStatus').options[0].textContent = t('unpaid');
    $('invStatus').options[1].textContent = t('unpaid') === 'Unpaid' ? 'Paid' : t('paid');
  }

  function renderItems() {
    var host = $('itemRows'); host.innerHTML = '';
    S.items.forEach(function (it, i) {
      var div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML =
        '<input class="it-desc" data-i="' + i + '" data-f="desc" placeholder="' + esc(t('desc')) + '" value="' + esc(it.desc) + '">' +
        '<input class="it-qty" data-i="' + i + '" data-f="qty" type="number" min="0" step="any" placeholder="' + esc(t('qty')) + '" value="' + esc(it.qty) + '">' +
        '<input class="it-unit" data-i="' + i + '" data-f="unit" placeholder="' + esc(t('unit')) + '" value="' + esc(it.unit) + '">' +
        '<input class="it-price" data-i="' + i + '" data-f="price" type="number" min="0" step="0.01" placeholder="0.00" value="' + esc(it.price) + '">' +
        '<span class="it-line" id="lineTotal' + i + '"></span>' +
        '<span class="it-ops"><button class="btn mini" data-act="up" data-i="' + i + '" title="↑">↑</button>' +
        '<button class="btn mini" data-act="down" data-i="' + i + '" title="↓">↓</button>' +
        '<button class="btn mini danger-ghost" data-act="rm" data-i="' + i + '" title="✕">✕</button></span>';
      host.appendChild(div);
    });
    updateLineTotals();
  }

  function updateLineTotals() {
    var tot = computeTotals(S.items, S.discountPct, S.vatPct);
    S.items.forEach(function (it, i) {
      var el = $('lineTotal' + i);
      if (!el) return;
      var q = Number(it.qty), pr = toPoisha(it.price);
      el.textContent = (it.desc && it.desc.trim() && q > 0 && pr !== null) ? '৳' + fmtPoisha(Math.round(q * pr)) : '—';
    });
    return tot;
  }

  function renderSheet() {
    var tot = computeTotals(S.items, S.discountPct, S.vatPct);
    var W = window.InvoiceWords;
    var rows = S.items.map(function (it, i) {
      var q = Number(it.qty), pr = toPoisha(it.price);
      var line = (it.desc && it.desc.trim() && q > 0 && pr !== null) ? Math.round(q * pr) : 0;
      return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(it.desc) + (it.unit ? ' <span class="muted">(' + esc(it.unit) + ')</span>' : '') +
        '</td><td class="r">' + esc(it.qty) + '</td><td class="r">৳' + (pr === null ? '—' : fmtPoisha(pr)) +
        '</td><td class="r">৳' + fmtPoisha(line) + '</td></tr>';
    }).join('');
    var wordsEn = W.en(tot.grand), wordsBn = W.bn(tot.grand);
    var stamp = S.meta.status === 'paid'
      ? '<div class="stamp paid">' + esc(t('paid')).toUpperCase() + '</div>'
      : '<div class="stamp unpaid">' + esc(t('unpaid')).toUpperCase() + '</div>';
    $('invoiceSheet').innerHTML =
      '<div class="inv-head">' +
        '<div class="inv-biz">' +
          (S.biz.logo ? '<img class="inv-logo" src="' + S.biz.logo + '" alt="logo">' : '') +
          '<div><h2>' + esc(S.biz.name || '—') + '</h2>' +
          '<p>' + esc(S.biz.addr).replace(/\n/g, '<br>') + '</p>' +
          '<p>' + esc([S.biz.phone, S.biz.email].filter(Boolean).join(' · ')) + '</p></div>' +
        '</div>' +
        '<div class="inv-title"><h1>' + esc(t('printTitle')) + '</h1>' + stamp + '</div>' +
      '</div>' +
      '<div class="inv-meta">' +
        '<div><strong>' + esc(t('invNo')) + ':</strong> ' + esc(S.meta.no || nextInvNo()) + '<br>' +
        '<strong>' + esc(t('issueDate')) + ':</strong> ' + esc(S.meta.issue || '—') + '<br>' +
        '<strong>' + esc(t('dueDate')) + ':</strong> ' + esc(S.meta.due || '—') + '</div>' +
        '<div><strong>' + esc(t('client')) + '</strong><br>' + esc(S.client.name || '—') + '<br>' +
        esc(S.client.addr).replace(/\n/g, '<br>') + (S.client.phone ? '<br>' + esc(S.client.phone) : '') + '</div>' +
      '</div>' +
      '<div class="table-scroll"><table class="inv-table"><thead><tr><th class="c">#</th><th>' + esc(t('desc')) + '</th><th class="r">' +
      esc(t('qty')) + '</th><th class="r">' + esc(t('price')) + '</th><th class="r">' + esc(t('total')) +
      '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="inv-totals">' +
        '<div><span>' + esc(t('subtotal')) + '</span><span>৳' + fmtPoisha(tot.subtotal) + '</span></div>' +
        '<div><span>' + esc(t('discount')) + ' (' + esc(S.discountPct || '0') + '%)</span><span>− ৳' + fmtPoisha(tot.discount) + '</span></div>' +
        '<div><span>' + esc(t('vat')) + ' (' + esc(S.vatPct || '0') + '%)</span><span>+ ৳' + fmtPoisha(tot.vat) + '</span></div>' +
        '<div class="grand"><span>' + esc(t('grandTotal')) + '</span><span>৳' + fmtPoisha(tot.grand) + '</span></div>' +
      '</div>' +
      '<div class="inv-words"><strong>' + esc(t('amountWords')) + ':</strong><br>' + esc(wordsEn) + '<br>' + esc(wordsBn) + '</div>' +
      (S.notes ? '<div class="inv-notes"><strong>' + esc(t('notes')).split(' (')[0] + ':</strong> ' + esc(S.notes).replace(/\n/g, '<br>') + '</div>' : '');
  }

  function renderHistory() {
    var host = $('historyList'); host.innerHTML = '';
    $('historyEmpty').style.display = history.length ? 'none' : '';
    history.forEach(function (h) {
      var div = document.createElement('div');
      div.className = 'hist-row';
      var badge = h.meta.status === 'paid' ? '<span class="badge paid">' + esc(t('paid')) + '</span>' : '<span class="badge unpaid">' + esc(t('unpaid')) + '</span>';
      div.innerHTML = '<strong>' + esc(h.meta.no) + '</strong> ' + badge +
        '<span class="muted">' + esc(h.client.name || '') + ' · ৳' + fmtPoisha(h.totals.grand) + '</span>' +
        '<span class="hist-ops"><button class="btn mini" data-h="open" data-id="' + h.id + '">' + esc(t('load')) + '</button>' +
        '<button class="btn mini" data-h="toggle" data-id="' + h.id + '">' + esc(h.meta.status === 'paid' ? t('markUnpaid') : t('markPaid')) + '</button>' +
        '<button class="btn mini danger-ghost" data-h="del" data-id="' + h.id + '">' + esc(t('del')) + '</button></span>';
      host.appendChild(div);
    });
  }

  function renderAll() {
    applyI18n(); renderItems(); renderSheet(); renderHistory();
  }

  // ---- form sync ----
  function readForm() {
    S.biz.name = $('bizName').value; S.biz.addr = $('bizAddr').value;
    S.biz.phone = $('bizPhone').value; S.biz.email = $('bizEmail').value;
    S.biz.prefix = $('invPrefix').value || 'INV-';
    S.client.name = $('clientName').value; S.client.addr = $('clientAddr').value;
    S.client.phone = $('clientPhone').value;
    S.meta.issue = $('issueDate').value; S.meta.due = $('dueDate').value;
    S.meta.status = $('invStatus').value;
    S.discountPct = $('discountPct').value; S.vatPct = $('vatPct').value;
    S.notes = $('notes').value;
  }
  function writeForm() {
    $('bizName').value = S.biz.name; $('bizAddr').value = S.biz.addr;
    $('bizPhone').value = S.biz.phone; $('bizEmail').value = S.biz.email;
    $('invPrefix').value = S.biz.prefix;
    $('clientName').value = S.client.name; $('clientAddr').value = S.client.addr;
    $('clientPhone').value = S.client.phone;
    $('invNo').value = S.meta.no || nextInvNo();
    $('issueDate').value = S.meta.issue; $('dueDate').value = S.meta.due || '';
    $('invStatus').value = S.meta.status;
    $('discountPct').value = S.discountPct; $('vatPct').value = S.vatPct;
    $('notes').value = S.notes;
    var lr = $('logoRow');
    if (S.biz.logo) { lr.classList.remove('hidden'); $('logoThumb').src = S.biz.logo; }
    else lr.classList.add('hidden');
  }

  // ---- actions ----
  function doSave() {
    readForm();
    var err = validateItems();
    if (err) { $('itemError').textContent = err; return false; }
    $('itemError').textContent = '';
    var tot = computeTotals(S.items, S.discountPct, S.vatPct);
    if (tot.grand > window.InvoiceWords.MAX_POISHA) { $('itemError').textContent = t('errTotalCap'); return false; }
    if (!S.meta.no) { S.meta.no = nextInvNo(); S.counter++; }
    var snap = JSON.parse(JSON.stringify(S));
    snap.totals = tot; snap.id = 'inv' + Date.now();
    var ix = history.findIndex(function (h) { return h.meta.no === snap.meta.no; });
    if (ix >= 0) history[ix] = snap; else history.unshift(snap);
    persistHistory(); persistProfile(); saveDraft();
    writeForm(); renderSheet(); renderHistory();
    toast(t('saved'));
    return true;
  }

  function doPrint() {
    readForm();
    if (!S.client.name.trim()) { toast(t('errClientName')); $('clientName').focus(); return false; }
    var err = validateItems();
    if (err) { $('itemError').textContent = err; return false; }
    $('itemError').textContent = '';
    var tot = computeTotals(S.items, S.discountPct, S.vatPct);
    if (tot.grand > window.InvoiceWords.MAX_POISHA) { $('itemError').textContent = t('errTotalCap'); return false; }
    if (!S.meta.no) { S.meta.no = nextInvNo(); $('invNo').value = S.meta.no; }
    renderSheet(); saveDraft();
    window.print();
    return true;
  }

  function doExport() {
    readForm(); saveDraft();
    var blob = new Blob([JSON.stringify({ profile: { biz: S.biz, counter: S.counter }, history: history, draft: S }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'invoice-maker-bd-backup.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function doImport(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== 'object') throw 0;
        if (d.profile && d.profile.biz) { S.biz = Object.assign(S.biz, d.profile.biz); if (typeof d.profile.counter === 'number') S.counter = d.profile.counter; }
        if (Array.isArray(d.history)) history = d.history;
        if (d.draft && d.draft.items) { var biz = S.biz, counter = S.counter; S = Object.assign(defaultState(), d.draft); S.biz = biz; S.counter = counter; }
        persistProfile(); persistHistory(); saveDraft();
        writeForm(); renderAll(); toast(t('loaded'));
      } catch (e) { toast(t('errBadFile')); }
    };
    r.readAsText(file);
  }

  function loadSample() {
    S.biz.name = 'Rahim Tech Services'; S.biz.addr = 'House 12, Road 5, Dhanmondi, Dhaka 1205';
    S.biz.phone = '01711-223344'; S.biz.email = 'hello@rahimtech.example';
    S.client.name = 'Karim Traders'; S.client.addr = 'New Market, Chattogram'; S.client.phone = '01811-998877';
    S.meta.due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    S.items = [
      { desc: 'Website development', qty: '1', unit: 'project', price: '25000' },
      { desc: 'Monthly maintenance', qty: '3', unit: 'month', price: '5000' }
    ];
    S.discountPct = '5'; S.vatPct = '0';
    S.notes = 'Payment via bKash/Nagad within 7 days.';
    S.meta.no = ''; writeForm(); renderAll(); saveDraft();
  }

  // ---- events ----
  function bind() {
    document.querySelector('.editor').addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.f) {
        S.items[Number(el.dataset.i)][el.dataset.f] = el.value;
        updateLineTotals(); renderSheet(); saveDraft();
      } else { readForm(); renderSheet(); saveDraft(); }
    });
    document.querySelector('.editor').addEventListener('change', function (e) {
      readForm(); renderSheet(); saveDraft(); persistProfile();
    });
    $('itemRows').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var i = Number(b.dataset.i), act = b.dataset.act;
      if (act === 'rm') { if (S.items.length > 1) S.items.splice(i, 1); }
      if (act === 'up' && i > 0) { var tmp = S.items[i - 1]; S.items[i - 1] = S.items[i]; S.items[i] = tmp; }
      if (act === 'down' && i < S.items.length - 1) { var t2 = S.items[i + 1]; S.items[i + 1] = S.items[i]; S.items[i] = t2; }
      renderItems(); renderSheet(); saveDraft();
    });
    $('btnAddItem').addEventListener('click', function () { S.items.push(blankItem()); renderItems(); renderSheet(); saveDraft(); });
    $('btnSave').addEventListener('click', doSave);
    $('btnPrint').addEventListener('click', doPrint);
    $('btnExport').addEventListener('click', doExport);
    $('btnImport').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ''; });
    $('btnNew').addEventListener('click', function () {
      var biz = S.biz, counter = S.counter;
      S = defaultState(); S.biz = biz; S.counter = counter; S.meta.no = '';
      writeForm(); renderAll(); saveDraft();
    });
    $('btnClear').addEventListener('click', function () {
      if (!confirm(t('confirmClear'))) return;
      localStorage.removeItem(LS_DRAFT);
      var biz = S.biz, counter = S.counter;
      S = defaultState(); S.biz = biz; S.counter = counter;
      writeForm(); renderAll(); saveDraft();
    });
    $('btnSample').addEventListener('click', loadSample);
    $('btnLang').addEventListener('click', function () {
      lang = lang === 'en' ? 'bn' : 'en';
      try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
      renderAll();
    });
    $('logoFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          var scale = Math.min(1, 400 / Math.max(img.width, img.height));
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          S.biz.logo = c.toDataURL('image/jpeg', 0.8);
          persistProfile(); writeForm(); renderSheet(); saveDraft();
        };
        img.src = r.result;
      };
      r.readAsDataURL(f); e.target.value = '';
    });
    $('btnLogoRemove').addEventListener('click', function () {
      S.biz.logo = ''; persistProfile(); writeForm(); renderSheet(); saveDraft();
    });
    $('historyList').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = b.dataset.id, h = history.find(function (x) { return x.id === id; });
      if (!h) return;
      var act = b.dataset.h;
      if (act === 'open') {
        var biz = S.biz, counter = S.counter;
        S = JSON.parse(JSON.stringify(h)); delete S.totals; delete S.id;
        S.biz = Object.assign(biz, S.biz || {}); S.counter = counter;
        writeForm(); renderAll(); saveDraft(); toast(t('loaded'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (act === 'toggle') {
        h.meta.status = h.meta.status === 'paid' ? 'unpaid' : 'paid';
        persistHistory(); renderHistory();
      } else if (act === 'del') {
        if (!confirm(t('confirmDel'))) return;
        history = history.filter(function (x) { return x.id !== id; });
        persistHistory(); renderHistory(); toast(t('deleted'));
      }
    });
  }

  // ---- init ----
  loadAll();
  if (!S.meta.no) S.meta.no = '';
  writeForm();
  bind();
  renderAll();

  // test hooks (not part of UI)
  window.__imbd = { state: function () { return S; }, totals: computeTotals, fmt: fmtPoisha, toPoisha: toPoisha, save: doSave, print: doPrint, setLang: function (l) { lang = l; renderAll(); } };
})();
