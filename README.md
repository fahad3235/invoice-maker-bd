# Invoice Maker BD — ইনভয়েস মেকার বিডি

A free, fully offline invoice generator for Bangladeshi freelancers and small shops.
Fill in your business + client details, add line items, and print a professional
A4 invoice — in English or বাংলা. Your data never leaves your browser.

## Problem

Freelancers and small shops in Bangladesh need proper invoices to look
professional and get paid on time, but existing tools are either paid,
require accounts, or send business data to someone else's server.

## Features

- Business profile (name, address, phone, optional logo — browser-only) + client details
- Line items with description, quantity, unit, unit price; add / remove / reorder
- Discount % and VAT % with exact integer-poisha math (discount on subtotal, VAT on discounted amount)
- **Amount in words in English AND Bangla** (lakh/crore system), e.g. ৳12,500 →
  "Twelve thousand five hundred taka only" / "বারো হাজার পাঁচশত টাকা মাত্র"
- Auto-incrementing invoice numbers with editable prefix (INV-0001, …)
- Issue / due dates, Paid / Unpaid status stamp
- Invoice history: reopen, mark paid/unpaid, delete
- Print / PDF via dedicated A4 print CSS (editor chrome hidden)
- localStorage persistence, JSON export / import, sample data, clear-all
- Full EN ⇄ বাংলা UI toggle; responsive mobile + desktop

## Stack

Vanilla HTML / CSS / JS. No build step, no dependencies, no backend,
zero network requests.

## Prerequisites

Any modern browser (Chrome, Edge, Firefox, Safari). For local development,
any static file server.

## Install

No install needed. Open `index.html` via a local server (the app itself makes
no network requests, but `file://` is not recommended for the import feature):

```bash
cd invoice-maker-bd
python3 -m http.server 8123
# open http://127.0.0.1:8123/
```

## Dev commands

None — there is no build. Edit the files and reload.

## Env

None. There are no API keys, no backend, no `.env`. A secrets scan
(`api_key|secret|token|password` over `*.js`/`*.html`) is clean.

## Testing

Headless-Chromium suite (29 checks) via `playwright-core` against the
system Chromium headless shell:

```bash
cd /tmp/inv-test            # test script lives outside the repo
npm i playwright-core
python3 -m http.server 8123 --directory ~/workspace/muse-project-factory/builds/invoice-maker-bd &
node test.cjs
```

Plus a direct node check of the words module:

```bash
node -e "global.window=global; require('./js/words.js'); ..."
```

Covered: zero console/page errors; exact EN/BN amount-in-words strings
(12,500 / 3,685.50 / 0); hand-computed totals — 3×৳500 + 2×৳1,200 with
10% discount + 5% VAT → subtotal ৳3,900.00, grand ৳3,685.50; qty/price
validation; auto-increment (INV-0001 → INV-0002); paid badge; history
persistence across reload; export/import round-trip; print blocked without
client name; `page.pdf()` → 1 page, `pdftotext` contains client name,
"3,685.50" and the words line; BN/EN toggle both ways; logo upload +
thumbnail; 390px mobile with no horizontal overflow.

## Deployment

GitHub Pages compatible: static files, relative paths, no server needed.
Enable Pages on `main` / root.

## Limitations

- **Not accounting software**: no tax filing, no ledger, no multi-currency.
  Discount is applied before VAT (documented in-app behavior); rates and
  invoice wording are your responsibility — this is not tax advice.
- Amounts above ৳9,99,99,999 are rejected (words module range); split into
  multiple invoices.
- Data lives in the browser's localStorage (per device/browser); JSON export
  is the backup path. The logo is stored as a downscaled JPEG dataURL.
- PDF fidelity depends on the browser's print engine.

## Status

Built 2026-10-11. 29/29 headless-Chrome checks green, zero console errors.
Ready for GitHub Pages deployment.
