# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Currency Radar is a **Manifest V3 Chrome extension** that tracks EUR/BRL and USD/BRL exchange rates. It fetches live market rates and 6-month PTAX historical data, then runs a statistical analysis to suggest whether the current rate is a good buying opportunity.

There is no build step, no bundler, no test framework, and no linter configured. The extension uses native ES modules loaded directly by the browser.

## Loading the extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory

After any JS/HTML/CSS change, click the reload icon on the extension card in `chrome://extensions`.

## Architecture

### Data sources (two separate APIs)

- **Live rates** — `services/currentRates.js` hits `economia.awesomeapi.com.br`. Returns `ask` (used when buying foreign currency with BRL) and `bid` (used when selling foreign currency back to BRL), plus today's `pctChange`.
- **Historical PTAX** — `services/exchangeRate.js` hits `api.frankfurter.dev/v2` with `providers=BCB`, fetching ~6 months of daily closing rates.

### Analysis pipeline (`services/analysis.js`)

Called in sequence inside `loadCurrency()` in `popup.js`:

1. `calculateStatistics(history)` — computes mean, min, max, median, and percentiles P10/P25/P50/P75/P90 over the sorted historical rates.
2. `calculateTrend(history)` — computes 7-day and 30-day changes against the most recent PTAX entry; classifies direction as `"up"`, `"down"`, or `"stable"` with a ±0.15% neutral threshold.
3. `analyzeOpportunity(currentRate, statistics)` — maps the current rate to a percentile in the historical distribution; returns a score and a plain-language `message`.
4. `analyzeRadar(currentRate, statistics, trend)` — combines historical zone (quartile bands) with trend direction into a combined icon + message.
5. `analyzeDecision(currentRate, statistics, trend, todayChange)` — final suggested action (CONSIDERAR COMPRA / CONSIDERAR COMPRA PARCIAL / ACOMPANHAR / AGUARDAR) driven primarily by the historical percentile zone.

### UI (popup.js + popup.html)

- Two views share the same `<main>`: `#radar-view` and `#calculator-view` (toggled via `hidden`).
- Three tabs in `<nav class="tabs">`: EUR radar, USD radar, and calculator.
- The calculator module (`services/calculator/calculator.js`) is **lazy-loaded** via a dynamic `import()` the first time the calculator tab is opened.
- `selectedCurrency` is a module-level variable in `popup.js`; switching tabs re-runs the full data fetch.

### Calculator tab

The calculator has two components rendered in the same card:

1. **Historical chart** — Canvas drawn via the 2D API (no library). Shows EUR/BRL or USD/BRL rate history fetched from the same Frankfurter/BCB source as the Radar, with period selector (1M/3M/6M), gradient fill, green dashed line for the current market ask rate, and a hover crosshair with tooltip. History per pair is cached in-memory for the duration of the popup session.

2. **Converter** — Converts between BRL and EUR or USD. The `from`/`to` buttons toggle the foreign currency between EUR and USD; the swap button (↔) flips the direction. Uses `ask` when buying foreign currency with BRL and `bid` for the reverse.

### background.js

Currently empty (placeholder service worker).

## Key constraints

- The popup uses `type="module"` on its `<script>` tag, so all imports must be relative paths.
- The calculator module is at `services/calculator/calculator.js`. Its imports are `"../currentRates.js"` and `"../exchangeRate.js"` (one level up within `services/`). The dynamic import in `popup.js` is `"./services/calculator/calculator.js"`.
- Rates are always quoted as `X/BRL` (foreign currency per 1 BRL would be inverted; here 1 EUR = ~6 BRL means `rate ≈ 6`).
- The extension declares `"storage"` and `"alarms"` permissions in the manifest but neither is used yet.
